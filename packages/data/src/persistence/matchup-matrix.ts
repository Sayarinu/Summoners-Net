import {
  matchupMatrixQuerySchema,
  matchupMatrixPageSize,
  matchupEstimate,
  type MatchupMatrixQuery,
  type MatchupMatrix,
  type MetricCounts,
  matchupPairsQuerySchema,
  type MatchupPairs,
  type MatchupPairsQuery,
} from "../domain/matchups.js";
import type { Executor } from "./database.js";
import { matchupPatchScope } from "./matchups.js";

/** Both axes page by games; each selected champion's baseline still includes every opponent. */
export async function matchupMatrix(
  db: Executor,
  input: MatchupMatrixQuery,
): Promise<MatchupMatrix> {
  const q = matchupMatrixQuerySchema.parse(input);
  const row = (
    await db.query<{
      patch: string | null;
      patches: string[];
      total: number;
      rows: MatchupMatrix["rows"];
      columns: MatchupMatrix["columns"];
      cells: {
        championKey: number;
        opponentKey: number;
        games: number;
        value: MetricCounts;
        baseline: MetricCounts;
      }[];
    }>(
      `
    WITH ${matchupPatchScope}, scoped AS (
      SELECT * FROM matchup_aggregates WHERE source=$2 AND patch_key=(SELECT patch_key FROM chosen) AND role=$1
    ), ranked AS (
      SELECT champion_key,sum(games) AS games FROM scoped GROUP BY champion_key
    ), row_keys AS (
      SELECT * FROM ranked ORDER BY games DESC,champion_key LIMIT $5 OFFSET $6
    ), column_keys AS (
      SELECT * FROM ranked ORDER BY games DESC,champion_key LIMIT $5 OFFSET $7
    ), baseline AS (
      SELECT a.champion_key,sum((metrics->$4->>'total')::double precision) AS total,
        sum((metrics->$4->>'count')::integer)::integer AS n
      FROM scoped a JOIN row_keys r USING(champion_key) GROUP BY a.champion_key
    ), named AS (
      SELECT k.champion_key,jsonb_build_object('championKey',k.champion_key,'championId',c.champion_id,
        'name',c.name,'imageUrl',CASE WHEN c.asset_hash IS NULL THEN NULL ELSE '/api/images/'||c.asset_hash END) AS champion
      FROM (SELECT champion_key FROM row_keys UNION SELECT champion_key FROM column_keys) k
      LEFT JOIN LATERAL (
        SELECT c.champion_id,c.name,i.asset_hash FROM catalog_champions c JOIN patches p USING(patch_key)
        LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
        WHERE c.champion_key=k.champion_key
        ORDER BY (c.patch_key=(SELECT patch_key FROM chosen)) DESC,p.release_order DESC LIMIT 1
      ) c ON true
    ), cells AS (
      SELECT r.champion_key AS "championKey",c.champion_key AS "opponentKey",coalesce(a.games,0) AS games,
        coalesce(a.metrics->$4,jsonb_build_object('total',NULL,'count',0)) AS value,
        jsonb_build_object('total',b.total,'count',b.n) AS baseline
      FROM row_keys r CROSS JOIN column_keys c JOIN baseline b ON b.champion_key=r.champion_key
      LEFT JOIN scoped a ON a.champion_key=r.champion_key AND a.opponent_key=c.champion_key
    ) SELECT (SELECT patch_key FROM chosen) AS patch,
      coalesce((SELECT jsonb_agg(patch_key ORDER BY release_order DESC) FROM (
        SELECT a.patch_key,p.release_order FROM available a JOIN patches p USING(patch_key)
        ORDER BY p.release_order DESC LIMIT 50) p),'[]') AS patches,
      (SELECT count(*)::integer FROM ranked) AS total,
      coalesce((SELECT jsonb_agg(n.champion ORDER BY r.games DESC,r.champion_key) FROM row_keys r JOIN named n USING(champion_key)),'[]') AS rows,
      coalesce((SELECT jsonb_agg(n.champion ORDER BY c.games DESC,c.champion_key) FROM column_keys c JOIN named n USING(champion_key)),'[]') AS columns,
      coalesce((SELECT jsonb_agg(to_jsonb(cells) ORDER BY "championKey","opponentKey") FROM cells),'[]') AS cells
  `,
      [
        q.role,
        q.source,
        q.patch ? [q.patch] : null,
        q.metric,
        matchupMatrixPageSize,
        (q.page - 1) * matchupMatrixPageSize,
        (q.columnPage - 1) * matchupMatrixPageSize,
      ],
    )
  ).rows[0]!;
  return {
    ...row,
    query: q,
    pageSize: matchupMatrixPageSize,
    cells: row.cells.map(({ value, baseline, ...cell }) => ({
      ...cell,
      estimate: matchupEstimate(value, baseline),
    })),
  };
}

/** All observed pairs in one role, paged in SQL; baselines pool each champion's opponents. */
export async function matchupPairs(db: Executor, input: MatchupPairsQuery): Promise<MatchupPairs> {
  const q = matchupPairsQuerySchema.parse(input);
  const row = (
    await db.query<{
      patch: string | null;
      total: number;
      items: {
        champion: MatchupPairs["page"]["items"][number]["champion"];
        opponent: MatchupPairs["page"]["items"][number]["champion"];
        games: number;
        value: MetricCounts;
        baseline: MetricCounts;
      }[];
    }>(
      `
    WITH ${matchupPatchScope}, scoped AS (
      SELECT * FROM matchup_aggregates WHERE source=$2 AND patch_key=(SELECT patch_key FROM chosen) AND role=$1
    ), selected AS (
      SELECT * FROM scoped ORDER BY champion_key,opponent_key LIMIT $5 OFFSET $6
    ), baseline AS (
      SELECT a.champion_key,sum((metrics->$4->>'total')::double precision) AS total,
        sum((metrics->$4->>'count')::integer)::integer AS n
      FROM scoped a WHERE a.champion_key IN (SELECT champion_key FROM selected) GROUP BY a.champion_key
    ), named AS (
      SELECT DISTINCT ON (c.champion_key) c.champion_key,jsonb_build_object('championKey',c.champion_key,
        'championId',c.champion_id,'name',c.name,
        'imageUrl',CASE WHEN i.asset_hash IS NULL THEN NULL ELSE '/api/images/'||i.asset_hash END) AS champion
      FROM catalog_champions c JOIN patches p USING(patch_key)
      LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion' AND i.catalog_id=c.champion_id
      WHERE c.champion_key IN (SELECT champion_key FROM selected UNION SELECT opponent_key FROM selected)
      ORDER BY c.champion_key,(c.patch_key=(SELECT patch_key FROM chosen)) DESC,p.release_order DESC
    )
    SELECT (SELECT patch_key FROM chosen) AS patch,(SELECT count(*)::integer FROM scoped) AS total,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'champion',coalesce(c.champion,jsonb_build_object('championKey',s.champion_key,'championId',NULL,'name',NULL,'imageUrl',NULL)),
        'opponent',coalesce(o.champion,jsonb_build_object('championKey',s.opponent_key,'championId',NULL,'name',NULL,'imageUrl',NULL)),
        'games',s.games,
        'value',coalesce(s.metrics->$4,jsonb_build_object('total',NULL,'count',0)),
        'baseline',jsonb_build_object('total',b.total,'count',b.n)) ORDER BY s.champion_key,s.opponent_key)
        FROM selected s JOIN baseline b USING(champion_key)
        LEFT JOIN named c ON c.champion_key=s.champion_key LEFT JOIN named o ON o.champion_key=s.opponent_key),'[]') AS items
  `,
      [
        q.role,
        q.source,
        q.patch ? [q.patch] : null,
        q.metric,
        q.pageSize,
        (q.page - 1) * q.pageSize,
      ],
    )
  ).rows[0]!;
  return {
    query: q,
    patch: row.patch,
    page: {
      page: q.page,
      pageSize: q.pageSize,
      total: row.total,
      items: row.items.map(({ value, baseline, ...pair }) => ({
        ...pair,
        estimate: matchupEstimate(value, baseline),
      })),
    },
  };
}
