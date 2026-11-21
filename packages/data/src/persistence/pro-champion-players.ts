import {
  proChampionPlayersLimit,
  type ProChampionPlayer,
  type ProChampionPlayers,
} from "../domain/pro-stats.js";
import { applySamplePolicy } from "../domain/statistics.js";
import { splitOf, stageOf } from "./pro-stats.js";
import type { Executor } from "./database.js";

/**
 * Who played a champion in the patch's pro games, most games first. Reads the archive rows of
 * the patch's games through their primary key, and resolves each player's profile through the
 * normalized participant row when the game has one.
 */
export async function proChampionPlayers(
  db: Executor,
  input: {
    /** Data Dragon's champion id; Oracle names map to it. */
    championId: string;
    patch: string | null;
    league?: string | undefined;
    split?: string | undefined;
    stage?: string | undefined;
  },
): Promise<ProChampionPlayers> {
  if (!input.patch) return { items: [], total: 0 };
  const kda = "kills IS NOT NULL AND deaths IS NOT NULL AND assists IS NOT NULL";
  const rows = await db.query<{
    name: string;
    team: string | null;
    leagues: string[];
    profile: { name?: string; publicSlug?: string } | null;
    games: number;
    wins: number;
    results: number;
    takedowns: number | null;
    deaths: number | null;
    kda_n: number;
    total: number;
  }>(
    `WITH names AS (SELECT name FROM oracle_champion_names WHERE champion_id=$1),
     scoped AS (
       SELECT g.id,g.source_league AS league,g.occurred_at FROM oracle_archive_games g
       JOIN patch_sources p ON p.source='oracle' AND p.source_string=g.patch
       WHERE p.patch_key=$2 AND ($3::text IS NULL OR g.source_league=$3)
         AND ($4::text IS NULL OR ${splitOf("g")}=$4) AND ($5::text IS NULL OR ${stageOf("g")}=$5)),
     played AS (
       SELECT o.*,s.league,s.occurred_at,
         coalesce(member.entity_id,'archive:'||coalesce(o.player_source_id,lower(o.player_name)))
           AS player_key,
         member.entity_id
       FROM scoped s JOIN oracle_archive_participants o ON o.game_id=s.id
       LEFT JOIN games ga ON ga.archive_game_id=s.id
       LEFT JOIN participants pp ON pp.game_id=ga.id AND pp.slot=o.slot
       LEFT JOIN entity_members member ON member.id=pp.player_id
       WHERE o.position IN ('top','jng','mid','bot','sup') AND o.player_name IS NOT NULL
         AND o.champion IN (SELECT name FROM names)),
     grouped AS (
       SELECT player_key,max(entity_id) AS entity_id,
         (array_agg(player_name ORDER BY occurred_at DESC))[1] AS name,
         (array_agg(team_name ORDER BY occurred_at DESC))[1] AS team,
         array_agg(DISTINCT league ORDER BY league) AS leagues,
         count(*)::integer AS games,count(*) FILTER(WHERE result)::integer AS wins,
         count(result)::integer AS results,
         sum(kills+assists) FILTER(WHERE ${kda}) AS takedowns,
         sum(deaths) FILTER(WHERE ${kda}) AS deaths,
         (count(*) FILTER(WHERE ${kda}))::integer AS kda_n
       FROM played GROUP BY player_key)
     SELECT g.name,g.team,g.leagues,pro.document AS profile,g.games,g.wins,g.results,g.takedowns,
       g.deaths,g.kda_n,count(*) OVER()::integer AS total
     FROM grouped g LEFT JOIN entity_profiles pro ON pro.id=g.entity_id
     ORDER BY g.games DESC,g.wins DESC,g.name LIMIT $6`,
    [
      input.championId,
      input.patch,
      input.league ?? null,
      input.split ?? null,
      input.stage ?? null,
      proChampionPlayersLimit,
    ],
  );
  return {
    total: rows.rows[0]?.total ?? 0,
    items: rows.rows.map((r): ProChampionPlayer => {
      const win = applySamplePolicy({
        value: r.results ? r.wins / r.results : null,
        sampleCount: r.results,
      });
      return {
        name: r.name,
        team: r.team,
        leagues: r.leagues,
        profile: r.profile?.name
          ? { name: r.profile.name, publicSlug: r.profile.publicSlug ?? null }
          : null,
        games: r.games,
        winRate: { value: win.value, sampleCount: win.sampleCount },
        kda: {
          value: r.kda_n ? Number(r.takedowns) / Math.max(Number(r.deaths), 1) : null,
          sampleCount: r.kda_n,
        },
      };
    }),
  };
}
