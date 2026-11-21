import type { PoolClient } from "pg";
import {
  proHistoryPageSize,
  type ProChampionPerformance,
  type ProChampionStats,
  type ProPatchHistory,
} from "../domain/pro-stats.js";
import type { Executor } from "./database.js";

/** A game's split, or 'Unknown' when the archive did not record one. */
export const splitOf = (g: string) => `coalesce(nullif(trim(${g}.split),''),'Unknown')`;
/** A game's stage: 'playoffs', 'regular', or 'unknown' when the archive did not record it. */
export const stageOf = (g: string) =>
  `CASE ${g}.playoffs WHEN true THEN 'playoffs' WHEN false THEN 'regular' ELSE 'unknown' END`;

const scope = `
  scoped AS (
    SELECT g.id,g.source_league AS league,${splitOf("g")} AS split,${stageOf("g")} AS stage,
      d.events FROM oracle_archive_games g
    JOIN patch_sources p ON p.source='oracle' AND p.source_string=g.patch
    JOIN oracle_draft_games d ON d.game_id=g.id AND d.artifact_hash=g.artifact_hash
    WHERE p.patch_key=$1 AND d.excluded_reason IS NULL),
  events AS (
    SELECT s.id,s.league,s.split,s.stage,e.* FROM scoped s CROSS JOIN LATERAL jsonb_to_recordset(s.events)
      AS e(champion text,action text,side text,blind boolean)),
  keys AS (
    SELECT DISTINCT ON (n.name) n.name,c.champion_key FROM oracle_champion_names n
    JOIN catalog_champions c ON c.champion_id=n.champion_id ORDER BY n.name,c.observed_at DESC),
  results AS (
    SELECT game_id,side,result FROM oracle_archive_participants WHERE position='team')`;

/** Rebuilds one patch's pro draft statistics inside the caller's transaction. */
export async function rebuildProStats(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM pro_champion_stats WHERE patch_key=$1", [patchKey]);
  await c.query("DELETE FROM pro_league_games WHERE patch_key=$1", [patchKey]);
  await c.query(
    `WITH ${scope}
     INSERT INTO pro_league_games(patch_key,league,split,stage,games)
     SELECT $1,league,split,stage,count(*)::integer FROM scoped GROUP BY league,split,stage`,
    [patchKey],
  );
  await c.query("DELETE FROM pro_unmapped_drafts WHERE patch_key=$1", [patchKey]);
  await c.query(
    `WITH ${scope}
     INSERT INTO pro_unmapped_drafts(patch_key,league,split,stage,name,picks,bans)
     SELECT $1,e.league,e.split,e.stage,e.champion,count(*) FILTER(WHERE e.action='pick'),
       count(*) FILTER(WHERE e.action='ban')
     FROM events e LEFT JOIN keys k ON k.name=e.champion
     WHERE k.name IS NULL AND e.champion IS NOT NULL
     GROUP BY e.league,e.split,e.stage,e.champion`,
    [patchKey],
  );
  await rebuildProPerformance(c, patchKey, now);
  const inserted = await c.query(
    `WITH ${scope},
     league_games AS (
       SELECT league,split,stage,count(*)::integer AS games FROM scoped GROUP BY league,split,stage),
     joined AS (
       SELECT e.*,k.champion_key,r.result FROM events e JOIN keys k ON k.name=e.champion
       LEFT JOIN results r ON r.game_id=e.id AND r.side=e.side)
     INSERT INTO pro_champion_stats(patch_key,league,split,stage,champion_key,league_games,picks,bans,
       result_picks,wins,blue_picks,blue_result_picks,blue_wins,red_picks,red_result_picks,red_wins,
       blind_picks,counter_picks,built_at)
     SELECT $1,j.league,j.split,j.stage,j.champion_key,max(l.games),
       count(*) FILTER(WHERE action='pick'),count(*) FILTER(WHERE action='ban'),
       count(result) FILTER(WHERE action='pick'),count(*) FILTER(WHERE action='pick' AND result),
       count(*) FILTER(WHERE action='pick' AND side='blue'),
       count(result) FILTER(WHERE action='pick' AND side='blue'),
       count(*) FILTER(WHERE action='pick' AND side='blue' AND result),
       count(*) FILTER(WHERE action='pick' AND side='red'),
       count(result) FILTER(WHERE action='pick' AND side='red'),
       count(*) FILTER(WHERE action='pick' AND side='red' AND result),
       count(*) FILTER(WHERE action='pick' AND blind),
       count(*) FILTER(WHERE action='pick' AND blind IS FALSE),$2
     FROM joined j JOIN league_games l USING (league,split,stage)
     GROUP BY j.league,j.split,j.stage,j.champion_key`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

const number = (key: string) =>
  `CASE WHEN jsonb_typeof(p.statistics->'${key}')='number' THEN (p.statistics->>'${key}')::double precision END`;
/** Each averaged metric: its column prefix and per-player value. */
const performanceMetrics: [string, string][] = [
  ["cspm", number("cspm")],
  ["gpm", `p.total_gold/nullif(${number("gamelength")}/60.0,0)`],
  ["dpm", number("dpm")],
  ["damage_share", number("damageshare")],
  ["gd15", number("golddiffat15")],
  ["csd15", number("csdiffat15")],
  ["xpd15", number("xpdiffat15")],
  [
    "first_blood",
    `CASE WHEN ${number("firstbloodkill")} IS NOT NULL AND ${number("firstbloodassist")} IS NOT NULL
       THEN (${number("firstbloodkill")}+${number("firstbloodassist")}>0)::integer END`,
  ],
  ["vspm", number("vspm")],
  ["game_length", number("gamelength")],
];

/** Rebuilds one patch's pro champion performance from each player's archive row. */
async function rebuildProPerformance(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM pro_champion_performance WHERE patch_key=$1", [patchKey]);
  const kda = "p.kills IS NOT NULL AND p.deaths IS NOT NULL AND p.assists IS NOT NULL";
  const teamKills = number("teamkills");
  await c.query(
    `WITH ${scope},
     players AS (
       SELECT s.league,s.split,s.stage,k.champion_key,p.*,
         CASE p.position WHEN 'top' THEN 'TOP' WHEN 'jng' THEN 'JUNGLE' WHEN 'mid' THEN 'MIDDLE'
           WHEN 'bot' THEN 'BOTTOM' WHEN 'sup' THEN 'UTILITY' END AS lane
       FROM scoped s JOIN oracle_archive_participants p ON p.game_id=s.id
       JOIN keys k ON k.name=p.champion
       WHERE p.position IN ('top','jng','mid','bot','sup'))
     INSERT INTO pro_champion_performance(patch_key,league,split,stage,role,champion_key,games,
       result_games,wins,
       kills,deaths,assists,kda_n,kp_takedowns,kp_team_kills,kp_n,
       ${performanceMetrics.map(([m]) => `${m}_sum,${m}_n`).join(",")},built_at)
     SELECT $1,p.league,p.split,p.stage,p.lane,p.champion_key,count(*)::integer,
       count(p.result)::integer,count(*) FILTER(WHERE p.result)::integer,
       coalesce(sum(p.kills) FILTER(WHERE ${kda}),0),coalesce(sum(p.deaths) FILTER(WHERE ${kda}),0),
       coalesce(sum(p.assists) FILTER(WHERE ${kda}),0),(count(*) FILTER(WHERE ${kda}))::integer,
       coalesce(sum(p.kills+p.assists) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL),0),
       coalesce(sum(${teamKills}) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL),0),
       (count(*) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL))::integer,
       ${performanceMetrics.map(([, v]) => `coalesce(sum(${v}),0),count(${v})::integer`).join(",")},$2
     FROM players p GROUP BY p.league,p.split,p.stage,p.lane,p.champion_key`,
    [patchKey, now],
  );
}

const rate = (count: number, total: number) => ({
  value: total ? count / total : null,
  sampleCount: total,
});
/**
 * A champion's pro-play use on a patch, summed over leagues unless one is chosen. The patch
 * defaults to the newest with pro draft statistics.
 */
export async function proChampionStats(
  db: Executor,
  input: {
    championKey: number;
    patch?: string | undefined;
    league?: string | undefined;
    role?: string | undefined;
    split?: string | undefined;
    stage?: string | undefined;
  },
): Promise<ProChampionStats> {
  const patch =
    input.patch ??
    (
      await db.query<{ patch_key: string }>(
        `SELECT p.patch_key FROM patches p
         WHERE EXISTS (SELECT 1 FROM pro_champion_stats s WHERE s.patch_key=p.patch_key)
         ORDER BY p.release_order DESC LIMIT 1`,
      )
    ).rows[0]?.patch_key ??
    null;
  const leagues = patch
    ? (
        await db.query<{ league: string }>(
          "SELECT DISTINCT league FROM pro_league_games WHERE patch_key=$1 ORDER BY league",
          [patch],
        )
      ).rows.map((r) => r.league)
    : [];
  const filters = [patch, input.league ?? null, input.split ?? null, input.stage ?? null];
  const splits = patch
    ? (
        await db.query<{ split: string }>(
          `SELECT DISTINCT split FROM pro_league_games
           WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2) AND split<>'Unknown'
           ORDER BY split`,
          [patch, input.league ?? null],
        )
      ).rows.map((r) => r.split)
    : [];
  const games = patch
    ? (
        await db.query<{ n: number }>(
          `SELECT coalesce(sum(games),0)::integer AS n FROM pro_league_games
           WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2) AND ($3::text IS NULL OR split=$3) AND ($4::text IS NULL OR stage=$4)`,
          filters,
        )
      ).rows[0]!.n
    : 0;
  const s = patch
    ? (
        await db.query<Record<string, number>>(
          `SELECT coalesce(sum(picks),0)::integer AS picks,coalesce(sum(bans),0)::integer AS bans,
             coalesce(sum(result_picks),0)::integer AS result_picks,
             coalesce(sum(wins),0)::integer AS wins,
             coalesce(sum(blue_picks),0)::integer AS blue_picks,
             coalesce(sum(blue_result_picks),0)::integer AS blue_result_picks,
             coalesce(sum(blue_wins),0)::integer AS blue_wins,
             coalesce(sum(red_picks),0)::integer AS red_picks,
             coalesce(sum(red_result_picks),0)::integer AS red_result_picks,
             coalesce(sum(red_wins),0)::integer AS red_wins,
             coalesce(sum(blind_picks),0)::integer AS blind_picks,
             coalesce(sum(counter_picks),0)::integer AS counter_picks
           FROM pro_champion_stats WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2)
             AND ($3::text IS NULL OR split=$3) AND ($4::text IS NULL OR stage=$4) AND champion_key=$5`,
          [...filters, input.championKey],
        )
      ).rows[0]!
    : {};
  const n = (k: string) => s[k] ?? 0;
  const unmapped = patch
    ? (
        await db.query<{ name: string; picks: number; bans: number }>(
          `SELECT name,sum(picks)::integer AS picks,sum(bans)::integer AS bans
           FROM pro_unmapped_drafts WHERE patch_key=$1 AND ($2::text IS NULL OR league=$2)
             AND ($3::text IS NULL OR split=$3) AND ($4::text IS NULL OR stage=$4)
           GROUP BY name ORDER BY name LIMIT 50`,
          filters,
        )
      ).rows
    : [];
  const ordered = n("blind_picks") + n("counter_picks");
  return {
    patch,
    league: input.league ?? null,
    leagues,
    split: input.split ?? null,
    stage: input.stage ?? null,
    splits,
    games,
    picks: n("picks"),
    bans: n("bans"),
    presence: rate(n("picks") + n("bans"), games),
    pickRate: rate(n("picks"), games),
    banRate: rate(n("bans"), games),
    winRate: rate(n("wins"), n("result_picks")),
    sides: [
      {
        side: "blue",
        picks: n("blue_picks"),
        winRate: rate(n("blue_wins"), n("blue_result_picks")),
      },
      { side: "red", picks: n("red_picks"), winRate: rate(n("red_wins"), n("red_result_picks")) },
    ],
    blindRate: rate(n("blind_picks"), ordered),
    counterRate: rate(n("counter_picks"), ordered),
    unmapped,
    performance: await proChampionPerformance(db, {
      championKey: input.championKey,
      patch,
      league: input.league,
      role: input.role,
      split: input.split,
      stage: input.stage,
    }),
  };
}

const lanes = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
/** A champion's per-game pro averages on one patch; every role when `role` is not a lane. */
export async function proChampionPerformance(
  db: Executor,
  input: {
    championKey: number;
    patch: string | null;
    league?: string | undefined;
    role?: string | undefined;
    split?: string | undefined;
    stage?: string | undefined;
  },
): Promise<ProChampionPerformance> {
  const role = input.role && lanes.has(input.role) ? input.role : null;
  const sums = input.patch
    ? (
        await db.query<Record<string, number | null>>(
          `SELECT sum(games)::integer AS games,sum(kills) AS kills,sum(deaths) AS deaths,
             sum(assists) AS assists,sum(kda_n)::integer AS kda_n,sum(kp_takedowns) AS kp_takedowns,
             sum(kp_team_kills) AS kp_team_kills,sum(kp_n)::integer AS kp_n,
             ${performanceMetrics.map(([m]) => `sum(${m}_sum) AS ${m}_sum,sum(${m}_n)::integer AS ${m}_n`).join(",")}
           FROM pro_champion_performance
           WHERE champion_key=$1 AND patch_key=$2 AND ($3::text IS NULL OR league=$3)
             AND ($4::text IS NULL OR role=$4) AND ($5::text IS NULL OR split=$5)
             AND ($6::text IS NULL OR stage=$6)`,
          [
            input.championKey,
            input.patch,
            input.league ?? null,
            role,
            input.split ?? null,
            input.stage ?? null,
          ],
        )
      ).rows[0]!
    : {};
  const n = (key: string) => Number(sums[key] ?? 0);
  const mean = (metric: string) => ({
    value: n(`${metric}_n`) ? n(`${metric}_sum`) / n(`${metric}_n`) : null,
    sampleCount: n(`${metric}_n`),
  });
  const perGame = (key: string) => ({
    value: n("kda_n") ? n(key) / n("kda_n") : null,
    sampleCount: n("kda_n"),
  });
  return {
    games: n("games"),
    kda: {
      value: n("kda_n") ? (n("kills") + n("assists")) / Math.max(n("deaths"), 1) : null,
      sampleCount: n("kda_n"),
    },
    killsPerGame: perGame("kills"),
    deathsPerGame: perGame("deaths"),
    assistsPerGame: perGame("assists"),
    killParticipation: {
      value: n("kp_n") && n("kp_team_kills") ? n("kp_takedowns") / n("kp_team_kills") : null,
      sampleCount: n("kp_n"),
    },
    csPerMinute: mean("cspm"),
    goldPerMinute: mean("gpm"),
    damagePerMinute: mean("dpm"),
    damageShare: mean("damage_share"),
    goldDiffAt15: mean("gd15"),
    csDiffAt15: mean("csd15"),
    xpDiffAt15: mean("xpd15"),
    firstBloodParticipation: mean("first_blood"),
    visionScorePerMinute: mean("vspm"),
    gameLength: mean("game_length"),
  };
}

/**
 * A champion's pro play on every patch it was picked or banned, newest first. The page is chosen
 * from the champion's own rows (indexed by champion and patch); each page's game totals are then
 * read for its patches only, through the primary key.
 */
export async function proChampionHistory(
  db: Executor,
  input: {
    championKey: number;
    league?: string | undefined;
    page?: number | undefined;
    split?: string | undefined;
    stage?: string | undefined;
  },
): Promise<ProPatchHistory> {
  const page = input.page ?? 1;
  const league = input.league ?? null;
  const rows = (
    await db.query<{
      patch_key: string;
      total: number;
      picks: number;
      bans: number;
      result_picks: number;
      wins: number;
      blue_result_picks: number;
      blue_wins: number;
      red_result_picks: number;
      red_wins: number;
    }>(
      `SELECT s.patch_key,count(*) OVER()::integer AS total,
         sum(picks)::integer AS picks,sum(bans)::integer AS bans,
         sum(result_picks)::integer AS result_picks,sum(wins)::integer AS wins,
         sum(blue_result_picks)::integer AS blue_result_picks,sum(blue_wins)::integer AS blue_wins,
         sum(red_result_picks)::integer AS red_result_picks,sum(red_wins)::integer AS red_wins
       FROM pro_champion_stats s JOIN patches p USING (patch_key)
       WHERE s.champion_key=$1 AND ($2::text IS NULL OR s.league=$2)
         AND ($5::text IS NULL OR s.split=$5) AND ($6::text IS NULL OR s.stage=$6)
       GROUP BY s.patch_key,p.release_order
       HAVING sum(picks)+sum(bans)>0
       ORDER BY p.release_order DESC
       LIMIT $3 OFFSET $4`,
      [
        input.championKey,
        league,
        proHistoryPageSize,
        (page - 1) * proHistoryPageSize,
        input.split ?? null,
        input.stage ?? null,
      ],
    )
  ).rows;
  const games = new Map(
    rows.length
      ? (
          await db.query<{ patch_key: string; games: number }>(
            `SELECT patch_key,sum(games)::integer AS games FROM pro_league_games
             WHERE patch_key=ANY($1::text[]) AND ($2::text IS NULL OR league=$2)
               AND ($3::text IS NULL OR split=$3) AND ($4::text IS NULL OR stage=$4)
             GROUP BY patch_key`,
            [rows.map((r) => r.patch_key), league, input.split ?? null, input.stage ?? null],
          )
        ).rows.map((r) => [r.patch_key, r.games])
      : [],
  );
  return {
    league,
    page: {
      page,
      pageSize: proHistoryPageSize,
      total: rows[0]?.total ?? 0,
      items: rows.map((r) => {
        const total = games.get(r.patch_key) ?? 0;
        return {
          patch: r.patch_key,
          games: total,
          picks: r.picks,
          bans: r.bans,
          presence: rate(r.picks + r.bans, total),
          pickRate: rate(r.picks, total),
          banRate: rate(r.bans, total),
          winRate: rate(r.wins, r.result_picks),
          blueWinRate: rate(r.blue_wins, r.blue_result_picks),
          redWinRate: rate(r.red_wins, r.red_result_picks),
        };
      }),
    },
  };
}
