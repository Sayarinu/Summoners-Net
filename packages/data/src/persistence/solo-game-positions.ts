import {
  mapEventLimit,
  soloMatchIdSchema,
  timelineMinuteLimit,
  type MapEvent,
  type SoloGameMapEvents,
  type SoloGamePositions,
  type TimelinePositionFrame,
} from "../domain/solo-games.js";
import type { Executor } from "./database.js";

/**
 * One game's stored per-minute positions for every participant, bounded to
 * {@link timelineMinuteLimit} minutes. Minutes without a stored frame are null, never the origin.
 * Null when the match is not stored.
 */
export async function soloGamePositions(
  db: Executor,
  matchId: string,
): Promise<SoloGamePositions | null> {
  const id = soloMatchIdSchema.parse(matchId);
  const match = (
    await db.query<{ timeline_state: SoloGamePositions["timelineState"]; truncated: boolean }>(
      `SELECT timeline_state,EXISTS (SELECT 1 FROM riot_timeline_frames f
         WHERE f.match_id=m.match_id AND f.minute>$2) AS truncated
       FROM riot_matches m WHERE match_id=$1`,
      [id, timelineMinuteLimit],
    )
  ).rows[0];
  if (!match) return null;
  const participants = (
    await db.query<{ participant_id: number }>(
      "SELECT participant_id FROM riot_match_participants WHERE match_id=$1 ORDER BY participant_id",
      [id],
    )
  ).rows;
  const frames = (
    await db.query<{
      participant_id: number;
      minute: number;
      timestamp_ms: number;
      x: number | null;
      y: number | null;
    }>(
      `SELECT participant_id,minute,timestamp_ms,x,y FROM riot_timeline_frames
       WHERE match_id=$1 AND minute<=$2 ORDER BY participant_id,minute`,
      [id, timelineMinuteLimit],
    )
  ).rows;
  const lastMinute = Math.max(-1, ...frames.map((f) => f.minute));
  const stored = new Map(frames.map((f) => [`${f.participant_id}:${f.minute}`, f]));
  return {
    matchId: id,
    timelineState: match.timeline_state,
    truncated: match.truncated,
    tracks: participants.map(({ participant_id }) => ({
      participantId: participant_id,
      frames: Array.from({ length: lastMinute + 1 }, (_, minute): TimelinePositionFrame => {
        const f = stored.get(`${participant_id}:${minute}`);
        return f
          ? { minute, timestampMs: f.timestamp_ms, x: f.x, y: f.y }
          : { minute, timestampMs: null, x: null, y: null };
      }),
    })),
  };
}

const title = (text: string) =>
  text
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
const teamSide = (team: number | null) => (team === 100 ? "blue" : team === 200 ? "red" : null);
const opposite = (side: "blue" | "red" | null | undefined) =>
  side === "blue" ? "red" : side === "red" ? "blue" : null;

/**
 * One game's kills, objectives and ward placements in timeline order, bounded to
 * {@link mapEventLimit}. Coordinates Riot omits, such as every ward's, stay null.
 * Null when the match is not stored.
 */
export async function soloGameMapEvents(
  db: Executor,
  matchId: string,
): Promise<SoloGameMapEvents | null> {
  const id = soloMatchIdSchema.parse(matchId);
  const exists = await db.query("SELECT 1 FROM riot_matches WHERE match_id=$1", [id]);
  if (!exists.rowCount) return null;
  const sides = (
    await db.query<{ participant_id: number; side: "blue" | "red" }>(
      "SELECT participant_id,side FROM riot_match_participants WHERE match_id=$1",
      [id],
    )
  ).rows;
  const sideOf = new Map(sides.map((p) => [p.participant_id, p.side]));
  const rows = (
    await db.query<{
      seq: number;
      type: string;
      timestamp_ms: number;
      participant_id: number | null;
      victim_id: number | null;
      team_id: number | null;
      x: number | null;
      y: number | null;
      monster_type: string | null;
      monster_sub_type: string | null;
      building_type: string | null;
      lane_type: string | null;
      ward_type: string | null;
    }>(
      `SELECT seq,type,timestamp_ms,participant_id,victim_id,team_id,x,y,monster_type,
         monster_sub_type,building_type,lane_type,ward_type
       FROM riot_timeline_events WHERE match_id=$1
         AND type IN ('CHAMPION_KILL','ELITE_MONSTER_KILL','BUILDING_KILL','WARD_PLACED')
       ORDER BY seq LIMIT $2`,
      [id, mapEventLimit + 1],
    )
  ).rows;
  const events = rows.slice(0, mapEventLimit).map((e): MapEvent => {
    const base = {
      id: `${id}:${e.seq}`,
      timestampMs: e.timestamp_ms,
      participantId: e.participant_id,
      victimId: e.victim_id,
      x: e.x,
      y: e.y,
    };
    const actor = e.participant_id === null ? null : (sideOf.get(e.participant_id) ?? null);
    if (e.type === "CHAMPION_KILL")
      return {
        ...base,
        kind: "kill",
        side: actor ?? opposite(e.victim_id === null ? null : sideOf.get(e.victim_id)),
        label: "Champion kill",
      };
    if (e.type === "WARD_PLACED")
      return {
        ...base,
        kind: "ward",
        side: actor,
        label: e.ward_type ? `Ward placed (${title(e.ward_type)})` : "Ward placed",
      };
    if (e.type === "BUILDING_KILL") {
      const building = e.building_type === "INHIBITOR_BUILDING" ? "Inhibitor" : "Tower";
      const lane = e.lane_type ? ` (${title(e.lane_type)})` : "";
      // A building event names the team that owned it.
      return {
        ...base,
        kind: "objective",
        side: opposite(teamSide(e.team_id)),
        label: `${building} destroyed${lane}`,
      };
    }
    return {
      ...base,
      kind: "objective",
      side: teamSide(e.team_id) ?? actor,
      label: title(e.monster_sub_type ?? e.monster_type ?? "monster"),
    };
  });
  return { events, truncated: rows.length > mapEventLimit };
}
