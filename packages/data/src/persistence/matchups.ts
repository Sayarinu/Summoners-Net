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
/** Aggregate-only, bounded opponent pages. The pooled baseline is computed before pagination. */
export async function championMatchups(
  db: Executor,
  input: ChampionMatchupsQuery,
): Promise<ChampionMatchups | null> {
  const q = championMatchupsQuerySchema.parse(input);
  const row = (
    await db.query<{
      champion: PatchChampion | null;
      patch: string | null;
      patches: string[];
      total: number;
      baseline: Record<MatchupMetric, MetricCounts> | null;
      items: {
        opponent: PatchChampion;
        games: number;
        metrics: Record<MatchupMetric, MetricCounts>;
      }[];
      exclusions: MatchupExclusions[];
    }>(
      `
    WITH available AS (
      SELECT p.patch_key FROM patches p
      WHERE EXISTS (SELECT 1 FROM matchup_aggregates a WHERE a.source=$2 AND a.patch_key=p.patch_key)
         OR EXISTS (SELECT 1 FROM matchup_exclusions e WHERE e.source=$2 AND e.patch_key=p.patch_key)
    ), champion AS (
      SELECT c.champion_key AS "championKey",c.champion_id AS "championId",c.name,
        CASE WHEN i.asset_hash IS NULL THEN NULL ELSE '/api/images/'||i.asset_hash END AS "imageUrl"
      FROM catalog_champions c JOIN patches p USING(patch_key)
      LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
      WHERE c.champion_id=$1 ORDER BY p.release_order DESC LIMIT 1
    ), chosen AS (
      SELECT p.patch_key FROM patches p WHERE p.patch_key=coalesce($3::text,(
        SELECT a.patch_key FROM available a JOIN patches p USING(patch_key)
        ORDER BY p.release_order DESC LIMIT 1))
    ), scoped AS (
      SELECT * FROM matchup_aggregates WHERE source=$2 AND patch_key=(SELECT patch_key FROM chosen)
        AND champion_key=(SELECT "championKey" FROM champion) AND role=$4
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
    ), selected AS (
      SELECT * FROM sortable ORDER BY sort_value ${q.order === "asc" ? "ASC" : "DESC"} NULLS LAST,opponent_key LIMIT $7 OFFSET $8
    ), rows AS (
      SELECT s.games,s.metrics,s.sort_value,s.opponent_key,
        jsonb_build_object('championKey',s.opponent_key,'championId',c.champion_id,'name',c.name,
          'imageUrl',CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END) AS opponent
      FROM selected s LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=s.opponent_key ORDER BY (c.patch_key=(SELECT patch_key FROM chosen)) DESC,p.release_order DESC LIMIT 1
      ) c ON true
    ), exclusions AS (
      SELECT role,games,participants,unknown_role AS "unknownRole",ambiguous_role AS "ambiguousRole",
        missing_opponent AS "missingOpponent",unmapped_champion AS "unmappedChampion"
      FROM matchup_exclusions WHERE source=$2 AND patch_key=(SELECT patch_key FROM chosen) AND role IN ($4,'UNKNOWN')
    ) SELECT (SELECT to_jsonb(champion) FROM champion) AS champion,(SELECT patch_key FROM chosen) AS patch,
      coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (
        SELECT a.patch_key,p.release_order FROM available a JOIN patches p USING(patch_key)
        ORDER BY p.release_order DESC LIMIT 50) p),'[]') AS patches,
      (SELECT count(*)::integer FROM scoped) AS total,(SELECT metrics FROM baseline) AS baseline,
      coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY sort_value ${q.order === "asc" ? "ASC" : "DESC"} NULLS LAST,opponent_key) FROM rows),'[]') AS items,
      coalesce((SELECT jsonb_agg(to_jsonb(exclusions) ORDER BY role) FROM exclusions),'[]') AS exclusions
  `,
      [
        q.champion,
        q.source,
        q.patch ?? null,
        q.role,
        q.sort,
        q.value,
        q.pageSize,
        (q.page - 1) * q.pageSize,
      ],
    )
  ).rows[0]!;
  if (!row.champion) return null;
  return {
    query: q,
    champion: row.champion,
    patch: row.patch,
    patches: row.patches,
    exclusions: row.exclusions,
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
