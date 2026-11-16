import { z } from "zod";

/** Plain names for model features, shown next to their weights. */
export const featureLabels: Record<string, string> = {
  minute: "Game time (per 30 minutes)",
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
};
export const modelDiagnosticsQuerySchema = z
  .object({ model: z.coerce.number().int().positive().optional() })
  .strict();
export interface ModelSummary {
  id: number;
  kind: "timeline" | "pro-checkpoints";
  status: "active" | "retired" | "rejected";
  reason: string | null;
  modelVersion: number;
  featureVersion: number;
  /** Patch keys for the timeline model; archive years for the pro checkpoint model. */
  window: string[];
  trainMatches: number;
  trainRows: number;
  evalMatches: number;
  evalRows: number;
  brier: number | null;
  trainedAt: string;
}
export interface ModelDiagnostics {
  models: ModelSummary[];
  /** The model shown in detail: the requested one, or the newest active one. */
  selected:
    | (ModelSummary & {
        intercept: number;
        weights: { feature: string; label: string; weight: number }[];
        bins: {
          lower: number;
          upper: number;
          count: number;
          predicted: number | null;
          observed: number | null;
        }[];
      })
    | null;
}
