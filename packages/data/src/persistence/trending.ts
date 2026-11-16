import {
  trendingQuerySchema,
  type TrendingQuery,
  type TrendingChampions,
} from "../domain/trending.js";
import { compareProportions } from "../domain/statistics.js";
import type { Executor } from "./database.js";
interface Counts {
  championKey: number;
  championId: string | null;
  name: string | null;
  imageUrl: string | null;
  currentPicks: number | null;
  currentResults: number | null;
  currentWins: number | null;
  previousPicks: number | null;
  previousResults: number | null;
  previousWins: number | null;
}
export async function trending(db: Executor, input: TrendingQuery): Promise<TrendingChampions> {
  const q = trendingQuerySchema.parse(input);
  const row = (
    await db.query<{
      patch: string | null;
      previousPatch: string | null;
      currentGames: number;
      previousGames: number;
      patches: string[];
      total: number;
      items: Counts[];
    }>(
      `
 WITH chosen AS (
   SELECT p.patch_key,p.release_order FROM patches p WHERE p.patch_key=coalesce($1::text,(
     SELECT a.patch_key FROM champion_aggregates a JOIN patches p USING(patch_key)
     WHERE a.source=$2 AND a.queue=$3 ORDER BY p.release_order DESC LIMIT 1))
 ), prior AS (
   SELECT p.patch_key FROM patches p,chosen c WHERE p.release_order<c.release_order
   ORDER BY p.release_order DESC LIMIT 1
 ), scoped AS (
   SELECT * FROM champion_aggregates WHERE source=$2 AND queue=$3
     AND patch_key IN (SELECT patch_key FROM chosen UNION ALL SELECT patch_key FROM prior)
 ), samples AS (
   SELECT patch_key,sum(slice_games)::integer AS games FROM (
     SELECT DISTINCT patch_key,queue,region,tier,slice_games FROM scoped
   ) s GROUP BY patch_key
 ), grouped AS (
   SELECT patch_key,champion_key,sum(games)::integer AS games,sum(result_games)::integer AS results,sum(wins)::integer AS wins
   FROM scoped WHERE role=$4 GROUP BY patch_key,champion_key
 ), pairs AS (
   SELECT coalesce(c.champion_key,p.champion_key) AS "championKey",
     c.games AS "currentPicks",c.results AS "currentResults",c.wins AS "currentWins",
     p.games AS "previousPicks",p.results AS "previousResults",p.wins AS "previousWins"
   FROM (SELECT * FROM grouped WHERE patch_key=(SELECT patch_key FROM chosen)) c
   FULL JOIN (SELECT * FROM grouped WHERE patch_key=(SELECT patch_key FROM prior)) p USING(champion_key)
 ), selected AS (SELECT * FROM pairs ORDER BY "championKey" LIMIT 50 OFFSET $5),
 rows AS (
   SELECT s.*,n.champion_id AS "championId",n.name,
     CASE WHEN n.asset_hash IS NULL THEN NULL ELSE '/api/images/'||n.asset_hash END AS "imageUrl"
   FROM selected s LEFT JOIN LATERAL (
     SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
     LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
     WHERE c.champion_key=s."championKey"
     ORDER BY (c.patch_key=(SELECT patch_key FROM chosen)) DESC,p.release_order DESC LIMIT 1
   ) n ON true
 ) SELECT (SELECT patch_key FROM chosen) AS patch,(SELECT patch_key FROM prior) AS "previousPatch",
   coalesce((SELECT games FROM samples WHERE patch_key=(SELECT patch_key FROM chosen)),0) AS "currentGames",
   coalesce((SELECT games FROM samples WHERE patch_key=(SELECT patch_key FROM prior)),0) AS "previousGames",
   coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (SELECT patch_key,release_order FROM patches ORDER BY release_order DESC LIMIT 50) p),'[]'::jsonb) AS patches,
   (SELECT count(*)::integer FROM pairs) AS total,
   coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY "championKey") FROM rows),'[]'::jsonb) AS items
 `,
      [q.patch ?? null, q.source, q.source === "solo" ? "420" : "pro", q.role, (q.page - 1) * 50],
    )
  ).rows[0]!;
  // Invalid aggregate numerators cannot define a proportion; retain unknown instead of clamping.
  const numerator = (value: number | null, trials: number | null) =>
    value !== null && trials !== null && value <= trials ? value : null;
  return {
    query: q,
    patch: row.patch,
    previousPatch: row.previousPatch,
    currentGames: row.currentGames,
    previousGames: row.previousGames,
    patches: row.patches,
    page: {
      page: q.page,
      pageSize: 50,
      total: row.total,
      items: row.items.map((r) => ({
        championKey: r.championKey,
        championId: r.championId,
        name: r.name,
        imageUrl: r.imageUrl,
        role: q.role,
        pickRate: compareProportions(
          numerator(r.currentPicks, row.currentGames),
          row.currentGames,
          numerator(r.previousPicks, row.previousGames),
          row.previousGames,
        ),
        winRate: compareProportions(
          numerator(r.currentWins, r.currentResults),
          r.currentResults,
          numerator(r.previousWins, r.previousResults),
          r.previousResults,
        ),
      })),
    },
  };
}
