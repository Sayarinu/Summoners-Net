import type { Pool } from "pg";
import {
  championStatsQuerySchema,
  tierListQuerySchema,
  type TierList,
  type TierListQuery,
  type TierListRow,
  type ChampionStats,
  type ChampionStatsQuery,
  type ChampionStatsRow,
} from "../domain/champion-stats.js";
import { applySamplePolicy, wilsonInterval } from "../domain/statistics.js";
import { transaction, type Executor } from "./database.js";

export type AggregateSource = "solo" | "pro";

export async function markDirty(
  db: Executor,
  source: AggregateSource,
  patchKeys: readonly (string | null)[],
  now: Date,
) {
  const keys = [...new Set(patchKeys.filter((k): k is string => Boolean(k)))];
  if (!keys.length) return;
  await db.query(
    `INSERT INTO aggregate_dirty(source,patch_key,marked_at) SELECT $1,k,$3 FROM unnest($2::text[]) k
     ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at`,
    [source, keys, now],
  );
}
/** Marks every patch with stored facts, so the next run rebuilds all aggregates. */
export async function markAllDirty(db: Executor, now: Date) {
  await db.query(
    `INSERT INTO aggregate_dirty(source,patch_key,marked_at)
     SELECT 'solo',patch_key,$1::timestamptz FROM riot_matches WHERE patch_key IS NOT NULL
     UNION SELECT 'pro',s.patch_key,$1::timestamptz FROM oracle_archive_games g
       JOIN patch_sources s ON s.source='oracle' AND s.source_string=g.patch
       WHERE s.patch_key IS NOT NULL
     UNION SELECT source,patch_key,$1::timestamptz FROM champion_aggregates
     ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at`,
    [now],
  );
}
/** Marks the pro patches of one archive year after an Oracle's Elixir import. */
export async function markOracleYearDirty(db: Executor, year: number, now: Date) {
  await db.query(
    `INSERT INTO aggregate_dirty(source,patch_key,marked_at)
     SELECT DISTINCT 'pro',s.patch_key,$2::timestamptz FROM oracle_archive_games g
       JOIN patch_sources s ON s.source='oracle' AND s.source_string=g.patch
       WHERE g.archive_year=$1 AND s.patch_key IS NOT NULL
     ON CONFLICT(source,patch_key) DO UPDATE SET marked_at=EXCLUDED.marked_at`,
    [year, now],
  );
}
export async function dirtyPatches(db: Executor, limit: number) {
  const rows = await db.query<{ source: AggregateSource; patch_key: string }>(
    "SELECT source,patch_key FROM aggregate_dirty ORDER BY marked_at,source,patch_key LIMIT $1",
    [limit],
  );
  return rows.rows.map((r) => ({ source: r.source, patchKey: r.patch_key }));
}

// Slice: one row per counted game with its queue, region and tier.
const soloGames = `
  SELECT m.match_id AS game_id,coalesce(m.queue_id::text,'unknown') AS queue,i.region,
    coalesce((SELECT e.tier FROM riot_ladder_entries e WHERE e.puuid=i.first_seen_puuid
      ORDER BY e.fetched_at DESC LIMIT 1),'UNKNOWN') AS tier
  FROM riot_matches m JOIN riot_match_ids i USING (match_id)
  WHERE m.patch_key=$1 AND m.remake IS NOT TRUE`;
const soloPicks = `
  SELECT p.match_id AS game_id,p.champion_id AS champion_key,
    CASE WHEN p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY') THEN p.team_position
      ELSE 'UNKNOWN' END AS role,p.win
  FROM riot_match_participants p WHERE p.match_id IN (SELECT game_id FROM games)`;
const soloBans = `
  SELECT DISTINCT b.match_id AS game_id,b.champion_id AS champion_key
  FROM riot_match_bans b WHERE b.match_id IN (SELECT game_id FROM games)`;
// Pro champions resolve through the validated Oracle name mapping to Riot's numeric key.
const proKeys = `
  SELECT DISTINCT ON (n.name) n.name,c.champion_key FROM oracle_champion_names n
  JOIN catalog_champions c ON c.champion_id=n.champion_id ORDER BY n.name,c.observed_at DESC`;
const proGames = `
  SELECT g.id AS game_id,'pro' AS queue,g.source_league AS region,'PRO' AS tier
  FROM oracle_archive_games g
  JOIN patch_sources s ON s.source='oracle' AND s.source_string=g.patch
  WHERE s.patch_key=$1 AND g.summary_eligible`;
const proPicks = `
  SELECT p.game_id,k.champion_key,
    CASE p.position WHEN 'top' THEN 'TOP' WHEN 'jng' THEN 'JUNGLE' WHEN 'mid' THEN 'MIDDLE'
      WHEN 'bot' THEN 'BOTTOM' WHEN 'sup' THEN 'UTILITY' ELSE 'UNKNOWN' END AS role,
    p.result AS win
  FROM oracle_archive_participants p JOIN keys k ON k.name=p.champion
  WHERE p.position<>'team' AND p.game_id IN (SELECT game_id FROM games)`;
const proBans = `
  SELECT DISTINCT p.game_id,k.champion_key FROM oracle_archive_participants p
  CROSS JOIN LATERAL (VALUES (p.draft->>'ban1'),(p.draft->>'ban2'),(p.draft->>'ban3'),
    (p.draft->>'ban4'),(p.draft->>'ban5')) b(name)
  JOIN keys k ON k.name=b.name
  WHERE p.position='team' AND p.game_id IN (SELECT game_id FROM games)`;

/**
 * Rebuilds one source's aggregates for one patch from stored facts, in one transaction, and
 * clears the patch's dirty mark. Returns the number of aggregate rows written.
 */
export async function rebuildPatch(
  pool: Pool,
  source: AggregateSource,
  patchKey: string,
  now: Date,
) {
  const [games, picks, bans] =
    source === "solo" ? [soloGames, soloPicks, soloBans] : [proGames, proPicks, proBans];
  return transaction(pool, async (c) => {
    await c.query("DELETE FROM champion_aggregates WHERE source=$1 AND patch_key=$2", [
      source,
      patchKey,
    ]);
    const inserted = await c.query(
      `WITH ${source === "pro" ? `keys AS (${proKeys}),` : ""}
       games AS (${games}),
       slices AS (SELECT queue,region,tier,count(*)::integer AS n FROM games GROUP BY 1,2,3),
       picks AS (SELECT g.queue,g.region,g.tier,x.champion_key,x.role,x.win
         FROM (${picks}) x JOIN games g USING (game_id)),
       bans AS (SELECT g.queue,g.region,g.tier,x.champion_key,count(*)::integer AS bans
         FROM (${bans}) x JOIN games g USING (game_id) GROUP BY 1,2,3,4),
       by_role AS (
         SELECT queue,region,tier,champion_key,role,count(*)::integer AS games,
           count(win)::integer AS result_games,(count(*) FILTER(WHERE win))::integer AS wins,
           NULL::integer AS bans
         FROM picks GROUP BY 1,2,3,4,5),
       totals AS (
         SELECT coalesce(t.queue,b.queue) AS queue,coalesce(t.region,b.region) AS region,
           coalesce(t.tier,b.tier) AS tier,coalesce(t.champion_key,b.champion_key) AS champion_key,
           'ALL' AS role,coalesce(t.games,0) AS games,coalesce(t.result_games,0) AS result_games,
           coalesce(t.wins,0) AS wins,coalesce(b.bans,0) AS bans
         FROM (SELECT queue,region,tier,champion_key,count(*)::integer AS games,
                 count(win)::integer AS result_games,(count(*) FILTER(WHERE win))::integer AS wins
               FROM picks GROUP BY 1,2,3,4) t
         FULL JOIN bans b ON b.queue=t.queue AND b.region=t.region AND b.tier=t.tier
           AND b.champion_key=t.champion_key)
       INSERT INTO champion_aggregates(source,patch_key,queue,region,tier,champion_key,role,games,
         result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate,built_at)
       SELECT $2,$1,r.queue,r.region,r.tier,r.champion_key,r.role,r.games,r.result_games,r.wins,
         r.bans,s.n,
         CASE WHEN r.result_games>0 THEN r.wins::double precision/r.result_games END,
         CASE WHEN s.n>0 THEN r.games::double precision/s.n END,
         CASE WHEN s.n>0 AND r.bans IS NOT NULL THEN r.bans::double precision/s.n END,$3
       FROM (SELECT * FROM by_role UNION ALL SELECT * FROM totals) r
       JOIN slices s ON s.queue=r.queue AND s.region=r.region AND s.tier=r.tier`,
      [patchKey, source, now],
    );
    await c.query("DELETE FROM aggregate_dirty WHERE source=$1 AND patch_key=$2", [
      source,
      patchKey,
    ]);
    return inserted.rowCount ?? 0;
  });
}

/**
 * Champion statistics for one patch, summed over the filtered queues, regions and tiers in SQL.
 * Every rate carries its sample count and is null without a sample.
 */
export async function championStats(
  db: Executor,
  input: ChampionStatsQuery = {},
): Promise<ChampionStats> {
  const q = championStatsQuerySchema.parse(input);
  const patch =
    q.patch ??
    (
      await db.query<{ patch_key: string }>(
        `SELECT a.patch_key FROM champion_aggregates a JOIN patches p USING (patch_key)
         WHERE a.source=$1 ORDER BY p.release_order DESC LIMIT 1`,
        [q.source],
      )
    ).rows[0]?.patch_key ??
    null;
  if (!patch) return { source: q.source, patch: null, sliceGames: 0, rows: [] };
  const filters = [q.source, patch, q.queue ?? null, q.region ?? null, q.tier ?? null];
  const slice = await db.query<{ n: number }>(
    `SELECT coalesce(sum(n),0)::integer AS n FROM (
       SELECT DISTINCT queue,region,tier,slice_games AS n FROM champion_aggregates
       WHERE source=$1 AND patch_key=$2 AND ($3::text IS NULL OR queue=$3)
         AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)) s`,
    filters,
  );
  const sliceGames = slice.rows[0]!.n;
  const rows = await db.query<{
    champion_key: number;
    role: ChampionStatsRow["role"];
    games: number;
    result_games: number;
    wins: number;
    bans: number | null;
  }>(
    `SELECT champion_key,role,sum(games)::integer AS games,sum(result_games)::integer AS result_games,
       sum(wins)::integer AS wins,sum(bans)::integer AS bans
     FROM champion_aggregates
     WHERE source=$1 AND patch_key=$2 AND ($3::text IS NULL OR queue=$3)
       AND ($4::text IS NULL OR region=$4) AND ($5::text IS NULL OR tier=$5)
       AND role=$6 AND ($7::integer IS NULL OR champion_key=$7)
     GROUP BY champion_key,role ORDER BY sum(games) DESC,champion_key LIMIT $8`,
    [...filters, q.role, q.champion ?? null, q.limit],
  );
  return {
    source: q.source,
    patch,
    sliceGames,
    rows: rows.rows.map((r) => ({
      championKey: r.champion_key,
      role: r.role,
      games: r.games,
      wins: r.wins,
      winRate: wilsonInterval(r.wins, r.result_games),
      pickRate: { value: sliceGames ? r.games / sliceGames : null, sampleCount: sliceGames },
      banRate: {
        value: sliceGames && r.bans !== null ? r.bans / sliceGames : null,
        sampleCount: r.bans === null ? 0 : sliceGames,
      },
    })),
  };
}

export const tierListPageSize = 50;
/**
 * The tier list for one patch: champion rows summed over the filtered regions and tiers, sorted
 * and paginated in SQL. Reads only aggregates and the champion catalog.
 */
export async function tierList(db: Executor, input: TierListQuery = {}): Promise<TierList> {
  const q = tierListQuerySchema.parse(input);
  const patches = (
    await db.query<{ patch_key: string }>(
      `SELECT DISTINCT a.patch_key,p.release_order FROM champion_aggregates a
       JOIN patches p USING (patch_key) WHERE a.source=$1 ORDER BY p.release_order DESC LIMIT 50`,
      [q.source],
    )
  ).rows.map((r) => r.patch_key);
  const patch = q.patch ?? patches[0] ?? null;
  const empty = { items: [], page: q.page, pageSize: tierListPageSize, total: 0 };
  if (!patch)
    return {
      query: q,
      patch: null,
      sliceGames: 0,
      page: empty,
      facets: { patches, regions: [], tiers: [] },
    };
  const facets = (
    await db.query<{ regions: string[]; tiers: string[] }>(
      `SELECT coalesce(array_agg(DISTINCT region ORDER BY region),'{}') AS regions,
         coalesce(array_agg(DISTINCT tier ORDER BY tier),'{}') AS tiers
       FROM champion_aggregates WHERE source=$1 AND patch_key=$2`,
      [q.source, patch],
    )
  ).rows[0]!;
  const filters = [q.source, patch, q.region ?? null, q.tier ?? null];
  const sliceGames = (
    await db.query<{ n: number }>(
      `SELECT coalesce(sum(n),0)::integer AS n FROM (
         SELECT DISTINCT queue,region,tier,slice_games AS n FROM champion_aggregates
         WHERE source=$1 AND patch_key=$2 AND ($3::text IS NULL OR region=$3)
           AND ($4::text IS NULL OR tier=$4)) s`,
      filters,
    )
  ).rows[0]!.n;
  // Sort keys are fixed column names, never user text.
  const sortColumn = { winRate: "win_rate", pickRate: "games", banRate: "bans", games: "games" }[
    q.sort
  ];
  const direction = q.order === "asc" ? "ASC" : "DESC";
  const rows = await db.query<{
    champion_key: number;
    role: TierListRow["role"];
    games: number;
    result_games: number;
    wins: number;
    bans: number | null;
    champion_id: string | null;
    name: string | null;
    asset_hash: string | null;
    total: number;
  }>(
    `WITH summed AS (
       SELECT champion_key,role,sum(games)::integer AS games,
         sum(result_games)::integer AS result_games,sum(wins)::integer AS wins,
         sum(bans)::integer AS bans,
         sum(wins)::double precision/nullif(sum(result_games),0) AS win_rate
       FROM champion_aggregates
       WHERE source=$1 AND patch_key=$2 AND ($3::text IS NULL OR region=$3)
         AND ($4::text IS NULL OR tier=$4) AND role=$5
       GROUP BY champion_key,role),
     names AS (
       SELECT DISTINCT ON (c.champion_key) c.champion_key,c.champion_id,c.name,c.patch_key
       FROM catalog_champions c JOIN patches p USING (patch_key)
       ORDER BY c.champion_key,(c.patch_key=$2) DESC,p.release_order DESC)
     SELECT s.*,n.champion_id,n.name,i.asset_hash,count(*) OVER()::integer AS total
     FROM summed s LEFT JOIN names n USING (champion_key)
     LEFT JOIN catalog_images i ON i.patch_key=n.patch_key AND i.kind='champion'
       AND i.catalog_id=n.champion_id
     ORDER BY s.${sortColumn} ${direction} NULLS LAST,s.champion_key
     LIMIT $6 OFFSET $7`,
    [...filters, q.role, tierListPageSize, (q.page - 1) * tierListPageSize],
  );
  return {
    query: q,
    patch,
    sliceGames,
    facets: { patches, regions: facets.regions, tiers: facets.tiers },
    page: {
      items: rows.rows.map((r) => {
        const winRate = wilsonInterval(r.wins, r.result_games);
        return {
          championKey: r.champion_key,
          championId: r.champion_id,
          name: r.name,
          imageUrl: r.asset_hash ? `/api/images/${r.asset_hash}` : null,
          role: r.role,
          games: r.games,
          wins: r.wins,
          winRate,
          pickRate: { value: sliceGames ? r.games / sliceGames : null, sampleCount: sliceGames },
          banRate: {
            value: sliceGames && r.bans !== null ? r.bans / sliceGames : null,
            sampleCount: r.bans === null ? 0 : sliceGames,
          },
          sample: applySamplePolicy(winRate).status,
        };
      }),
      page: q.page,
      pageSize: tierListPageSize,
      total: rows.rows[0]?.total ?? 0,
    },
  };
}
