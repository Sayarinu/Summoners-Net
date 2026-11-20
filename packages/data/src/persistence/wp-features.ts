import type { PoolClient } from "pg";
import {
  extractFeatures,
  featureVersion,
  type FeatureEvent,
  type FeatureFrame,
  type FeatureRow,
} from "../domain/wp-features.js";
import type { Executor } from "./database.js";

const featureEventTypes = [
  "CHAMPION_KILL",
  "BUILDING_KILL",
  "ELITE_MONSTER_KILL",
  "DRAGON_SOUL_GIVEN",
];
/**
 * Computes features for the patch's matches that have a fetched timeline but no rows at the
 * current feature version. Runs inside the caller's transaction; returns rows written.
 */
export async function computeFeatures(c: PoolClient, patchKey: string, now: Date) {
  const pending = (
    await c.query<{ match_id: string }>(
      `SELECT m.match_id FROM riot_matches m WHERE m.patch_key=$1 AND m.timeline_state='fetched'
       AND NOT EXISTS (SELECT 1 FROM riot_wp_features f WHERE f.match_id=m.match_id AND f.version=$2)
       ORDER BY m.match_id`,
      [patchKey, featureVersion],
    )
  ).rows.map((r) => r.match_id);
  let written = 0;
  for (const matchId of pending) {
    const rows = await matchFeatures(c, matchId);
    if (!rows.length) continue;
    await c.query(
      `INSERT INTO riot_wp_features(match_id,version,minute,timestamp_ms,gold_diff,xp_diff,cs_diff,
         blue_kills,red_kills,blue_towers,red_towers,blue_inhibitors,red_inhibitors,blue_barons,
         red_barons,blue_elders,red_elders,blue_dragons,red_dragons,blue_soul,red_soul,blue_win,
         computed_at)
       SELECT $1,$2,(r->>'minute')::integer,(r->>'timestampMs')::integer,
         (r->>'goldDiff')::integer,(r->>'xpDiff')::integer,(r->>'csDiff')::integer,
         (r->'blue'->>'kills')::integer,(r->'red'->>'kills')::integer,
         (r->'blue'->>'towers')::integer,(r->'red'->>'towers')::integer,
         (r->'blue'->>'inhibitors')::integer,(r->'red'->>'inhibitors')::integer,
         (r->'blue'->>'barons')::integer,(r->'red'->>'barons')::integer,
         (r->'blue'->>'elders')::integer,(r->'red'->>'elders')::integer,
         r->'blue'->'dragons',r->'red'->'dragons',
         (r->'blue'->>'soul')::boolean,(r->'red'->>'soul')::boolean,
         (r->>'blueWin')::boolean,$4
       FROM jsonb_array_elements($3::jsonb) r`,
      [matchId, featureVersion, JSON.stringify(rows), now],
    );
    written += rows.length;
  }
  return written;
}

/** Features for one match, from its stored frames, events, teams and result. */
export async function matchFeatures(db: Executor, matchId: string): Promise<FeatureRow[]> {
  const participants = await db.query<{ participant_id: number; team_id: number }>(
    "SELECT participant_id,team_id FROM riot_match_participants WHERE match_id=$1",
    [matchId],
  );
  const result = await db.query<{ win: boolean | null }>(
    "SELECT win FROM riot_match_teams WHERE match_id=$1 AND team_id=100",
    [matchId],
  );
  const frames = await db.query<{
    minute: number;
    timestamp_ms: number;
    participant_id: number;
    total_gold: number | null;
    xp: number | null;
    minions_killed: number | null;
    jungle_minions_killed: number | null;
  }>(
    `SELECT minute,timestamp_ms,participant_id,total_gold,xp,minions_killed,jungle_minions_killed
     FROM riot_timeline_frames WHERE match_id=$1 ORDER BY minute,participant_id`,
    [matchId],
  );
  const events = await db.query<{
    type: string;
    timestamp_ms: number;
    participant_id: number | null;
    victim_id: number | null;
    team_id: number | null;
    monster_type: string | null;
    monster_sub_type: string | null;
    building_type: string | null;
  }>(
    `SELECT type,timestamp_ms,participant_id,victim_id,team_id,monster_type,monster_sub_type,
       building_type FROM riot_timeline_events WHERE match_id=$1 AND type=ANY($2::text[])
     ORDER BY seq`,
    [matchId, featureEventTypes],
  );
  return extractFeatures(
    frames.rows.map((f): FeatureFrame => ({
      minute: f.minute,
      timestampMs: f.timestamp_ms,
      participantId: f.participant_id,
      totalGold: f.total_gold,
      xp: f.xp,
      minionsKilled: f.minions_killed,
      jungleMinionsKilled: f.jungle_minions_killed,
    })),
    events.rows.map((e): FeatureEvent => ({
      type: e.type,
      timestampMs: e.timestamp_ms,
      participantId: e.participant_id,
      victimId: e.victim_id,
      teamId: e.team_id,
      monsterType: e.monster_type,
      monsterSubType: e.monster_sub_type,
      buildingType: e.building_type,
    })),
    new Map(participants.rows.map((p) => [p.participant_id, p.team_id])),
    result.rows[0]?.win ?? null,
  );
}
