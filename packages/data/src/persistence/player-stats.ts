import type { Executor } from "./database.js";
import type { SampledValue } from "../domain/historical.js";
import type { PlayerPerformance, PlayerSeason } from "../domain/player-performance.js";

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
