import { z } from "zod";

/** Plain names for model features, shown next to their weights. */
export const featureLabels: Record<string, string> = {
  minute: "Game time (per 30 minutes)",
  gameTime: "Game time (per 60 minutes, capped at 60)",
  goldDiff: "Gold difference (per 5,000)",
  xpDiff: "Experience difference (per 5,000)",
  csDiff: "Creep score difference (per 100)",
  killDiff: "Kill difference (per 10)",
  towerDiff: "Tower difference (per 5)",
  inhibitorDiff: "Inhibitor difference (per 2)",
  baronDiff: "Baron difference",
  elderDiff: "Elder dragon difference",
  dragonDiff: "Dragon difference (per 4)",
  soulDiff: "Dragon soul",
  goldDiffByMinute: "Gold difference × game time (per 150,000)",
  goldDiffByGameTime: "Gold difference × capped game time (per 300,000)",
  strength: "Champion strength difference (per 10 points)",
  lane: "Lane matchup advantage (per 10 points)",
  synergy: "Synergy difference (per 10 points)",
};
export const modelDiagnosticsQuerySchema = z
  .object({
    model: z.coerce.number().int().positive().optional(),
    /** Shows one game phase's calibration instead of every held-out state's. */
    phase: z.enum(["early", "mid", "late"]).optional(),
  })
  .strict();
export interface ModelSummary {
  id: number;
  kind: "timeline" | "pro-checkpoints" | "draft";
  status: "active" | "retired" | "rejected";
  reason: string | null;
  modelVersion: number;
  featureVersion: number;
  /** Patch keys for the timeline and draft models; archive years for the pro checkpoint model. */
  window: string[];
  trainMatches: number;
  trainRows: number;
  evalMatches: number;
  evalRows: number;
  brier: number | null;
  /** Mean log loss on held-out states; null for models trained before it was recorded. */
  logLoss: number | null;
  /** The game minutes a pro checkpoint model scores; null for other kinds and older models. */
  minutes: { first: number; last: number } | null;
  trainedAt: string;
}
export interface ModelBin {
  lower: number;
  upper: number;
  count: number;
  predicted: number | null;
  observed: number | null;
}
export interface ModelDiagnostics {
  models: ModelSummary[];
  /** The model shown in detail: the requested one, or the newest active one. */
  selected:
    | (ModelSummary & {
        intercept: number;
        weights: { feature: string; label: string; weight: number }[];
        bins: ModelBin[];
        /** Held-out results per game phase, so early and late estimates are checked separately. */
        phases: {
          phase: string;
          label: string;
          games: number;
          states: number;
          brier: number | null;
          logLoss: number | null;
          bins: ModelBin[];
        }[];
      })
    | null;
}
