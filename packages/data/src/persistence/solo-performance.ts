import type { PoolClient } from "pg";
import type { ProChampionPerformance } from "../domain/pro-stats.js";
import type { Executor } from "./database.js";

/** Each averaged metric: its column prefix and per-player value, over minutes `m.minutes`. */
const metrics: [string, string][] = [
  ["cspm", "(p.total_minions_killed+p.neutral_minions_killed)/m.minutes"],
  ["gpm", "p.gold_earned/m.minutes"],
  ["dpm", "p.damage_to_champions/m.minutes"],
  ["damage_share", "p.damage_to_champions::double precision/nullif(t.damage,0)"],
  ["vspm", "p.vision_score/m.minutes"],
  ["game_length", "m.duration_seconds::double precision"],
];

/**
 * Rebuilds one patch's solo-queue champion performance from Riot's match participants, sliced
 * like the champion aggregates (queue, region and ladder tier) and by lane role. `games` is the
 * patch's counted games: game_id, queue, region and tier.
 */
export async function rebuildSoloPerformance(
  c: PoolClient,
  patchKey: string,
  games: string,
  now: Date,
) {
  await c.query("DELETE FROM solo_champion_performance WHERE patch_key=$1", [patchKey]);
  const kda = "p.kills IS NOT NULL AND p.deaths IS NOT NULL AND p.assists IS NOT NULL";
  const inserted = await c.query(
    `WITH games AS (${games}),
     matches AS (
       SELECT r.match_id,r.duration_seconds,
         CASE WHEN r.duration_seconds>0 THEN r.duration_seconds/60.0 END AS minutes
       FROM riot_matches r WHERE r.match_id IN (SELECT game_id FROM games)),
     teams AS (
       SELECT match_id,team_id,sum(kills) AS kills,sum(damage_to_champions) AS damage
       FROM riot_match_participants WHERE match_id IN (SELECT game_id FROM games)
       GROUP BY match_id,team_id)
     INSERT INTO solo_champion_performance(patch_key,queue,region,tier,role,champion_key,games,
       kills,deaths,assists,kda_n,kp_takedowns,kp_team_kills,kp_n,
       ${metrics.map(([m]) => `${m}_sum,${m}_n`).join(",")},built_at)
     SELECT $1,g.queue,g.region,g.tier,p.team_position,p.champion_id,count(*)::integer,
       coalesce(sum(p.kills) FILTER(WHERE ${kda}),0),coalesce(sum(p.deaths) FILTER(WHERE ${kda}),0),
       coalesce(sum(p.assists) FILTER(WHERE ${kda}),0),(count(*) FILTER(WHERE ${kda}))::integer,
       coalesce(sum(p.kills+p.assists) FILTER(WHERE ${kda} AND t.kills>0),0),
       coalesce(sum(t.kills) FILTER(WHERE ${kda} AND t.kills>0),0),
       (count(*) FILTER(WHERE ${kda} AND t.kills>0))::integer,
       ${metrics.map(([, v]) => `coalesce(sum(${v}),0),count(${v})::integer`).join(",")},$2
     FROM riot_match_participants p
     JOIN games g ON g.game_id=p.match_id
     JOIN matches m ON m.match_id=p.match_id
     JOIN teams t ON t.match_id=p.match_id AND t.team_id=p.team_id
     WHERE p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')
     GROUP BY g.queue,g.region,g.tier,p.team_position,p.champion_id`,
    [patchKey, now],
  );
  return inserted.rowCount ?? 0;
}

const lanes = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
const unknown = { value: null, sampleCount: 0 };
/**
 * A champion's per-game solo-queue averages on one patch, in the selected region, tier and role
 * (every role when `role` is not a lane). Early-game differences and first blood are not computed
 * for solo queue here, so they stay unknown.
 */
export async function soloChampionPerformance(
  db: Executor,
  input: {
    championKey: number;
    patch: string;
    /** Patches whose games are combined, the patch among them; only the patch when absent. */
    patches?: readonly string[] | undefined;
    region?: string | undefined;
    tier?: string | undefined;
    role?: string | undefined;
  },
): Promise<ProChampionPerformance> {
  const role = input.role && lanes.has(input.role) ? input.role : null;
  const sums = (
    await db.query<Record<string, number | null>>(
      `SELECT sum(games)::integer AS games,sum(kills) AS kills,sum(deaths) AS deaths,
         sum(assists) AS assists,sum(kda_n)::integer AS kda_n,sum(kp_takedowns) AS kp_takedowns,
         sum(kp_team_kills) AS kp_team_kills,sum(kp_n)::integer AS kp_n,
         ${metrics.map(([m]) => `sum(${m}_sum) AS ${m}_sum,sum(${m}_n)::integer AS ${m}_n`).join(",")}
       FROM solo_champion_performance
       WHERE champion_key=$1 AND patch_key=ANY($2::text[]) AND ($3::text IS NULL OR region=$3)
         AND ($4::text IS NULL OR tier=$4) AND ($5::text IS NULL OR role=$5)`,
      [
        input.championKey,
        input.patches ?? [input.patch],
        input.region ?? null,
        input.tier ?? null,
        role,
      ],
    )
  ).rows[0]!;
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
    goldDiffAt15: unknown,
    csDiffAt15: unknown,
    xpDiffAt15: unknown,
    firstBloodParticipation: unknown,
    visionScorePerMinute: mean("vspm"),
    gameLength: mean("game_length"),
  };
}
