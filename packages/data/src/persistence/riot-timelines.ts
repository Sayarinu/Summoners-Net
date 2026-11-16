import type { Pool } from "pg";
import type { RiotTimeline, TimelineEvent, TimelineFrame } from "../providers/riot-timeline.js";
import { transaction, type Executor } from "./database.js";

/** Ingested matches whose timeline has not been fetched, oldest first, with their route. */
export async function pendingTimelines(db: Executor, limit: number) {
  const rows = await db.query<{ match_id: string; region: string }>(
    `SELECT m.match_id,i.region FROM riot_matches m JOIN riot_match_ids i USING (match_id)
     WHERE m.timeline_state='pending' ORDER BY m.fetched_at,m.match_id LIMIT $1`,
    [limit],
  );
  return rows.rows.map((r) => ({ matchId: r.match_id, region: r.region }));
}
export async function markTimelineUnavailable(
  pool: Pool,
  matchId: string,
  state: "missing" | "invalid",
  now: Date,
) {
  await pool.query(
    "UPDATE riot_matches SET timeline_state=$2,timeline_fetched_at=$3 WHERE match_id=$1",
    [matchId, state, now],
  );
}
/** Writes a validated timeline in one transaction, replacing any earlier copy. */
export async function saveTimeline(pool: Pool, timeline: RiotTimeline, now: Date) {
  await transaction(pool, async (c) => {
    const f = <K extends keyof TimelineFrame>(key: K) => timeline.frames.map((r) => r[key]);
    const e = <K extends keyof TimelineEvent>(key: K) => timeline.events.map((r) => r[key]);
    await c.query("DELETE FROM riot_timeline_frames WHERE match_id=$1", [timeline.matchId]);
    await c.query("DELETE FROM riot_timeline_events WHERE match_id=$1", [timeline.matchId]);
    await c.query(
      `INSERT INTO riot_timeline_frames(match_id,participant_id,minute,timestamp_ms,x,y,current_gold,
         total_gold,xp,level,minions_killed,jungle_minions_killed)
       SELECT $1,* FROM unnest($2::integer[],$3::integer[],$4::integer[],$5::integer[],$6::integer[],
         $7::integer[],$8::integer[],$9::integer[],$10::integer[],$11::integer[],$12::integer[])`,
      [
        timeline.matchId,
        f("participantId"),
        f("minute"),
        f("timestampMs"),
        f("x"),
        f("y"),
        f("currentGold"),
        f("totalGold"),
        f("xp"),
        f("level"),
        f("minionsKilled"),
        f("jungleMinionsKilled"),
      ],
    );
    await c.query(
      `INSERT INTO riot_timeline_events(match_id,seq,type,timestamp_ms,participant_id,victim_id,
         team_id,x,y,item_id,after_item_id,skill_slot,level_up_type,monster_type,monster_sub_type,
         building_type,lane_type,tower_type,ward_type,assisting_participant_ids)
       SELECT $1,seq,type,ts,participant,victim,team,x,y,item,after_item,skill,level_up,monster,
         monster_sub,building,lane,tower,ward,
         CASE WHEN assists IS NULL THEN NULL ELSE
           ARRAY(SELECT jsonb_array_elements_text(assists)::integer) END
       FROM unnest($2::integer[],$3::text[],$4::integer[],$5::integer[],$6::integer[],$7::integer[],
         $8::integer[],$9::integer[],$10::integer[],$11::integer[],$12::integer[],$13::text[],
         $14::text[],$15::text[],$16::text[],$17::text[],$18::text[],$19::text[],$20::jsonb[])
         AS t(seq,type,ts,participant,victim,team,x,y,item,after_item,skill,level_up,monster,
           monster_sub,building,lane,tower,ward,assists)`,
      [
        timeline.matchId,
        e("seq"),
        e("type"),
        e("timestampMs"),
        e("participantId"),
        e("victimId"),
        e("teamId"),
        e("x"),
        e("y"),
        e("itemId"),
        e("afterItemId"),
        e("skillSlot"),
        e("levelUpType"),
        e("monsterType"),
        e("monsterSubType"),
        e("buildingType"),
        e("laneType"),
        e("towerType"),
        e("wardType"),
        timeline.events.map((ev) =>
          ev.assistingParticipantIds ? JSON.stringify(ev.assistingParticipantIds) : null,
        ),
      ],
    );
    await c.query(
      "UPDATE riot_matches SET timeline_state='fetched',timeline_fetched_at=$2 WHERE match_id=$1",
      [timeline.matchId, now],
    );
  });
}
