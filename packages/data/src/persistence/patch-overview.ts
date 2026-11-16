import {
  overviewPatchSchema,
  type PatchOverview,
  type PatchChampion,
  type NewPatchBuild,
} from "../domain/patch-overview.js";
import {
  compareProportions,
  applySamplePolicy,
  defaultSamplePolicy,
  trendMinimumSample,
  trendMinimumOutcomes,
  trendCriticalZ,
} from "../domain/statistics.js";
import type { Executor } from "./database.js";
import { trendScope } from "./trending.js";

interface TrendCounts {
  championKey: number;
  metric: "pick" | "win";
  a: number;
  n: number;
  b: number;
  m: number;
}
interface BuildCounts {
  championKey: number;
  role: NewPatchBuild["role"];
  items: NewPatchBuild["items"];
  games: number;
  currentSample: number;
  previousSample: number;
}
interface ProCounts {
  championKey: number;
  picks: number;
  bans: number;
  games: number;
}
/** All sections use the same aggregate snapshot, with qualification and bounded ranking in SQL. */
export async function patchOverview(db: Executor, input: string): Promise<PatchOverview | null> {
  const patch = overviewPatchSchema.parse(input);
  const row = (
    await db.query<{
      patch: string | null;
      previousPatch: string | null;
      trends: TrendCounts[];
      builds: BuildCounts[];
      pro: ProCounts[];
      champions: PatchChampion[];
    }>(
      `
    WITH ${trendScope},
    metrics AS (
      SELECT p."championKey",v.* FROM pairs p CROSS JOIN LATERAL (VALUES
        ('pick',p."currentPicks",(SELECT games FROM samples WHERE patch_key=$1),
                p."previousPicks",(SELECT games FROM samples WHERE patch_key=(SELECT patch_key FROM prior))),
        ('win',p."currentWins",p."currentResults",p."previousWins",p."previousResults")
      ) v(metric,a,n,b,m)
    ), eligible AS (
      SELECT *,a::double precision/nullif(n,0)-b::double precision/nullif(m,0) AS delta,
        (a::double precision+b)/nullif(n::double precision+m,0) AS pooled
      FROM metrics WHERE n>=${trendMinimumSample} AND m>=${trendMinimumSample}
        AND a>=${trendMinimumOutcomes} AND b>=${trendMinimumOutcomes}
        AND n-a>=${trendMinimumOutcomes} AND m-b>=${trendMinimumOutcomes}
    ), significant AS (
      SELECT *,row_number() OVER(PARTITION BY delta>0 ORDER BY abs(delta) DESC,"championKey",metric) AS rank
      FROM eligible WHERE abs(delta/nullif(sqrt(greatest(0,pooled*(1-pooled)*
        (1.0/nullif(n,0)+1.0/nullif(m,0)))),0))>${trendCriticalZ}
    ), highlights AS (SELECT * FROM significant WHERE rank<=10),
    paths AS (
      SELECT patch_key,champion_key,role,build,sum(games)::integer AS games
      FROM champion_builds WHERE queue='420' AND kind='path'
        AND patch_key IN (SELECT patch_key FROM chosen UNION ALL SELECT patch_key FROM prior)
      GROUP BY patch_key,champion_key,role,build
    ), path_samples AS (
      SELECT patch_key,champion_key,role,sum(games)::integer AS games FROM paths GROUP BY patch_key,champion_key,role
    ), new_paths AS (
      SELECT c.champion_key AS "championKey",c.role,c.build,c.games,
        n.games AS "currentSample",p.games AS "previousSample"
      FROM paths c JOIN path_samples n USING(patch_key,champion_key,role)
      JOIN path_samples p ON p.patch_key=(SELECT patch_key FROM prior) AND p.champion_key=c.champion_key AND p.role=c.role
      WHERE c.patch_key=(SELECT patch_key FROM chosen) AND c.games>=${defaultSamplePolicy.reliable}
        AND p.games>=${defaultSamplePolicy.reliable}
        AND NOT EXISTS(SELECT 1 FROM paths old WHERE old.patch_key=p.patch_key
          AND old.champion_key=c.champion_key AND old.role=c.role AND old.build=c.build)
      ORDER BY c.games DESC,c.champion_key,c.role,c.build LIMIT 10
    ), new_builds AS (
      SELECT b.*, (SELECT jsonb_agg(jsonb_build_object('kind','item','id',id::integer,'catalogId',id,
        'name',c.name,'imageUrl',CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END)
        ORDER BY ord)
        FROM unnest(string_to_array(b.build,',')) WITH ORDINALITY ids(id,ord)
        LEFT JOIN LATERAL (
          SELECT c.name,i.asset_hash FROM catalog_items c JOIN patches p USING(patch_key)
          LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='item' AND i.catalog_id=c.item_id::text
          WHERE c.item_id=id::integer ORDER BY (c.patch_key=$1) DESC,p.release_order DESC LIMIT 1
        ) c ON true) AS items FROM new_paths b
    ), pro_sample AS (
      SELECT sum(league_games)::integer AS games FROM (
        SELECT DISTINCT league,league_games FROM pro_champion_stats WHERE patch_key=$1
      ) s
    ), pro_leaders AS (
      SELECT champion_key AS "championKey",sum(picks)::integer AS picks,sum(bans)::integer AS bans,(SELECT games FROM pro_sample) AS games
      FROM pro_champion_stats WHERE patch_key=$1 GROUP BY champion_key
      HAVING (SELECT games FROM pro_sample)>=${defaultSamplePolicy.minimum}
        AND sum(picks)+sum(bans) BETWEEN 1 AND (SELECT games FROM pro_sample)
      ORDER BY sum(picks)+sum(bans) DESC,champion_key LIMIT 10
    ), selected_keys AS (
      SELECT "championKey" FROM highlights UNION SELECT "championKey" FROM new_paths UNION SELECT "championKey" FROM pro_leaders
    ), names AS (
      SELECT s.*,c.champion_id AS "championId",c.name,
        CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END AS "imageUrl"
      FROM selected_keys s LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=s."championKey" ORDER BY (c.patch_key=$1) DESC,p.release_order DESC LIMIT 1
      ) c ON true
    ) SELECT (SELECT patch_key FROM chosen) AS patch,(SELECT patch_key FROM prior) AS "previousPatch",
      coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY abs(delta) DESC,"championKey",metric) FROM highlights h),'[]') AS trends,
      coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY games DESC,"championKey",role,build) FROM new_builds b),'[]') AS builds,
      coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY picks+bans DESC,"championKey") FROM pro_leaders p),'[]') AS pro,
      coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM names n),'[]') AS champions
  `,
      [patch, "solo", "420", "ALL"],
    )
  ).rows[0]!;
  if (!row.patch) return null;
  const names = new Map(row.champions.map((c) => [c.championKey, c]));
  const trends = row.trends.map((r) => ({
    ...names.get(r.championKey)!,
    metric: r.metric,
    change: compareProportions(r.a, r.n, r.b, r.m),
  }));
  return {
    patch: row.patch,
    previousPatch: row.previousPatch,
    risers: trends.filter((r) => r.change.direction === "rising"),
    fallers: trends.filter((r) => r.change.direction === "falling"),
    builds: row.builds.map((r) => ({
      ...names.get(r.championKey)!,
      role: r.role,
      items: r.items,
      games: r.games,
      share: { value: r.games / r.currentSample, sampleCount: r.currentSample },
      previousSample: r.previousSample,
    })),
    pro: row.pro.map((r) => {
      const presence = applySamplePolicy({
        value: (r.picks + r.bans) / r.games,
        sampleCount: r.games,
      });
      return {
        ...names.get(r.championKey)!,
        picks: r.picks,
        bans: r.bans,
        presence,
        sample: presence.status,
      };
    }),
  };
}
