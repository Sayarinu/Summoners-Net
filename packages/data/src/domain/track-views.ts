import { z } from "zod";
import { soloMatchIdSchema } from "./solo-games.js";
import type { TrackMovement } from "./track-movements.js";

/** One sample observation as the viewer draws it; null coordinates are gaps. */
export interface TrackObservation {
  participantId: number;
  x: number | null;
  y: number | null;
  confidence: number | null;
}
export interface MatchTrackSummary {
  sampleRateHz: number;
  sampleCount: number;
  firstMs: number;
  lastMs: number;
  importedAt: string;
  linkState: "linked" | "unavailable" | "mismatch";
  /** Null for tracks imported before movement detection; re-import to detect them. */
  movements: TrackMovement[] | null;
}
/** The longest time range one read returns, and the most samples (ten per second). */
export const trackRangeLimitMs = 120_000;
export const trackRangeSampleLimit = trackRangeLimitMs / 100 + 1;
export const trackRangeQuerySchema = z
  .strictObject({
    matchId: soloMatchIdSchema,
    fromMs: z.coerce.number().int().min(0).max(7_200_000),
    toMs: z.coerce.number().int().min(0).max(7_200_000),
  })
  .refine((q) => q.toMs >= q.fromMs && q.toMs - q.fromMs <= trackRangeLimitMs, {
    message: "A range runs forward and spans at most two minutes.",
  });

export type TrackRangeQuery = z.input<typeof trackRangeQuerySchema>;
export type TrackRange = { timeMs: number; positions: TrackObservation[] }[];
