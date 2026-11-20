import type { Pool } from "pg";
import { normalizePatch } from "../domain/patches.js";
import { saveItemCatalog } from "../persistence/catalog.js";
import { parseItemCatalog } from "../providers/ddragon.js";
import {
  leaguepediaBatchSize,
  leaguepediaGamesUrl,
  parseLeaguepediaGames,
  proGameDetailVersion,
  proGamePlatformPattern,
  type ProGameDetails,
} from "../providers/leaguepedia-game.js";
import { cacheCatalogImages } from "./catalog-images.js";
import type { Refusal } from "./leaguepedia-budget.js";
import { DeferredRequest } from "./quota.js";

export interface ProGameDetailRun {
  /** Yield after this many milliseconds (by the injected clock); stays under the job lease. */
  maxMs?: number;
}
export interface ProGameDetailOptions extends ProGameDetailRun {
  clock: () => Date;
  /** Sends one request within the shared Leaguepedia budget, which spaces and pauses requests. */
  request: (url: string) => Promise<Response>;
  /** Records a refusal and returns when Leaguepedia jobs may try again. */
  refused: (refusal: Refusal) => Promise<Date>;
  /** Records a usable reply, which ends a run of refusals. */
  accepted: () => Promise<void>;
}

/**
 * Games still to check, in this order: never-checked games in a covered competition (projected
 * into `games`), details stored once by an older parser, other never-checked games, then games
 * checked over a week ago without gold data. Each group runs newest first.
 */
async function pendingGames(pool: Pool, now: Date, skip: readonly string[], limit: number) {
  const games = await pool.query<{ source_game_id: string }>(
    `SELECT g.source_game_id
     FROM oracle_archive_games g LEFT JOIN pro_game_details d USING (source_game_id)
       LEFT JOIN games c ON c.archive_game_id=g.id
     WHERE g.complete AND g.source_game_id ~ $1 AND NOT g.source_game_id=ANY($3::text[])
       AND (d.checked_at IS NULL OR (
         d.checked_at < $2::timestamptz - interval '7 days'
         AND (d.document IS NULL OR d.document->'gold' = '[]'::jsonb)
       ) OR (d.document->'gold' <> '[]'::jsonb
         AND coalesce((d.document->>'detailVersion')::int, 1) < $5
         -- One attempt: a failed reload moves checked_at past observed_at and keeps the old record.
         AND d.checked_at <= d.observed_at))
     GROUP BY g.source_game_id, d.checked_at, (d.document->'gold' <> '[]'::jsonb)
     ORDER BY CASE
         WHEN d.checked_at IS NULL AND bool_or(c.id IS NOT NULL) THEN 0
         -- Only outdated records with gold data pass the filter above.
         WHEN d.document->'gold' <> '[]'::jsonb THEN 1
         WHEN d.checked_at IS NULL THEN 2
         ELSE 3
       END, max(g.occurred_at) DESC, g.source_game_id
     LIMIT $4`,
    [proGamePlatformPattern, now, skip, limit, proGameDetailVersion],
  );
  return games.rows.map(({ source_game_id: id }) => id);
}

async function markChecked(pool: Pool, id: string, checkedAt: Date) {
  // Keeps an earlier valid record; only the check time moves.
  await pool.query(
    `INSERT INTO pro_game_details(source_game_id,checked_at) VALUES($1,$2)
     ON CONFLICT(source_game_id) DO UPDATE SET checked_at=EXCLUDED.checked_at`,
    [id, checkedAt],
  );
}

async function saveDetail(pool: Pool, id: string, detail: ProGameDetails | null, now: Date) {
  const hasLineups = detail?.players.length === 10;
  await pool.query(
    `INSERT INTO pro_game_details(source_game_id,checked_at,observed_at,document)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(source_game_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,
       observed_at=CASE WHEN EXCLUDED.document->'gold' <> '[]'::jsonb
         OR pro_game_details.document IS NULL THEN EXCLUDED.observed_at ELSE pro_game_details.observed_at END,
       document=CASE WHEN EXCLUDED.document->'gold' <> '[]'::jsonb
         OR pro_game_details.document IS NULL THEN EXCLUDED.document ELSE pro_game_details.document END`,
    [id, now, hasLineups ? now : null, hasLineups ? JSON.stringify(detail) : null],
  );
  return hasLineups ? detail : null;
}

/** Stores the item catalog and icons of the game's patch, which may predate the current one. */
async function cacheItems(pool: Pool, detail: ProGameDetails, options: ProGameDetailOptions) {
  const patch = normalizePatch(detail.version)?.key;
  if (!patch) return;
  const ids = [
    ...new Set(
      detail.players.flatMap(({ inventory, purchases }) =>
        [...inventory, ...(purchases?.map(({ itemId }) => itemId) ?? [])].map(String),
      ),
    ),
  ];
  if (!ids.length) return;
  const catalog = await pool.query<{ version: string | null; stored: boolean }>(
    `SELECT ddragon_versions[1] AS version,
      EXISTS(SELECT 1 FROM catalog_items WHERE patch_key=$1) AS stored
     FROM patches WHERE patch_key=$1`,
    [patch],
  );
  const entry = catalog.rows[0];
  if (!entry?.version) return;
  if (!entry.stored) {
    const version = entry.version;
    const response = await options.request(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`,
    );
    await saveItemCatalog(
      pool,
      patch,
      version,
      parseItemCatalog(await response.json(), version),
      options.clock(),
    );
  }
  await cacheCatalogImages(pool, patch, options.request, options.clock, ids);
}

/**
 * Loads Leaguepedia postgame details in batches until no game is pending or the run's time is
 * spent. Each game commits on its own, so a failed request keeps the games already loaded and
 * leaves the rest unchecked. `remaining` says whether the job should run again.
 */
export async function refreshProGameDetails(pool: Pool, options: ProGameDetailOptions) {
  const { clock } = options;
  // A final batch can take its 60-second timeout and still finish within the five-minute lease.
  const maxMs = options.maxMs ?? 180_000;
  const started = clock().valueOf();
  // Games the reply cut off; later batches skip them so a run cannot loop on them.
  const deferred: string[] = [];
  let loaded = 0;
  while (clock().valueOf() - started < maxMs) {
    const ids = await pendingGames(pool, clock(), deferred, leaguepediaBatchSize);
    if (!ids.length) break;
    const response = await options.request(leaguepediaGamesUrl(ids));
    const reply = parseLeaguepediaGames(await response.json(), ids);
    if (reply.state === "refused")
      throw new DeferredRequest(
        await options.refused({
          kind: reply.code === "maxlag" ? "lag" : "limit",
          reason: reply.code === "maxlag" ? "Leaguepedia replicas lag" : "Leaguepedia rate limit",
          retryAfter: response.headers.get("retry-after"),
        }),
      );
    await options.accepted();
    for (const id of ids) {
      const game = reply.games.get(id)!;
      // A game too large to fit even alone is checked again in a week, like a missing one.
      if (game.state === "deferred" && ids.length > 1) deferred.push(id);
      else if (game.state !== "loaded") await markChecked(pool, id, clock());
      else {
        const detail = await saveDetail(pool, id, game.detail, clock());
        if (!detail) continue;
        loaded++;
        await cacheItems(pool, detail, options);
      }
    }
  }
  return { loaded, remaining: (await pendingGames(pool, clock(), [], 1)).length > 0 };
}
