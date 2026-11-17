import type { PoolClient } from "pg";
import {
  clearMinutes,
  gankWindowMs,
  inferJunglePath,
  junglePathMinimumSample,
  type ChampionJunglePaths,
  type JunglePathCluster,
} from "../domain/jungle-paths.js";
import type { Executor } from "./database.js";

/**
 * Rebuilds one patch's inferred jungle paths and their clusters inside the caller's transaction.
 * Junglers are the JUNGLE team position in non-remake games with a stored timeline.
 */
export async function rebuildJunglePaths(c: PoolClient, patchKey: string, now: Date) {
  await c.query("DELETE FROM jungle_path_clusters WHERE patch_key=$1", [patchKey]);
  await c.query("DELETE FROM jungle_paths WHERE patch_key=$1", [patchKey]);
  const junglers = (
    await c.query<{
      match_id: string;
      participant_id: number;
      side: "blue" | "red";
      champion_id: number;
      win: boolean | null;
    }>(
      `SELECT p.match_id,p.participant_id,p.side,p.champion_id,p.win
       FROM riot_matches m JOIN riot_match_participants p USING (match_id)
       WHERE m.patch_key=$1 AND m.remake IS NOT TRUE AND m.timeline_state='fetched'
         AND p.team_position='JUNGLE'`,
      [patchKey],
    )
  ).rows;
  if (!junglers.length) return 0;
  const matches = [...new Set(junglers.map((j) => j.match_id))];
  const frames = (
    await c.query<{
      match_id: string;
      participant_id: number;
      minute: number;
      x: number | null;
      y: number | null;
    }>(
      `SELECT f.match_id,f.participant_id,f.minute,f.x,f.y
       FROM riot_timeline_frames f JOIN riot_match_participants p USING (match_id,participant_id)
       WHERE f.match_id=ANY($1) AND p.team_position='JUNGLE' AND f.minute=ANY($2)`,
      [matches, [...clearMinutes]],
    )
  ).rows;
  const kills = (
    await c.query<{
      match_id: string;
      timestamp_ms: number;
      x: number | null;
      y: number | null;
      participant_id: number | null;
      assisting_participant_ids: number[] | null;
    }>(
      `SELECT match_id,timestamp_ms,x,y,participant_id,assisting_participant_ids
       FROM riot_timeline_events
       WHERE match_id=ANY($1) AND type='CHAMPION_KILL' AND timestamp_ms<=$2`,
      [matches, gankWindowMs],
    )
  ).rows;
  const framesOf = Map.groupBy(frames, (f) => `${f.match_id}:${f.participant_id}`);
  const killsOf = Map.groupBy(kills, (k) => k.match_id);
  const rows = junglers.map((j) => ({
    ...j,
    path: inferJunglePath({
      participantId: j.participant_id,
      side: j.side,
      frames: framesOf.get(`${j.match_id}:${j.participant_id}`) ?? [],
      kills: (killsOf.get(j.match_id) ?? []).map((k) => ({
        timestampMs: k.timestamp_ms,
        x: k.x,
        y: k.y,
        killerId: k.participant_id,
        assistingParticipantIds: k.assisting_participant_ids,
      })),
    }),
  }));
  const column = <T>(pick: (r: (typeof rows)[number]) => T) => rows.map(pick);
  const coordinates = (axis: "x" | "y") =>
    rows.map((r) => `{${r.path.path.map((p) => (p ? Math.round(p[axis]) : "NULL")).join(",")}}`);
  const inserted = await c.query(
    `INSERT INTO jungle_paths(match_id,participant_id,patch_key,champion_key,win,start_side,
       start_confidence,route,gank_lane,gank_confidence,gank_minute,path_x,path_y,built_at)
     SELECT match_id,participant_id,$1,champion_key,win,start_side,start_confidence,route,
       gank_lane,gank_confidence,gank_minute,path_x::integer[],path_y::integer[],$2
     FROM unnest($3::text[],$4::integer[],$5::integer[],$6::boolean[],$7::text[],$8::text[],
       $9::text[],$10::text[],$11::text[],$12::integer[],$13::text[],$14::text[])
       AS t(match_id,participant_id,champion_key,win,start_side,start_confidence,route,gank_lane,
         gank_confidence,gank_minute,path_x,path_y)`,
    [
      patchKey,
      now,
      column((r) => r.match_id),
      column((r) => r.participant_id),
      column((r) => r.champion_id),
      column((r) => r.win),
      column((r) => r.path.startSide),
      column((r) => r.path.startConfidence),
      column((r) => r.path.route),
      column((r) => r.path.gankLane),
      column((r) => r.path.gankConfidence),
      column((r) => r.path.gankMinute),
      coordinates("x"),
      coordinates("y"),
    ],
  );
  const clusters = await c.query(
    `INSERT INTO jungle_path_clusters(patch_key,champion_key,start_side,route,gank_lane,games,
       result_games,wins,path_x,path_y,built_at)
     SELECT $1,champion_key,coalesce(start_side,'unknown'),coalesce(route,'unknown'),
       coalesce(gank_lane,'unknown'),count(*),count(win),count(*) FILTER (WHERE win),
       ARRAY[avg(path_x[1]),avg(path_x[2]),avg(path_x[3])],
       ARRAY[avg(path_y[1]),avg(path_y[2]),avg(path_y[3])],$2
     FROM jungle_paths WHERE patch_key=$1 GROUP BY 2,3,4,5`,
    [patchKey, now],
  );
  return (inserted.rowCount ?? 0) + (clusters.rowCount ?? 0);
}

/** Clusters shown per champion and patch, most played first. */
export const junglePathClusterLimit = 10;
const known = <T extends string>(value: string) => (value === "unknown" ? null : (value as T));

/** A champion's jungle path clusters on a patch, read from the aggregates only. */
export async function championJunglePaths(
  db: Executor,
  input: { championKey: number; patch: string },
): Promise<ChampionJunglePaths> {
  const rows = (
    await db.query<{
      start_side: string;
      route: string;
      gank_lane: string;
      games: number;
      result_games: number;
      wins: number;
      path_x: (number | null)[];
      path_y: (number | null)[];
      total: string;
    }>(
      `SELECT start_side,route,gank_lane,games,result_games,wins,path_x,path_y,
         sum(games) OVER () AS total
       FROM jungle_path_clusters WHERE champion_key=$1 AND patch_key=$2
       ORDER BY games DESC,start_side,route,gank_lane`,
      [input.championKey, input.patch],
    )
  ).rows;
  const clusters = rows.slice(0, junglePathClusterLimit).map((r): JunglePathCluster => ({
    startSide: known(r.start_side),
    route: known(r.route),
    gankLane: known(r.gank_lane),
    games: r.games,
    resultGames: r.result_games,
    winRate: r.result_games >= junglePathMinimumSample ? r.wins / r.result_games : null,
    path: r.path_x.map((x, i) => {
      const y = r.path_y[i];
      return x === null || y === null || y === undefined
        ? null
        : { x: Math.round(x), y: Math.round(y) };
    }),
  }));
  return {
    patch: input.patch,
    games: rows.length ? Number(rows[0]!.total) : 0,
    minimumSample: junglePathMinimumSample,
    clusters,
  };
}
