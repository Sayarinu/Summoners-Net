import { z } from "zod";

export const soloMatchIdSchema = z.string().regex(/^[A-Z0-9]{2,5}_\d{1,15}$/);
export interface SoloGameMarker {
  id: string;
  minute: number;
  timestampMs: number;
  team: "blue" | "red" | null;
  kind:
    | "kill"
    | "dragon"
    | "elder"
    | "baron"
    | "herald"
    | "voidgrubs"
    | "tower"
    | "inhibitor"
    | "other";
  label: string;
}
export interface SoloGame {
  matchId: string;
  patch: string | null;
  queueId: number | null;
  durationSeconds: number | null;
  startedAt: string | null;
  teams: { side: "blue" | "red"; win: boolean | null }[];
  participants: {
    participantId: number;
    side: "blue" | "red";
    championKey: number;
    championId: string | null;
    championName: string | null;
    role: string | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
  }[];
  winProbability: {
    /** The active model, or null with a reason when there is nothing to score with. */
    model: {
      id: number;
      modelVersion: number;
      featureVersion: number;
      brier: number | null;
      trainedAt: string;
    } | null;
    reason: string | null;
    /** Every minute from 0 to the last; null where features are missing. */
    points: { minute: number; blueWinProbability: number | null }[];
    markers: SoloGameMarker[];
  };
}

/** Frames past this minute are not read; Riot games end well before it. */
export const timelineMinuteLimit = 120;
/** One stored per-minute timeline sample; coordinates Riot omitted stay null. */
export interface TimelinePositionFrame {
  minute: number;
  /** Null when no frame is stored for this minute. */
  timestampMs: number | null;
  x: number | null;
  y: number | null;
}
/** Every participant's per-minute positions, dense from minute 0 to the last stored frame. */
export interface SoloGamePositions {
  matchId: string;
  timelineState: "pending" | "fetched" | "missing" | "invalid";
  /** Frames beyond {@link timelineMinuteLimit} exist but were not read. */
  truncated: boolean;
  tracks: { participantId: number; frames: TimelinePositionFrame[] }[];
}

/** At most this many map events are read for one game. */
export const mapEventLimit = 1000;
/** A kill, objective or ward placement from a game's timeline. Riot omits ward coordinates. */
export interface MapEvent {
  id: string;
  kind: "kill" | "objective" | "ward";
  timestampMs: number;
  /** The side credited: the killer's, the objective taker's or the ward owner's. */
  side: "blue" | "red" | null;
  /** The killer or ward owner; null for a minion, tower or unknown actor. */
  participantId: number | null;
  victimId: number | null;
  x: number | null;
  y: number | null;
  label: string;
}
export interface SoloGameMapEvents {
  events: MapEvent[];
  /** More than {@link mapEventLimit} events are stored; later ones were not read. */
  truncated: boolean;
}
