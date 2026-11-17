import {
  featureLabels,
  type ModelDiagnostics,
  type ModelSummary,
} from "../domain/model-diagnostics.js";
import type { Executor } from "./database.js";
import { winProbabilityModels, type WinProbabilityModel } from "./wp-models.js";

const summary = (m: WinProbabilityModel): ModelSummary => ({
  id: m.id,
  kind: m.kind,
  status: m.status,
  reason: m.reason,
  modelVersion: m.modelVersion,
  featureVersion: m.featureVersion,
  window: m.patchWindow,
  trainMatches: m.trainMatches,
  trainRows: m.trainRows,
  evalMatches: m.evalMatches,
  evalRows: m.evalRows,
  brier: m.brier,
  trainedAt: m.trainedAt,
});
/** Stored model versions of every kind, newest first, with one shown in detail. */
export async function modelDiagnostics(
  db: Executor,
  selectedId?: number,
): Promise<ModelDiagnostics> {
  const models = [
    ...(await winProbabilityModels(db, 20, "timeline")),
    ...(await winProbabilityModels(db, 20, "pro-checkpoints")),
    ...(await winProbabilityModels(db, 20, "draft")),
  ].sort((a, b) => b.id - a.id);
  const selected =
    (selectedId === undefined
      ? (models.find((m) => m.status === "active" && m.kind === "timeline") ??
        models.find((m) => m.status === "active"))
      : models.find((m) => m.id === selectedId)) ?? null;
  return {
    models: models.map(summary),
    selected: selected
      ? {
          ...summary(selected),
          intercept: selected.coefficients.intercept,
          weights: selected.coefficients.features.map((feature, i) => ({
            feature,
            label: featureLabels[feature] ?? feature,
            weight: selected.coefficients.weights[i] ?? 0,
          })),
          bins: selected.bins,
        }
      : null,
  };
}
