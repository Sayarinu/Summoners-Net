import type { Pool } from "pg";
import { attributeEvents, type WpaEvent } from "../domain/wpa.js";
import { transaction, type Executor } from "./database.js";
import { featureRowFromDb, type FeatureDbRow, type WinProbabilityModel } from "./wp-models.js";

/** Scores one match's events with a model, replacing only that model's values for the match. */
export async function scoreMatchWpa(
  pool: Pool,
  matchId: string,
  model: WinProbabilityModel,
  now: Date,
) {
  const teams = new Map(
    (
      await pool.query<{ participant_id: number; team_id: number }>(
        "SELECT participant_id,team_id FROM riot_match_participants WHERE match_id=$1",
        [matchId],
      )
    ).rows.map((r) => [r.participant_id, r.team_id]),
  );
  const rows = (
    await pool.query<FeatureDbRow>(
      "SELECT * FROM riot_wp_features WHERE match_id=$1 AND version=$2 ORDER BY minute",
      [matchId, model.featureVersion],
    )
  ).rows.map(featureRowFromDb);
  const events = (
    await pool.query<{
      seq: number;
      type: string;
      timestamp_ms: number;
      participant_id: number | null;
      victim_id: number | null;
      team_id: number | null;
      monster_type: string | null;
      monster_sub_type: string | null;
      building_type: string | null;
      assisting_participant_ids: number[] | null;
    }>(
      `SELECT seq,type,timestamp_ms,participant_id,victim_id,team_id,monster_type,monster_sub_type,
         building_type,assisting_participant_ids FROM riot_timeline_events WHERE match_id=$1
         AND type IN ('CHAMPION_KILL','BUILDING_KILL','ELITE_MONSTER_KILL','DRAGON_SOUL_GIVEN')
       ORDER BY seq`,
      [matchId],
    )
  ).rows.map((e): WpaEvent => ({
    seq: e.seq,
    type: e.type,
    timestampMs: e.timestamp_ms,
    participantId: e.participant_id,
    victimId: e.victim_id,
    teamId: e.team_id,
    monsterType: e.monster_type,
    monsterSubType: e.monster_sub_type,
    buildingType: e.building_type,
    assistingParticipantIds: e.assisting_participant_ids,
  }));
  const scored = attributeEvents(rows, events, teams, model.coefficients);
  await transaction(pool, async (c) => {
    await c.query("DELETE FROM riot_wpa_events WHERE match_id=$1 AND model_id=$2", [
      matchId,
      model.id,
    ]);
    for (const e of scored) {
      await c.query(
        `INSERT INTO riot_wpa_events(match_id,seq,model_id,type,timestamp_ms,team,delta,computed_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [matchId, e.seq, model.id, e.type, e.timestampMs, e.team, e.delta, now],
      );
      for (const p of e.participants)
        await c.query(
          `INSERT INTO riot_wpa_participants(match_id,seq,model_id,participant_id,role,value)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [matchId, e.seq, model.id, p.participantId, p.role, p.value],
        );
    }
  });
  return scored.length;
}

/**
 * Scores matches that have features for the model's feature version but no values from this
 * model yet, a bounded batch per call. Returns the number of matches scored.
 */
export async function scorePendingWpa(
  pool: Pool,
  model: WinProbabilityModel,
  now: Date,
  limit = 200,
) {
  const pending = (
    await pool.query<{ match_id: string }>(
      `SELECT DISTINCT f.match_id FROM riot_wp_features f WHERE f.version=$1
         AND NOT EXISTS (SELECT 1 FROM riot_wpa_events w WHERE w.match_id=f.match_id AND w.model_id=$2)
         AND EXISTS (SELECT 1 FROM riot_timeline_events t WHERE t.match_id=f.match_id
           AND t.type IN ('CHAMPION_KILL','BUILDING_KILL','ELITE_MONSTER_KILL'))
       ORDER BY f.match_id LIMIT $3`,
      [model.featureVersion, model.id, limit],
    )
  ).rows;
  for (const { match_id } of pending) await scoreMatchWpa(pool, match_id, model, now);
  return pending.length;
}

export interface MatchWpa {
  modelId: number;
  events: {
    seq: number;
    type: string;
    timestampMs: number;
    team: "blue" | "red" | null;
    delta: number | null;
    participants: { participantId: number; role: string; value: number }[];
  }[];
}
/** A match's event values from one model. */
export async function matchWpa(db: Executor, matchId: string, modelId: number): Promise<MatchWpa> {
  const events = await db.query<{
    seq: number;
    type: string;
    timestamp_ms: number;
    team: "blue" | "red" | null;
    delta: number | null;
    participants: { participantId: number; role: string; value: number }[];
  }>(
    `SELECT e.seq,e.type,e.timestamp_ms,e.team,e.delta,
       coalesce(jsonb_agg(jsonb_build_object('participantId',p.participant_id,'role',p.role,
         'value',p.value) ORDER BY p.role DESC,p.participant_id) FILTER(WHERE p.participant_id IS NOT NULL),'[]') AS participants
     FROM riot_wpa_events e LEFT JOIN riot_wpa_participants p USING (match_id,seq,model_id)
     WHERE e.match_id=$1 AND e.model_id=$2 GROUP BY e.match_id,e.seq,e.model_id ORDER BY e.seq`,
    [matchId, modelId],
  );
  return {
    modelId,
    events: events.rows.map((e) => ({
      seq: e.seq,
      type: e.type,
      timestampMs: e.timestamp_ms,
      team: e.team,
      delta: e.delta,
      participants: e.participants,
    })),
  };
}
