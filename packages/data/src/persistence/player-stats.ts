import type { Executor } from "./database.js";
import type { SampledValue } from "../domain/historical.js";
import {
  championPoolPageSize,
  championPoolQuerySchema,
  type ChampionPool,
  type ChampionPoolQuery,
  type PlayerPerformance,
  type PlayerSeason,
} from "../domain/player-performance.js";

const leagueOrder = "league IN ('Worlds','MSI','First Stand','EWC'), last_played DESC, league";

/** The seasons a player entity appeared in, newest first, with one competition per year. */
export async function playerSeasons(db: Executor, entityId: string): Promise<PlayerSeason[]> {
  return (
    await db.query<PlayerSeason>(
      `SELECT DISTINCT ON (year) year,league FROM (
        SELECT g.year,g.league,max(g.occurred_at) AS last_played
        FROM entity_members m
        JOIN participants p ON p.player_id=m.id
        JOIN games g ON g.id=p.game_id
        WHERE m.entity_id=$1
        GROUP BY g.year,g.league
      ) seasons ORDER BY year DESC,${leagueOrder}`,
      [entityId],
    )
  ).rows;
}

const statistic = (key: string) => `(o.statistics->>'${key}')::double precision`;
const kda = "p.kills IS NOT NULL AND p.deaths IS NOT NULL AND p.assists IS NOT NULL";
const teamKills = statistic("teamkills");
const minutes = "a.duration_seconds/60.0";
/** Every metric as [name, value expression, sample expression]; averages skip missing games. */
const metrics: [keyof PlayerPerformance, string, string][] = [
  ["killsPerGame", `avg(p.kills) FILTER(WHERE ${kda})`, `count(*) FILTER(WHERE ${kda})`],
  ["deathsPerGame", `avg(p.deaths) FILTER(WHERE ${kda})`, `count(*) FILTER(WHERE ${kda})`],
  ["assistsPerGame", `avg(p.assists) FILTER(WHERE ${kda})`, `count(*) FILTER(WHERE ${kda})`],
  [
    "killParticipation",
    `sum(p.kills+p.assists) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL)
      /nullif(sum(${teamKills}) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL),0)`,
    `count(*) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL)`,
  ],
  ...(
    [
      ["csPerMinute", "cspm"],
      ["goldShare", "earnedgoldshare"],
      ["damagePerMinute", "dpm"],
      ["damageShare", "damageshare"],
      ["visionScorePerMinute", "vspm"],
      ["wardsPerMinute", "wpm"],
      ["wardsClearedPerMinute", "wcpm"],
      ["controlWardsPerGame", "controlwardsbought"],
      ["goldDiffAt15", "golddiffat15"],
      ["csDiffAt15", "csdiffat15"],
      ["xpDiffAt15", "xpdiffat15"],
      ["firstBloodVictim", "firstbloodvictim"],
    ] as const
  ).map(([name, key]): [keyof PlayerPerformance, string, string] => [
    name,
    `avg(${statistic(key)})`,
    `count(${statistic(key)})`,
  ]),
  [
    "goldPerMinute",
    `avg(o.total_gold/(${minutes})) FILTER(WHERE a.duration_seconds>0)`,
    `count(o.total_gold) FILTER(WHERE a.duration_seconds>0)`,
  ],
  [
    "firstBloodParticipation",
    `avg((${statistic("firstbloodkill")}+${statistic("firstbloodassist")}>0)::integer)`,
    `count(${statistic("firstbloodkill")}+${statistic("firstbloodassist")})`,
  ],
  ["pentakills", `sum(${statistic("pentakills")})`, `count(${statistic("pentakills")})`],
];

/**
 * Aggregates the player's Oracle statistics for the games matching `where`, which may reference
 * only `games` columns. The player's own archive row supplies every per-game value.
 */
export async function playerPerformance(
  db: Executor,
  entityId: string,
  where: string,
  values: unknown[],
): Promise<PlayerPerformance> {
  const parameter = `$${values.length + 1}`;
  const row = (
    await db.query<Record<string, unknown>>(
      `WITH played AS (
        SELECT p.*,games.archive_game_id
        FROM participants p
        JOIN games ON games.id=p.game_id
        WHERE ${where} AND p.role<>'team'
          AND p.player_id IN (SELECT id FROM entity_members WHERE entity_id=${parameter})
      )
      SELECT count(*)::integer AS games,
        ${metrics.map(([name, value, sample]) => `${value} AS "${name}",(${sample})::integer AS "${name}_n"`).join(",")}
      FROM played p
      LEFT JOIN oracle_archive_participants o ON o.game_id=p.archive_game_id AND o.slot=p.slot
      LEFT JOIN oracle_archive_games a ON a.id=p.archive_game_id`,
      [...values, entityId],
    )
  ).rows[0]!;
  const sampled = (name: string): SampledValue => ({
    value: row[name] == null ? null : Number(row[name]),
    sampleCount: Number(row[`${name}_n`]),
  });
  return {
    games: Number(row.games),
    ...Object.fromEntries(metrics.map(([name]) => [name, sampled(name)])),
  } as PlayerPerformance;
}

/**
 * The champions a player entity played in the games matching `where` (which may reference only
 * `games` columns), each with its record and per-game statistics. Sorted and paginated in SQL.
 */
export async function playerChampionPool(
  db: Executor,
  entityId: string,
  where: string,
  values: unknown[],
  input: ChampionPoolQuery = {},
): Promise<ChampionPool> {
  const q = championPoolQuerySchema.parse(input);
  const entity = `$${values.length + 1}`;
  const limit = `$${values.length + 2}`;
  const offset = `$${values.length + 3}`;
  // Sort keys are fixed expressions, never user text.
  const order = {
    games: "games DESC",
    winRate: "win_rate DESC NULLS LAST,games DESC",
    kda: "kda DESC NULLS LAST,games DESC",
    damagePerMinute: "dpm DESC NULLS LAST,games DESC",
    goldDiffAt15: "gd15 DESC NULLS LAST,games DESC",
  }[q.poolSort];
  const rows = (
    await db.query<Record<string, string | number | null>>(
      `WITH played AS (
        SELECT p.*,games.archive_game_id
        FROM participants p JOIN games ON games.id=p.game_id
        WHERE ${where} AND p.role<>'team' AND p.champion IS NOT NULL
          AND p.player_id IN (SELECT id FROM entity_members WHERE entity_id=${entity})
      ),
      pool AS (
        SELECT p.champion,count(*)::integer AS games,
          (count(*) FILTER(WHERE p.won))::integer AS wins,
          (count(p.won))::integer AS result_games,
          (count(*) FILTER(WHERE p.won))::double precision/nullif(count(p.won),0) AS win_rate,
          CASE WHEN count(*) FILTER(WHERE ${kda})>0 THEN
            (sum(p.kills+p.assists) FILTER(WHERE ${kda}))::double precision
              /greatest(sum(p.deaths) FILTER(WHERE ${kda}),1) END AS kda,
          (count(*) FILTER(WHERE ${kda}))::integer AS kda_n,
          sum(p.kills+p.assists) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL)
            /nullif(sum(${teamKills}) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL),0) AS kp,
          (count(*) FILTER(WHERE ${kda} AND ${teamKills} IS NOT NULL))::integer AS kp_n,
          avg(${statistic("cspm")}) AS cspm,count(${statistic("cspm")})::integer AS cspm_n,
          avg(o.total_gold/(${minutes})) FILTER(WHERE a.duration_seconds>0) AS gpm,
          (count(o.total_gold) FILTER(WHERE a.duration_seconds>0))::integer AS gpm_n,
          avg(${statistic("dpm")}) AS dpm,count(${statistic("dpm")})::integer AS dpm_n,
          avg(${statistic("golddiffat15")}) AS gd15,
          count(${statistic("golddiffat15")})::integer AS gd15_n,
          avg(${statistic("csdiffat15")}) AS csd15,
          count(${statistic("csdiffat15")})::integer AS csd15_n
        FROM played p
        LEFT JOIN oracle_archive_participants o ON o.game_id=p.archive_game_id AND o.slot=p.slot
        LEFT JOIN oracle_archive_games a ON a.id=p.archive_game_id
        GROUP BY p.champion
      )
      SELECT *,count(*) OVER()::integer AS total FROM pool
      ORDER BY ${order},champion LIMIT ${limit} OFFSET ${offset}`,
      [...values, entityId, championPoolPageSize, (q.poolPage - 1) * championPoolPageSize],
    )
  ).rows;
  const sampled = (r: Record<string, string | number | null>, name: string, n: string) => ({
    value: r[name] == null ? null : Number(r[name]),
    sampleCount: Number(r[n] ?? 0),
  });
  return {
    sort: q.poolSort,
    page: {
      page: q.poolPage,
      pageSize: championPoolPageSize,
      total: Number(rows[0]?.total ?? 0),
      items: rows.map((r) => ({
        champion: String(r.champion),
        games: Number(r.games),
        wins: Number(r.wins),
        winRate: sampled(r, "win_rate", "result_games"),
        kda: sampled(r, "kda", "kda_n"),
        killParticipation: sampled(r, "kp", "kp_n"),
        csPerMinute: sampled(r, "cspm", "cspm_n"),
        goldPerMinute: sampled(r, "gpm", "gpm_n"),
        damagePerMinute: sampled(r, "dpm", "dpm_n"),
        goldDiffAt15: sampled(r, "gd15", "gd15_n"),
        csDiffAt15: sampled(r, "csd15", "csd15_n"),
      })),
    },
  };
}
