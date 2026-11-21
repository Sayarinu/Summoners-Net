import { rebuildMatchups } from "./matchup-writer.js";
import { rebuildBlindability } from "./blindability.js";
import { championPlayers } from "./champion-players.js";
import type { Pool } from "pg";
import {
  championLaneRoles,
  championOverviewQuerySchema,
  defaultPatchMinimumGames,
  championStatsQuerySchema,
  tierFromDelta,
  tierListQuerySchema,
  type ChampionLaneRole,
  type ChampionOverview,
  type ChampionOverviewQuery,
  type TierList,
  type TierListQuery,
  type TierListRow,
  type ChampionStats,
  type ChampionStatsQuery,
  type ChampionStatsRow,
} from "../domain/champion-stats.js";
import {
  applySamplePolicy,
  defaultSamplePolicy,
  fitRatePrior,
  shrinkRate,
  wilsonInterval,
} from "../domain/statistics.js";
import { transaction, type Executor } from "./database.js";
import { championBuilds, rebuildBuilds } from "./builds.js";
import { championBuckets, rebuildBuckets } from "./buckets.js";
import { rebuildJunglePaths } from "./jungle-paths.js";
import { botLaneMatrix, championSynergies, rebuildDuos } from "./duos.js";
import {
  proChampionHistory,
  proChampionStats,
  rebuildProStats,
  splitOf,
  stageOf,
} from "./pro-stats.js";
import { rebuildSoloPerformance, soloChampionPerformance } from "./solo-performance.js";
import { proChampionPlayers } from "./pro-champion-players.js";
import { computeFeatures } from "./wp-features.js";

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
/** Marks the pro patches of one archive year, or of every year, after Oracle data changes. */
export async function markOracleYearDirty(db: Executor, year: number | null, now: Date) {
  await db.query(
    `INSERT INTO aggregate_dirty(source,patch_key,marked_at)
     SELECT DISTINCT 'pro',s.patch_key,$2::timestamptz FROM oracle_archive_games g
       JOIN patch_sources s ON s.source='oracle' AND s.source_string=g.patch
       WHERE ($1::integer IS NULL OR g.archive_year=$1) AND s.patch_key IS NOT NULL
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
  SELECT g.id AS game_id,${stageOf("g")} AS queue,g.source_league AS region,${splitOf("g")} AS tier
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
    // Solo-queue builds come from timelines and are rebuilt with the patch.
    const builds =
      source === "solo"
        ? (await rebuildBuilds(c, patchKey, now)) +
          (await rebuildBuckets(c, patchKey, now)) +
          (await rebuildJunglePaths(c, patchKey, now)) +
          (await rebuildDuos(c, patchKey, now)) +
          (await rebuildSoloPerformance(c, patchKey, soloGames, now)) +
          (await computeFeatures(c, patchKey, now))
        : await rebuildProStats(c, patchKey, now);
    await c.query("DELETE FROM aggregate_dirty WHERE source=$1 AND patch_key=$2", [
      source,
      patchKey,
    ]);
    const matchups = await rebuildMatchups(c, source, patchKey, now);
    return (
      (inserted.rowCount ?? 0) +
      builds +
      matchups +
      (await rebuildBlindability(c, source, patchKey, now))
    );
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

/**
 * The newest patch whose selection has at least the source's minimum games, so statistics do not
 * open on a patch that has barely started. Null when no patch has that many.
 */
export async function defaultPatch(
  db: Executor,
  source: "solo" | "pro",
  region: string | null,
  tier: string | null,
  stage: string | null,
): Promise<string | null> {
  return (
    (
      await db.query<{ patch_key: string }>(
        // Newest first, stopping at the first patch with enough games.
        `SELECT p.patch_key FROM patches p
         CROSS JOIN LATERAL (
           SELECT coalesce(sum(n),0) AS games FROM (
             SELECT DISTINCT queue,region,tier,slice_games AS n FROM champion_aggregates a
             WHERE a.source=$1 AND a.patch_key=p.patch_key AND a.role='ALL'
               AND ($2::text IS NULL OR a.region=$2) AND ($3::text IS NULL OR a.tier=$3)
               AND ($4::text IS NULL OR a.queue=$4)) s) g
         WHERE g.games>=$5 ORDER BY p.release_order DESC LIMIT 1`,
        [source, region, tier, stage, defaultPatchMinimumGames[source]],
      )
    ).rows[0]?.patch_key ?? null
  );
}

/** Known patches among those given, newest first; unknown keys are dropped. */
export async function newestFirst(db: Executor, patches: readonly string[]): Promise<string[]> {
  return (
    await db.query<{ patch_key: string }>(
      "SELECT patch_key FROM patches WHERE patch_key=ANY($1::text[]) ORDER BY release_order DESC",
      [patches],
    )
  ).rows.map((r) => r.patch_key);
}

export const tierListPageSize = 50;
/**
 * The tier list for one patch: champion rows summed over the filtered regions and tiers, sorted
 * and paginated in SQL. Reads only aggregates and the champion catalog.
 */
export async function tierList(
  db: Executor,
  input: TierListQuery = {},
  /** Champions with fewer games of known result and fewer bans are left out and counted. */
  { minimumGames = defaultSamplePolicy.minimum }: { minimumGames?: number } = {},
): Promise<TierList> {
  const q = tierListQuerySchema.parse(input);
  const patches = (
    await db.query<{ patch_key: string }>(
      // Probe each patch through the primary key rather than scanning every aggregate row.
      `SELECT p.patch_key FROM patches p
       WHERE EXISTS (SELECT 1 FROM champion_aggregates a WHERE a.source=$1 AND a.patch_key=p.patch_key)
       ORDER BY p.release_order DESC`,
      [q.source],
    )
  ).rows.map((r) => r.patch_key);
  const stage = q.source === "pro" ? (q.stage ?? null) : null;
  const fallback = q.patch
    ? null
    : ((await defaultPatch(db, q.source, q.region ?? null, q.tier ?? null, stage)) ??
      patches[0] ??
      null);
  const combined = q.patch ? await newestFirst(db, q.patch) : fallback ? [fallback] : [];
  const patch = combined[0] ?? null;
  const empty = { items: [], page: q.page, pageSize: tierListPageSize, total: 0 };
  if (!patch)
    return {
      query: q,
      patch: null,
      combined: [],
      sliceGames: 0,
      minimumGames,
      hiddenChampions: 0,
      page: empty,
      facets: { patches, regions: [], tiers: [] },
    };
  const facets = (
    await db.query<{ regions: string[]; tiers: string[] }>(
      `SELECT coalesce(array_agg(DISTINCT region ORDER BY region),'{}') AS regions,
         coalesce(array_agg(DISTINCT tier ORDER BY tier),'{}') AS tiers
       FROM champion_aggregates WHERE source=$1 AND patch_key=ANY($2::text[])`,
      [q.source, combined],
    )
  ).rows[0]!;
  const filters = [q.source, combined, q.region ?? null, q.tier ?? null];
  const sliceGames = (
    await db.query<{ n: number }>(
      `SELECT coalesce(sum(n),0)::integer AS n FROM (
         SELECT DISTINCT patch_key,queue,region,tier,slice_games AS n FROM champion_aggregates
         WHERE source=$1 AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
           AND ($4::text IS NULL OR tier=$4) AND ($5::text IS NULL OR queue=$5)) s`,
      [...filters, stage],
    )
  ).rows[0]!.n;
  // Sort keys are fixed column names, never user text.
  // The slice's win-rate prior, so each row's tier matches the champion page.
  const prior = fitRatePrior(
    (
      await db.query<{ wins: number; result_games: number }>(
        `SELECT sum(wins)::integer AS wins,sum(result_games)::integer AS result_games
         FROM champion_aggregates WHERE source=$1 AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
           AND ($4::text IS NULL OR tier=$4) AND role=$5 AND ($6::text IS NULL OR queue=$6)
         GROUP BY champion_key`,
        [...filters, q.role, stage],
      )
    ).rows.map((r) => ({ successes: r.wins, trials: r.result_games })),
  );
  const sortColumn = {
    tier: "shrunk",
    winRate: "win_rate",
    pickRate: "games",
    banRate: "bans",
    games: "games",
    kda: "kda",
    damagePerMinute: "dpm",
    goldDiffAt15: "gd15",
  }[q.sort];
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
    hidden: number;
    kda: number | null;
    kda_n: number | null;
    dpm: number | null;
    dpm_n: number | null;
    gd15: number | null;
    gd15_n: number | null;
    shrunk: number | null;
  }>(
    `WITH performance AS (
       -- Per-game averages once picked, in the same league or region, tier and role.
       SELECT champion_key,
         (sum(kills)+sum(assists))/greatest(sum(deaths),1) AS kda_raw,
         sum(kda_n)::integer AS kda_n,
         sum(dpm_sum)/nullif(sum(dpm_n),0) AS dpm,sum(dpm_n)::integer AS dpm_n,
         sum(gd15_sum)/nullif(sum(gd15_n),0) AS gd15,sum(gd15_n)::integer AS gd15_n
       FROM (
         SELECT champion_key,kills,deaths,assists,kda_n,dpm_sum,dpm_n,gd15_sum,gd15_n
         FROM pro_champion_performance
         WHERE $1='pro' AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR league=$3)
           AND ($4::text IS NULL OR split=$4) AND ($10::text IS NULL OR stage=$10)
           AND ($5='ALL' OR role=$5)
         UNION ALL
         SELECT champion_key,kills,deaths,assists,kda_n,dpm_sum,dpm_n,0,0
         FROM solo_champion_performance
         WHERE $1='solo' AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
           AND ($4::text IS NULL OR tier=$4) AND ($5='ALL' OR role=$5)) f
       GROUP BY champion_key),
     summed AS (
       SELECT champion_key,role,sum(games)::integer AS games,
         sum(result_games)::integer AS result_games,sum(wins)::integer AS wins,
         sum(bans)::integer AS bans,
         sum(wins)::double precision/nullif(sum(result_games),0) AS win_rate
       FROM champion_aggregates
       WHERE source=$1 AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
         AND ($4::text IS NULL OR tier=$4) AND role=$5 AND ($10::text IS NULL OR queue=$10)
       GROUP BY champion_key,role),
     names AS (
       SELECT DISTINCT ON (c.champion_key) c.champion_key,c.champion_id,c.name,c.patch_key
       FROM catalog_champions c JOIN patches p USING (patch_key)
       ORDER BY c.champion_key,(c.patch_key=($2::text[])[1]) DESC,p.release_order DESC)
     SELECT s.*,n.champion_id,n.name,i.asset_hash,count(*) OVER()::integer AS total,
       (SELECT count(*)::integer FROM summed
        WHERE result_games<$11 AND coalesce(bans,0)<$11) AS hidden,
       CASE WHEN $8::double precision IS NOT NULL AND s.result_games>0
         THEN (s.wins+$8::double precision*$9::double precision)/(s.result_games+$9::double precision)
       END AS shrunk,
       CASE WHEN f.kda_n>0 THEN f.kda_raw END AS kda,f.kda_n,f.dpm,f.dpm_n,f.gd15,f.gd15_n
     FROM summed s LEFT JOIN names n USING (champion_key)
     LEFT JOIN performance f USING (champion_key)
     LEFT JOIN catalog_images i ON i.patch_key=n.patch_key AND i.kind='champion'
       AND i.catalog_id=n.champion_id
     -- Below the minimum sample a champion's rates are noise, so it is left out of the list,
     -- unless it is banned often enough for its ban rate to matter.
     WHERE s.result_games>=$11 OR coalesce(s.bans,0)>=$11
     ORDER BY ${sortColumn} ${direction} NULLS LAST,s.champion_key
     LIMIT $6 OFFSET $7`,
    [
      ...filters,
      q.role,
      tierListPageSize,
      (q.page - 1) * tierListPageSize,
      prior?.baseline ?? null,
      prior?.strength ?? null,
      stage,
      minimumGames,
    ],
  );
  // Without listed rows the window count is unknown, so count the hidden champions directly.
  const hiddenChampions =
    rows.rows[0]?.hidden ??
    (
      await db.query<{ n: number }>(
        `SELECT count(*)::integer AS n FROM (
           SELECT champion_key FROM champion_aggregates
           WHERE source=$1 AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
             AND ($4::text IS NULL OR tier=$4) AND role=$5 AND ($6::text IS NULL OR queue=$6)
           GROUP BY champion_key,role
           HAVING sum(result_games)<$7 AND coalesce(sum(bans),0)<$7) h`,
        [...filters, q.role, stage, minimumGames],
      )
    ).rows[0]!.n;
  return {
    query: q,
    patch,
    combined,
    sliceGames,
    minimumGames,
    hiddenChampions,
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
          tier: tierFromDelta(r.shrunk !== null && prior ? r.shrunk - prior.baseline : null),
          performance: {
            kda: { value: r.kda, sampleCount: r.kda_n ?? 0 },
            damagePerMinute: { value: r.dpm, sampleCount: r.dpm_n ?? 0 },
            goldDiffAt15: { value: r.gd15, sampleCount: r.gd15_n ?? 0 },
          },
        };
      }),
      page: q.page,
      pageSize: tierListPageSize,
      total: rows.rows[0]?.total ?? 0,
    },
  };
}

/**
 * One champion's statistics for a patch, a tier from its shrunk win rate, and its trend across
 * kept patches. Null when the champion id is not in the catalog. Reads only aggregates.
 */
export async function championOverview(
  db: Executor,
  input: ChampionOverviewQuery,
): Promise<ChampionOverview | null> {
  const q = championOverviewQuerySchema.parse(input);
  const champion = (
    await db.query<{
      champion_id: string;
      champion_key: number;
      name: string;
      asset_hash: string | null;
    }>(
      `SELECT c.champion_id,c.champion_key,c.name,i.asset_hash FROM catalog_champions c
       JOIN patches p USING (patch_key)
       LEFT JOIN catalog_images i ON i.patch_key=c.patch_key AND i.kind='champion'
         AND i.catalog_id=c.champion_id
       WHERE c.champion_id=$1 ORDER BY p.release_order DESC LIMIT 1`,
      [q.champion],
    )
  ).rows[0];
  if (!champion) return null;
  const list = await tierList(db, {
    source: q.source,
    role: q.role,
    ...(q.patch ? { patch: q.patch } : {}),
    ...(q.region ? { region: q.region } : {}),
    ...(q.tier ? { tier: q.tier } : {}),
    ...(q.stage ? { stage: q.stage } : {}),
  });
  const filters = [q.source, q.region ?? null, q.tier ?? null, q.role];
  // On the pro view the page's league filter is its region; the pro sections follow it. On the
  // solo view the pro section keeps its own league choice.
  const proLeague = q.source === "pro" ? (q.region ?? q.league) : q.league;
  // Pro play's stage is its aggregate queue; solo queue is never filtered by it.
  const stage = q.source === "pro" ? (q.stage ?? null) : null;
  // Every champion's results in the slice, for the empirical-Bayes prior.
  const slice = list.patch
    ? (
        await db.query<{
          champion_key: number;
          wins: number;
          result_games: number;
          games: number;
          bans: number | null;
        }>(
          `SELECT champion_key,sum(wins)::integer AS wins,sum(result_games)::integer AS result_games,
             sum(games)::integer AS games,sum(bans)::integer AS bans
           FROM champion_aggregates WHERE source=$1 AND ($2::text IS NULL OR region=$2)
             AND ($3::text IS NULL OR tier=$3) AND role=$4 AND patch_key=ANY($5::text[])
             AND ($6::text IS NULL OR queue=$6)
           GROUP BY champion_key`,
          [...filters, list.combined, stage],
        )
      ).rows
    : [];
  const own = slice.find((r) => r.champion_key === champion.champion_key);
  const prior = fitRatePrior(slice.map((r) => ({ successes: r.wins, trials: r.result_games })));
  const shrunk = shrinkRate(own?.wins ?? 0, own?.result_games ?? 0, prior);
  const shrunkWinRate = own?.result_games ? shrunk : { value: null, sampleCount: 0 };
  // The trend spans the kept solo-queue patches, or the last eight catalog patches.
  const kept =
    q.source === "solo"
      ? ((await db.query<{ kept_patches: string[] }>("SELECT kept_patches FROM riot_retention"))
          .rows[0]?.kept_patches ?? [])
      : [];
  const span = (
    await db.query<{ patch_key: string }>(
      kept.length
        ? "SELECT patch_key FROM patches WHERE patch_key=ANY($1::text[]) ORDER BY release_order"
        : `SELECT patch_key FROM (SELECT patch_key,release_order FROM patches
             WHERE release_order<=coalesce((SELECT release_order FROM patches WHERE patch_key=$1),
               (SELECT max(release_order) FROM patches))
             ORDER BY release_order DESC LIMIT 8) p ORDER BY release_order`,
      [kept.length ? kept : list.patch],
    )
  ).rows.map((r) => r.patch_key);
  const points = new Map(
    (
      await db.query<{
        patch_key: string;
        wins: number;
        result_games: number;
        games: number;
        bans: number | null;
        slice_games: number;
      }>(
        `WITH own AS (
           SELECT patch_key,sum(wins)::integer AS wins,sum(result_games)::integer AS result_games,
             sum(games)::integer AS games,sum(bans)::integer AS bans FROM champion_aggregates
           WHERE source=$1 AND ($2::text IS NULL OR region=$2) AND ($3::text IS NULL OR tier=$3)
             AND role=$4 AND champion_key=$5 AND patch_key=ANY($6::text[])
             AND ($7::text IS NULL OR queue=$7)
           GROUP BY patch_key
         ), slice AS (
           SELECT patch_key,sum(n)::integer AS slice_games FROM (
             SELECT DISTINCT patch_key,queue,region,tier,slice_games AS n FROM champion_aggregates
             WHERE source=$1 AND ($2::text IS NULL OR region=$2) AND ($3::text IS NULL OR tier=$3)
               AND patch_key=ANY($6::text[]) AND ($7::text IS NULL OR queue=$7)) s
           GROUP BY patch_key
         ) SELECT own.*,coalesce(slice.slice_games,0) AS slice_games
           FROM own LEFT JOIN slice USING (patch_key)`,
        [...filters, champion.champion_key, span, stage],
      )
    ).rows.map((r) => [r.patch_key, r]),
  );
  // Games in each lane role, for the role tabs and the default role of the matchup summary.
  const roleGames = list.patch
    ? (
        await db.query<{ role: ChampionLaneRole; games: number }>(
          `SELECT role,sum(games)::integer AS games FROM champion_aggregates
           WHERE source=$1 AND ($2::text IS NULL OR region=$2) AND ($3::text IS NULL OR tier=$3)
             AND role=ANY($4::text[]) AND champion_key=$5 AND patch_key=ANY($6::text[])
             AND ($7::text IS NULL OR queue=$7)
           GROUP BY role HAVING sum(games)>0 ORDER BY games DESC,role`,
          [
            q.source,
            q.region ?? null,
            q.tier ?? null,
            [...championLaneRoles],
            champion.champion_key,
            list.combined,
            stage,
          ],
        )
      ).rows
    : [];
  const laneGames = roleGames.reduce((sum, r) => sum + r.games, 0);
  const winRate = wilsonInterval(own?.wins ?? null, own?.result_games ?? null);
  return {
    query: q,
    champion: {
      id: champion.champion_id,
      key: champion.champion_key,
      name: champion.name,
      imageUrl: champion.asset_hash ? `/api/images/${champion.asset_hash}` : null,
    },
    patch: list.patch,
    combined: list.combined,
    sliceGames: list.sliceGames,
    games: own?.games ?? 0,
    winRate: own ? winRate : { value: null, sampleCount: 0, lower: null, upper: null },
    pickRate: {
      value: list.sliceGames ? (own?.games ?? 0) / list.sliceGames : null,
      sampleCount: list.sliceGames,
    },
    banRate: {
      value: list.sliceGames && own?.bans != null ? own.bans / list.sliceGames : null,
      sampleCount: own?.bans != null ? list.sliceGames : 0,
    },
    shrunkWinRate,
    baseline: prior?.baseline ?? null,
    tier: tierFromDelta(
      shrunkWinRate.value !== null && prior ? shrunkWinRate.value - prior.baseline : null,
    ),
    trend: span.map((patch) => {
      const p = points.get(patch);
      return {
        patch,
        games: p?.games ?? 0,
        winRate: {
          value: p?.result_games ? p.wins / p.result_games : null,
          sampleCount: p?.result_games ?? 0,
        },
        pickRate: {
          value: p?.slice_games ? p.games / p.slice_games : null,
          sampleCount: p?.slice_games ?? 0,
        },
        banRate: {
          value: p?.slice_games && p.bans !== null ? p.bans / p.slice_games : null,
          sampleCount: p?.slice_games && p.bans !== null ? p.slice_games : 0,
        },
      };
    }),
    roles: roleGames.map((r) => ({
      role: r.role,
      games: r.games,
      share: { value: r.games / laneGames, sampleCount: laneGames },
    })),
    facets: list.facets,
    builds:
      q.source === "solo" && list.patch
        ? await championBuilds(db, {
            championKey: champion.champion_key,
            patch: list.patch,
            patches: list.combined,
            role: q.role,
            region: q.region,
            tier: q.tier,
            championGames: own?.games ?? 0,
          })
        : null,
    // Pro play shows with either source: the same patch for pro, otherwise the newest pro patch.
    pro: await proChampionStats(db, {
      championKey: champion.champion_key,
      patch: q.source === "pro" || q.patch ? (list.patch ?? undefined) : undefined,
      patches: q.source === "pro" || q.patch ? list.combined : undefined,
      league: proLeague,
      role: q.role,
      split: q.source === "pro" ? q.tier : undefined,
      stage: q.source === "pro" ? q.stage : undefined,
    }),
    proPlayers:
      q.source === "pro"
        ? await proChampionPlayers(db, {
            championId: champion.champion_id,
            patch: list.patch,
            patches: list.combined,
            league: proLeague,
            split: q.tier,
            stage: q.stage,
          })
        : null,
    performance:
      q.source === "solo" && list.patch
        ? await soloChampionPerformance(db, {
            championKey: champion.champion_key,
            patch: list.patch,
            patches: list.combined,
            region: q.region,
            tier: q.tier,
            role: q.role,
          })
        : null,
    proHistory: await proChampionHistory(db, {
      championKey: champion.champion_key,
      league: proLeague,
      page: q.historyPage,
      split: q.source === "pro" ? q.tier : undefined,
      stage: q.source === "pro" ? q.stage : undefined,
    }),
    players:
      q.source === "solo" && list.patch
        ? await championPlayers(db, {
            championKey: champion.champion_key,
            patch: list.patch,
            patches: list.combined,
            role: q.role,
            region: q.region,
            tier: q.tier,
            sort: q.playersSort,
            page: q.playersPage,
          })
        : null,
    synergies:
      q.source === "solo" && list.patch
        ? await championSynergies(db, {
            championKey: champion.champion_key,
            patch: list.patch,
            patches: list.combined,
            role: q.role,
            region: q.region,
            tier: q.tier,
            sort: q.synergySort,
            page: q.synergyPage,
          })
        : null,
    botLane:
      q.source === "solo" && list.patch
        ? await botLaneMatrix(db, {
            patch: list.patch,
            patches: list.combined,
            region: q.region,
            tier: q.tier,
          })
        : null,
    buckets:
      q.source === "solo" && list.patch
        ? await championBuckets(db, {
            championKey: champion.champion_key,
            patch: list.patch,
            patches: list.combined,
            role: q.role,
            region: q.region,
            tier: q.tier,
          })
        : null,
  };
}
