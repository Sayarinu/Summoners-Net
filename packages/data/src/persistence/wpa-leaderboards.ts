import type { PoolClient } from "pg";
import { applySamplePolicy } from "../domain/statistics.js";
import {
  wpaLeaderboardQuerySchema,
  wpaPageSize,
  type WpaLeaderboard,
  type WpaLeaderboardQuery,
  type WpaLeaderboardRow,
} from "../domain/wpa-leaderboards.js";
import type { Executor } from "./database.js";
import { activeWinProbabilityModel } from "./wp-models.js";

/**
 * Rebuilds one model's WPA aggregates from its scored events, inside the caller's transaction.
 * Every participant of every scored game counts, with zero when they had no share.
 */
export async function rebuildWpaAggregates(c: PoolClient, modelId: number, now: Date) {
  await c.query("DELETE FROM wpa_aggregates WHERE model_id=$1", [modelId]);
  const inserted = await c.query(
    `WITH scored AS (SELECT DISTINCT match_id FROM riot_wpa_events WHERE model_id=$1),
     players AS (
       SELECT p.match_id,p.participant_id,p.puuid,p.champion_id,m.patch_key,
         CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
           THEN p.team_position ELSE 'UNKNOWN' END AS role,
         coalesce((SELECT sum(w.value) FROM riot_wpa_participants w WHERE w.model_id=$1
           AND w.match_id=p.match_id AND w.participant_id=p.participant_id),0) AS wpa
       FROM scored s JOIN riot_match_participants p USING (match_id)
       JOIN riot_matches m USING (match_id) WHERE m.patch_key IS NOT NULL)
     INSERT INTO wpa_aggregates(model_id,patch_key,kind,subject,games,total,built_at)
     SELECT $1,patch_key,kind,subject,count(*),sum(wpa),$2 FROM (
       SELECT patch_key,'champion' AS kind,champion_id::text AS subject,wpa FROM players
       UNION ALL SELECT patch_key,'player',puuid,wpa FROM players
       UNION ALL SELECT patch_key,'role',role,wpa FROM players) s
     GROUP BY patch_key,kind,subject`,
    [modelId, now],
  );
  return inserted.rowCount ?? 0;
}

/**
 * A WPA leaderboard for one patch from the active model only, sorted and paginated in SQL.
 * Values are in percentage points; rows below the minimum sample keep their games but no values.
 */
export async function wpaLeaderboard(
  db: Executor,
  input: WpaLeaderboardQuery = {},
): Promise<WpaLeaderboard> {
  const q = wpaLeaderboardQuerySchema.parse(input);
  const model = await activeWinProbabilityModel(db);
  const empty = { items: [], page: q.page, pageSize: wpaPageSize, total: 0 };
  if (!model) return { query: q, model: null, patch: null, patches: [], page: empty };
  const patches = (
    await db.query<{ patch_key: string }>(
      `SELECT p.patch_key FROM patches p
       WHERE EXISTS (SELECT 1 FROM wpa_aggregates a WHERE a.model_id=$1 AND a.patch_key=p.patch_key)
       ORDER BY p.release_order DESC`,
      [model.id],
    )
  ).rows.map((r) => r.patch_key);
  const patch = q.patch ?? patches[0] ?? null;
  const meta = { id: model.id, modelVersion: model.modelVersion, brier: model.brier };
  if (!patch) return { query: q, model: meta, patch: null, patches, page: empty };
  const order = { perGame: "total/games", total: "total", games: "games" }[q.sort];
  const rows = await db.query<{
    subject: string;
    games: number;
    total: number;
    champion_id: string | null;
    name: string | null;
    count: number;
  }>(
    // Page first, then look up names for that page only.
    `WITH ranked AS (
       SELECT a.subject,a.games,a.total,a.kind,a.patch_key,count(*) OVER()::integer AS count
       FROM wpa_aggregates a WHERE a.model_id=$1 AND a.kind=$2 AND a.patch_key=$3
       ORDER BY ${order} DESC,a.games DESC,a.subject LIMIT $4 OFFSET $5)
     SELECT a.subject,a.games,a.total,c.champion_id,
       CASE a.kind WHEN 'champion' THEN c.name
         WHEN 'player' THEN (SELECT r.game_name||'#'||r.tag_line FROM riot_accounts r
           WHERE r.puuid=a.subject AND r.game_name IS NOT NULL)
         ELSE a.subject END AS name,
       a.count
     FROM ranked a
     LEFT JOIN LATERAL (SELECT c.champion_id,c.name FROM catalog_champions c JOIN patches p USING (patch_key)
       WHERE c.champion_key=(CASE WHEN a.kind='champion' THEN a.subject::integer END)
       ORDER BY (c.patch_key=a.patch_key) DESC,p.release_order DESC LIMIT 1) c ON true
     ORDER BY ${order} DESC,a.games DESC,a.subject`,
    [model.id, q.kind, patch, wpaPageSize, (q.page - 1) * wpaPageSize],
  );
  return {
    query: q,
    model: meta,
    patch,
    patches,
    page: {
      items: rows.rows.map((r): WpaLeaderboardRow => {
        const shown = applySamplePolicy({ value: r.total * 100, sampleCount: r.games });
        return {
          kind: q.kind,
          subject: r.subject,
          name: r.name,
          championId: r.champion_id,
          games: r.games,
          total: { value: shown.value, sampleCount: r.games },
          perGame: {
            value: shown.value === null ? null : shown.value / r.games,
            sampleCount: r.games,
          },
        };
      }),
      page: q.page,
      pageSize: wpaPageSize,
      total: rows.rows[0]?.count ?? 0,
    },
  };
}
