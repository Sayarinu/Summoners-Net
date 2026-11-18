import type { Pool } from "pg";
import { proGamePlatformPattern } from "../providers/leaguepedia-game.js";
import {
  leaguepediaVodBatchSize,
  leaguepediaVodsUrl,
  parseLeaguepediaVods,
  type LeaguepediaVod,
} from "../providers/leaguepedia-vod.js";
import { DeferredRequest } from "./quota.js";

export interface ProGameVodRun {
  /** Yield after this many milliseconds (by the injected clock); stays under the job lease. */
  maxMs?: number;
  /** The least time between two Leaguepedia requests. */
  spacingMs?: number;
}
export interface ProGameVodOptions extends ProGameVodRun {
  clock: () => Date;
  request: (url: string) => Promise<Response>;
  pause: (milliseconds: number) => Promise<void>;
}

/**
 * Games still to check, in this order: never-checked games in a covered competition (projected
 * into `games`), other never-checked games, then games still without a recording. The wiki adds
 * recordings days after a game, so a game from the last two weeks is checked again after six
 * hours and an older one after 30 days. Each group runs newest first.
 */
async function pendingGames(pool: Pool, now: Date, limit: number) {
  const games = await pool.query<{ source_game_id: string }>(
    `SELECT g.source_game_id
     FROM oracle_archive_games g LEFT JOIN pro_game_vods v USING (source_game_id)
       LEFT JOIN games c ON c.archive_game_id=g.id
     WHERE g.complete AND g.source_game_id ~ $1
       AND (v.checked_at IS NULL OR (v.observed_at IS NULL AND v.checked_at < $2::timestamptz
         - CASE WHEN g.occurred_at > $2::timestamptz - interval '14 days'
             THEN interval '6 hours' ELSE interval '30 days' END))
     GROUP BY g.source_game_id, v.checked_at
     ORDER BY CASE
         WHEN v.checked_at IS NULL AND bool_or(c.id IS NOT NULL) THEN 0
         WHEN v.checked_at IS NULL THEN 1
         ELSE 2
       END, max(g.occurred_at) DESC, g.source_game_id
     LIMIT $3`,
    [proGamePlatformPattern, now, limit],
  );
  return games.rows.map(({ source_game_id: id }) => id);
}

/** Records a check; links found earlier stay until the wiki offers usable new ones. */
async function saveVod(pool: Pool, id: string, vod: LeaguepediaVod | null, now: Date) {
  await pool.query(
    `INSERT INTO pro_game_vods(source_game_id,checked_at,observed_at,leaguepedia_game_id,
       game_start_url,draft_start_url,vod_url)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(source_game_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,
       observed_at=coalesce(EXCLUDED.observed_at,pro_game_vods.observed_at),
       leaguepedia_game_id=CASE WHEN EXCLUDED.observed_at IS NULL
         THEN pro_game_vods.leaguepedia_game_id ELSE EXCLUDED.leaguepedia_game_id END,
       game_start_url=CASE WHEN EXCLUDED.observed_at IS NULL
         THEN pro_game_vods.game_start_url ELSE EXCLUDED.game_start_url END,
       draft_start_url=CASE WHEN EXCLUDED.observed_at IS NULL
         THEN pro_game_vods.draft_start_url ELSE EXCLUDED.draft_start_url END,
       vod_url=CASE WHEN EXCLUDED.observed_at IS NULL
         THEN pro_game_vods.vod_url ELSE EXCLUDED.vod_url END`,
    [
      id,
      now,
      vod ? now : null,
      vod?.leaguepediaGameId ?? null,
      vod?.gameStartUrl ?? null,
      vod?.draftStartUrl ?? null,
      vod?.vodUrl ?? null,
    ],
  );
}

/**
 * Loads Leaguepedia per-game recordings in batches until no game is pending or the run's time is
 * spent. Each game commits on its own, so a failed request keeps the games already checked. `remaining`
 * says whether the job should run again.
 */
export async function refreshProGameVods(pool: Pool, options: ProGameVodOptions) {
  const { clock, pause } = options;
  // A final batch can take its 60-second timeout and still finish within the five-minute lease.
  const maxMs = options.maxMs ?? 180_000;
  const spacingMs = options.spacingMs ?? 2000;
  const started = clock().valueOf();
  let lastRequest: number | null = null;
  let found = 0;
  while (clock().valueOf() - started < maxMs) {
    const ids = await pendingGames(pool, clock(), leaguepediaVodBatchSize);
    if (!ids.length) break;
    if (lastRequest !== null) {
      const wait = lastRequest + spacingMs - clock().valueOf();
      if (wait > 0) await pause(wait);
    }
    lastRequest = clock().valueOf();
    const response = await options.request(leaguepediaVodsUrl(ids));
    const reply = parseLeaguepediaVods(await response.json(), ids);
    if (reply.state === "lagged") {
      const seconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : 30;
      throw new DeferredRequest(new Date(clock().valueOf() + delay * 1000));
    }
    for (const id of ids) {
      const vod = reply.vods.get(id) ?? null;
      await saveVod(pool, id, vod, clock());
      if (vod) found++;
    }
  }
  return { found, remaining: (await pendingGames(pool, clock(), 1)).length > 0 };
}
