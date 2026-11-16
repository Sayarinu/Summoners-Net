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
