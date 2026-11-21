import {
  championMatchupsQuerySchema,
  matchupEstimate,
  matchupMetrics,
  matchupMinimumSample,
  matchupPriorGames,
  type ChampionMatchupsQuery,
  type ChampionMatchups,
  type MetricCounts,
  type MatchupMetric,
  type MatchupExclusions,
} from "../domain/matchups.js";
import type { PatchChampion } from "../domain/patch-overview.js";
import type { Executor } from "./database.js";
import { defaultPatch } from "./aggregates.js";
// Both matchup queries bind source at $2 and the optional chosen patches at $3; without them the
// newest patch with matchups is chosen. `newest` is the newest chosen patch.
export const matchupPatchScope = `available AS (
      SELECT p.patch_key FROM patches p
      WHERE EXISTS (SELECT 1 FROM matchup_aggregates a WHERE a.source=$2 AND a.patch_key=p.patch_key)
         OR EXISTS (SELECT 1 FROM matchup_exclusions e WHERE e.source=$2 AND e.patch_key=p.patch_key)
    ), chosen AS (
      SELECT p.patch_key FROM patches p WHERE p.patch_key=ANY(coalesce($3::text[],ARRAY(
        SELECT a.patch_key FROM available a JOIN patches p USING(patch_key)
        ORDER BY p.release_order DESC LIMIT 1)))
    ), newest AS (
      SELECT c.patch_key FROM chosen c JOIN patches p USING(patch_key)
      ORDER BY p.release_order DESC LIMIT 1
    )`;
/**
 * Aggregate-only, bounded opponent pages. The pooled baseline is computed before pagination.
 * Opponents with fewer than `minimumGames` win-rate observations are left out and counted. With
 * no patch chosen, the page opens on the newest patch with enough games, as the tier list does.
 */
export async function championMatchups(
  db: Executor,
  input: ChampionMatchupsQuery,
  { minimumGames = matchupMinimumSample }: { minimumGames?: number } = {},
): Promise<ChampionMatchups | null> {
  const q = championMatchupsQuerySchema.parse(input);
  const fallback = q.patch ? null : await defaultPatch(db, q.source, null, null, null);
  const patches = q.patch ?? (fallback ? [fallback] : null);
  const row = (
    await db.query<{
      champion: PatchChampion | null;
      patch: string | null;
      combined: string[];
      patches: string[];
      total: number;
      hidden: number;
      baseline: Record<MatchupMetric, MetricCounts> | null;
      items: {
        opponent: PatchChampion;
        games: number;
        metrics: Record<MatchupMetric, MetricCounts>;
      }[];
      exclusions: MatchupExclusions[];
    }>(
      `
    WITH ${matchupPatchScope}, champion AS (
      SELECT c.champion_key AS "championKey",c.champion_id AS "championId",c.name,
        CASE WHEN i.asset_hash IS NULL THEN NULL ELSE '/api/images/'||i.asset_hash END AS "imageUrl"
      FROM catalog_champions c JOIN patches p USING(patch_key)
      LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
      WHERE c.champion_id=$1 ORDER BY p.release_order DESC LIMIT 1
    ), observed AS (
      SELECT * FROM matchup_aggregates WHERE source=$2 AND patch_key IN (SELECT patch_key FROM chosen)
        AND champion_key=(SELECT "championKey" FROM champion) AND role=$4
    ), summed AS (
      -- Each opponent's counts added up across the chosen patches.
      SELECT opponent_key,key,sum((value->>'total')::double precision) AS total,
        sum((value->>'count')::integer)::integer AS n
      FROM observed CROSS JOIN LATERAL jsonb_each(metrics) GROUP BY opponent_key,key
    ), scoped AS (
      SELECT g.opponent_key,g.games,m.metrics FROM (
        SELECT opponent_key,sum(games)::integer AS games FROM observed GROUP BY opponent_key) g
      JOIN (
        SELECT opponent_key,jsonb_object_agg(key,jsonb_build_object('total',total,'count',n)) AS metrics
        FROM summed GROUP BY opponent_key) m USING (opponent_key)
    ), totals AS (
      SELECT key,sum((value->>'total')::double precision) AS total,sum((value->>'count')::integer)::integer AS n
      FROM scoped CROSS JOIN LATERAL jsonb_each(metrics) GROUP BY key
    ), baseline AS (
      SELECT jsonb_object_agg(key,jsonb_build_object('total',total,'count',n)) AS metrics FROM totals
    ), sortable AS (
      SELECT a.*,CASE WHEN $5='games' THEN games::double precision
        WHEN (a.metrics->$5->>'count')::integer>=${matchupMinimumSample} THEN
          CASE WHEN $6='raw' THEN (a.metrics->$5->>'total')::double precision/nullif((a.metrics->$5->>'count')::integer,0)
          ELSE ((a.metrics->$5->>'total')::double precision+${matchupPriorGames}*
            (b.metrics->$5->>'total')::double precision/nullif((b.metrics->$5->>'count')::integer,0)) /
            ((a.metrics->$5->>'count')::integer+${matchupPriorGames}) END END AS sort_value
      FROM scoped a CROSS JOIN baseline b
      WHERE coalesce((a.metrics->'winRate'->>'count')::integer,0)>=$9
    ), selected AS (
      SELECT * FROM sortable ORDER BY sort_value ${q.order === "asc" ? "ASC" : "DESC"} NULLS LAST,opponent_key LIMIT $7 OFFSET $8
    ), rows AS (
      SELECT s.games,s.metrics,s.sort_value,s.opponent_key,
        jsonb_build_object('championKey',s.opponent_key,'championId',c.champion_id,'name',c.name,
          'imageUrl',CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END) AS opponent
      FROM selected s LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=s.opponent_key ORDER BY (c.patch_key=(SELECT patch_key FROM newest)) DESC,p.release_order DESC LIMIT 1
      ) c ON true
    ), exclusions AS (
      SELECT role,sum(games)::integer AS games,sum(participants)::integer AS participants,
        sum(unknown_role)::integer AS "unknownRole",sum(ambiguous_role)::integer AS "ambiguousRole",
        sum(missing_opponent)::integer AS "missingOpponent",
        sum(unmapped_champion)::integer AS "unmappedChampion"
      FROM matchup_exclusions WHERE source=$2 AND patch_key IN (SELECT patch_key FROM chosen)
        AND role IN ($4,'UNKNOWN') GROUP BY role
    ) SELECT (SELECT to_jsonb(champion) FROM champion) AS champion,(SELECT patch_key FROM newest) AS patch,
      coalesce((SELECT jsonb_agg(c.patch_key ORDER BY p.release_order DESC) FROM chosen c
        JOIN patches p USING(patch_key)),'[]') AS combined,
      coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (
        SELECT a.patch_key,p.release_order FROM available a JOIN patches p USING(patch_key)
        ORDER BY p.release_order DESC LIMIT 50) p),'[]') AS patches,
      (SELECT count(*)::integer FROM sortable) AS total,
      (SELECT count(*)::integer FROM scoped)-(SELECT count(*)::integer FROM sortable) AS hidden,
      (SELECT metrics FROM baseline) AS baseline,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY sort_value ${q.order === "asc" ? "ASC" : "DESC"} NULLS LAST,opponent_key) FROM rows),'[]') AS items,
      coalesce((SELECT jsonb_agg(to_jsonb(exclusions) ORDER BY role) FROM exclusions),'[]') AS exclusions
  `,
      [
        q.champion,
        q.source,
        patches,
        q.role,
        q.sort,
        q.value,
        q.pageSize,
        (q.page - 1) * q.pageSize,
        minimumGames,
      ],
    )
  ).rows[0]!;
  if (!row.champion) return null;
  return {
    query: q,
    champion: row.champion,
    patch: row.patch,
    combined: row.combined,
    patches: row.patches,
    exclusions: row.exclusions,
    minimumGames,
    hiddenOpponents: row.hidden,
    page: {
      page: q.page,
      pageSize: q.pageSize,
      total: row.total,
      items: row.items.map((r) => ({
        opponent: r.opponent,
        games: r.games,
        metrics: Object.fromEntries(
          matchupMetrics.map((metric) => [
            metric,
            matchupEstimate(r.metrics[metric], row.baseline![metric]),
          ]),
        ) as ChampionMatchups["page"]["items"][number]["metrics"],
      })),
    },
  };
}
