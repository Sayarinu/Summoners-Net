// A regularized logistic regression for blue side's win probability, trained by deterministic
// full-batch gradient descent on fixed-scale features. No dependencies.
import { dragonTypes, type FeatureRow } from "./wp-features.js";

export const modelVersion = 1;
/** Feature names in coefficient order, with the scale each raw value is divided by. */
export const modelFeatures = [
  { name: "minute", scale: 30 },
  { name: "goldDiff", scale: 5000 },
  { name: "xpDiff", scale: 5000 },
  { name: "csDiff", scale: 100 },
  { name: "killDiff", scale: 10 },
  { name: "towerDiff", scale: 5 },
  { name: "inhibitorDiff", scale: 2 },
  { name: "baronDiff", scale: 1 },
  { name: "elderDiff", scale: 1 },
  { name: "dragonDiff", scale: 4 },
  { name: "soulDiff", scale: 1 },
  // Leads matter more as the game goes on.
  { name: "goldDiffByMinute", scale: 150000 },
] as const;
export type FeatureName = (typeof modelFeatures)[number]["name"];

/** The model inputs for a row, or null when a needed difference is unknown. */
export function vectorize(row: FeatureRow): number[] | null {
  if (row.goldDiff === null || row.xpDiff === null || row.csDiff === null) return null;
  // A dragon type absent from the stored counts was not taken.
  const dragons = (t: FeatureRow["blue"]) =>
    dragonTypes.reduce(
      (n, d) => n + ((t.dragons as Partial<FeatureRow["blue"]["dragons"]>)[d] ?? 0),
      0,
    );
  const raw: Record<FeatureName, number> = {
    minute: row.minute,
    goldDiff: row.goldDiff,
    xpDiff: row.xpDiff,
    csDiff: row.csDiff,
    killDiff: row.blue.kills - row.red.kills,
    towerDiff: row.blue.towers - row.red.towers,
    inhibitorDiff: row.blue.inhibitors - row.red.inhibitors,
    baronDiff: row.blue.barons - row.red.barons,
    elderDiff: row.blue.elders - row.red.elders,
    dragonDiff: dragons(row.blue) - dragons(row.red),
    soulDiff: Number(row.blue.soul) - Number(row.red.soul),
    goldDiffByMinute: row.goldDiff * row.minute,
  };
  return modelFeatures.map((f) => raw[f.name] / f.scale);
}

export interface Coefficients {
  intercept: number;
  weights: number[];
}
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export function predict(model: Coefficients, x: readonly number[]) {
  return sigmoid(model.weights.reduce((z, w, i) => z + w * x[i]!, model.intercept));
}

export interface Example {
  matchId: string;
  x: number[];
  y: 0 | 1;
}
/** A seeded generator (mulberry32), so splits are reproducible. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Splits by match, never by row: every row of a match lands on the same side. */
/** Share of matches held out for evaluation. */
export const holdoutShare = 0.2;
/** Training matches a split leaves from this many matches; the split is exact, not random. */
export const trainingMatchesFrom = (matches: number) =>
  matches - Math.round(matches * holdoutShare);
export function splitByMatch(examples: readonly Example[], seed: number, holdout = holdoutShare) {
  const matches = [...new Set(examples.map((e) => e.matchId))].sort();
  const random = seeded(seed);
  for (let i = matches.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [matches[i], matches[j]] = [matches[j]!, matches[i]!];
  }
  const evaluation = new Set(matches.slice(0, Math.round(matches.length * holdout)));
  return {
    train: examples.filter((e) => !evaluation.has(e.matchId)),
    evaluate: examples.filter((e) => evaluation.has(e.matchId)),
  };
}
/** L2-regularized logistic regression; the intercept is not penalized. */
export function train(
  examples: readonly Example[],
  options: { iterations?: number; learningRate?: number; l2?: number } = {},
): Coefficients {
  const { iterations = 500, learningRate = 0.5, l2 = 0.01 } = options;
  const size = examples[0]?.x.length ?? modelFeatures.length;
  const model: Coefficients = { intercept: 0, weights: new Array<number>(size).fill(0) };
  if (!examples.length) return model;
  for (let step = 0; step < iterations; step++) {
    let gradIntercept = 0;
    const grad = new Array<number>(size).fill(0);
    for (const e of examples) {
      const error = predict(model, e.x) - e.y;
      gradIntercept += error;
      for (let i = 0; i < size; i++) grad[i]! += error * e.x[i]!;
    }
    model.intercept -= (learningRate * gradIntercept) / examples.length;
    for (let i = 0; i < size; i++)
      model.weights[i]! -= learningRate * (grad[i]! / examples.length + l2 * model.weights[i]!);
  }
  return model;
}
export interface ReliabilityBin {
  lower: number;
  upper: number;
  count: number;
  /** Mean predicted probability and observed blue win rate in the bin; null when empty. */
  predicted: number | null;
  observed: number | null;
}
export function evaluate(model: Coefficients, examples: readonly Example[], binCount = 10) {
  const bins = Array.from({ length: binCount }, (_, i) => ({
    lower: i / binCount,
    upper: (i + 1) / binCount,
    count: 0,
    sumPredicted: 0,
    sumObserved: 0,
  }));
  let squared = 0;
  for (const e of examples) {
    const p = predict(model, e.x);
    squared += (p - e.y) ** 2;
    const bin = bins[Math.min(binCount - 1, Math.floor(p * binCount))]!;
    bin.count++;
    bin.sumPredicted += p;
    bin.sumObserved += e.y;
  }
  return {
    brier: examples.length ? squared / examples.length : null,
    bins: bins.map((b): ReliabilityBin => ({
      lower: b.lower,
      upper: b.upper,
      count: b.count,
      predicted: b.count ? b.sumPredicted / b.count : null,
      observed: b.count ? b.sumObserved / b.count : null,
    })),
  };
}
