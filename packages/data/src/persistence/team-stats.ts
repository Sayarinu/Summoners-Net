import type { SampledValue } from "../domain/historical.js";
import type { TeamStatistics } from "../domain/team-statistics.js";
import type { Executor } from "./database.js";

const number = (key: string) =>
  `CASE WHEN jsonb_typeof(o.statistics->'${key}')='number' THEN (o.statistics->>'${key}')::double precision END`;
/** A share of an objective both teams could take; null when neither took one. */
const control = (own: string, opponent: string) => [
  `sum(${number(own)}) FILTER(WHERE ${number(opponent)} IS NOT NULL)
     /nullif(sum(${number(own)}+${number(opponent)}),0)`,
  `count(*) FILTER(WHERE ${number(own)} IS NOT NULL AND ${number(opponent)} IS NOT NULL)`,
];
const metrics: [string, string, string][] = [
  ["winRate", "avg(p.won::integer)", "count(p.won)"],
  [
    "blueWinRate",
    "avg(p.won::integer) FILTER(WHERE o.side='blue')",
    "count(p.won) FILTER(WHERE o.side='blue')",
  ],
  [
    "redWinRate",
    "avg(p.won::integer) FILTER(WHERE o.side='red')",
    "count(p.won) FILTER(WHERE o.side='red')",
  ],
  [
    "winLength",
    `avg(${number("gamelength")}) FILTER(WHERE p.won)`,
    `count(${number("gamelength")}) FILTER(WHERE p.won)`,
  ],
  [
    "lossLength",
    `avg(${number("gamelength")}) FILTER(WHERE NOT p.won)`,
    `count(${number("gamelength")}) FILTER(WHERE NOT p.won)`,
  ],
  ["goldDiffAt15", `avg(${number("golddiffat15")})`, `count(${number("golddiffat15")})`],
  ["killsPerMinute", `avg(${number("team kpm")})`, `count(${number("team kpm")})`],
  ...(
    [
      ["firstBlood", "firstblood"],
      ["firstTower", "firsttower"],
      ["firstDragon", "firstdragon"],
      ["firstHerald", "firstherald"],
      ["firstBaron", "firstbaron"],
    ] as const
  ).map(([name, key]): [string, string, string] => [
    name,
    `avg(${number(key)}) FILTER(WHERE ${number(key)} IN (0,1))`,
    `count(*) FILTER(WHERE ${number(key)} IN (0,1))`,
  ]),
  ["dragonControl", ...control("dragons", "opp_dragons")] as [string, string, string],
  ["heraldControl", ...control("heralds", "opp_heralds")] as [string, string, string],
  ["voidGrubControl", ...control("void_grubs", "opp_void_grubs")] as [string, string, string],
  ["baronControl", ...control("barons", "opp_barons")] as [string, string, string],
  ["towersPerGame", `avg(${number("towers")})`, `count(${number("towers")})`],
];

/**
 * Aggregates a team entity's Oracle's Elixir team rows over the games matching `where`, which may
 * reference only `games` columns.
 */
export async function teamStatistics(
  db: Executor,
  entityId: string,
  where: string,
  values: unknown[],
): Promise<TeamStatistics> {
  const row = (
    await db.query<Record<string, unknown>>(
      `WITH played AS (
        SELECT p.*,games.archive_game_id FROM participants p JOIN games ON games.id=p.game_id
        WHERE ${where} AND p.role='team'
          AND p.team_id IN (SELECT id FROM entity_members WHERE entity_id=$${values.length + 1}))
      SELECT count(*)::integer AS games,
        (count(*) FILTER(WHERE o.side='blue'))::integer AS blue_games,
        (count(*) FILTER(WHERE o.side='red'))::integer AS red_games,
        ${metrics.map(([name, value, sample]) => `${value} AS "${name}",(${sample})::integer AS "${name}_n"`).join(",")}
      FROM played p
      LEFT JOIN oracle_archive_participants o ON o.game_id=p.archive_game_id AND o.slot=p.slot`,
      [...values, entityId],
    )
  ).rows[0]!;
  const sampled = (name: string): SampledValue => ({
    value: row[name] == null ? null : Number(row[name]),
    sampleCount: Number(row[`${name}_n`]),
  });
  return {
    games: Number(row.games),
    winRate: sampled("winRate"),
    sides: [
      { side: "blue", games: Number(row.blue_games), winRate: sampled("blueWinRate") },
      { side: "red", games: Number(row.red_games), winRate: sampled("redWinRate") },
    ],
    gameLength: { wins: sampled("winLength"), losses: sampled("lossLength") },
    goldDiffAt15: sampled("goldDiffAt15"),
    killsPerMinute: sampled("killsPerMinute"),
    firstBlood: sampled("firstBlood"),
    firstTower: sampled("firstTower"),
    firstDragon: sampled("firstDragon"),
    firstHerald: sampled("firstHerald"),
    firstBaron: sampled("firstBaron"),
    dragonControl: sampled("dragonControl"),
    heraldControl: sampled("heraldControl"),
    voidGrubControl: sampled("voidGrubControl"),
    baronControl: sampled("baronControl"),
    towersPerGame: sampled("towersPerGame"),
  };
}
