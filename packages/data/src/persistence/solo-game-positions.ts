import {
  soloMatchIdSchema,
  timelineMinuteLimit,
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
