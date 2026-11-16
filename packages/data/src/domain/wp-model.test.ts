import { describe, expect, it } from "vitest";
import {
  evaluate,
  predict,
  seeded,
  splitByMatch,
  train,
  vectorize,
  type Example,
} from "./wp-model.js";
import type { FeatureRow } from "./wp-features.js";

// A synthetic, separable fixture: blue wins exactly when it leads in gold.
function fixture(matches: number): Example[] {
  const random = seeded(7);
  return Array.from({ length: matches }, (_, m) => {
    // Leads of 500 to 4,000 gold either way, so every row is separable.
    const lead = (random() < 0.5 ? -1 : 1) * (500 + random() * 3500);
    return Array.from({ length: 10 }, (_, minute) => ({
      matchId: `M${m}`,
      x: [minute / 30, lead / 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      y: lead > 0 ? (1 as const) : (0 as const),
    }));
  }).flat();
}

describe("win probability model", () => {
  it("learns a separable fixture and is calibrated toward the right side", () => {
    const { train: training, evaluate: held } = splitByMatch(fixture(200), 42);
    const model = train(training);
    expect(model.weights[1]).toBeGreaterThan(1);
    const result = evaluate(model, held);
    expect(result.brier).toBeLessThan(0.1);
    expect(result.bins).toHaveLength(10);
    expect(result.bins.reduce((n, b) => n + b.count, 0)).toBe(held.length);
    const strong = [0.3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(predict(model, strong)).toBeGreaterThan(0.9);
    expect(
      predict(
        model,
        strong.map((v, i) => (i === 1 ? -v : v)),
      ),
    ).toBeLessThan(0.1);
  });
  it("splits by match, never by row, and is deterministic for a seed", () => {
    const examples = fixture(50);
    const a = splitByMatch(examples, 1);
    const trainMatches = new Set(a.train.map((e) => e.matchId));
    expect(a.evaluate.some((e) => trainMatches.has(e.matchId))).toBe(false);
    expect(new Set(a.evaluate.map((e) => e.matchId)).size).toBe(10);
    expect(splitByMatch(examples, 1)).toEqual(a);
    expect(splitByMatch(examples, 2).evaluate).not.toEqual(a.evaluate);
    expect(train(a.train)).toEqual(train(a.train));
  });
  it("vectorizes feature rows, refusing unknown differences, and handles empty data", () => {
    const counts = {
      kills: 3,
      towers: 1,
      inhibitors: 0,
      barons: 1,
      elders: 0,
      soul: true,
      dragons: {
        AIR_DRAGON: 1,
        CHEMTECH_DRAGON: 0,
        EARTH_DRAGON: 0,
        FIRE_DRAGON: 1,
        HEXTECH_DRAGON: 0,
        WATER_DRAGON: 0,
      },
    };
    const row: FeatureRow = {
      minute: 20,
      timestampMs: 1200000,
      goldDiff: 2500,
      xpDiff: 1000,
      csDiff: 20,
      blue: counts,
      red: { ...counts, kills: 1, soul: false, barons: 0 },
      blueWin: true,
    };
    expect(vectorize(row)).toEqual([
      20 / 30,
      0.5,
      0.2,
      0.2,
      0.2,
      0,
      0,
      1,
      0,
      0,
      1,
      (2500 * 20) / 150000,
    ]);
    expect(vectorize({ ...row, goldDiff: null })).toBeNull();
    // Stored counts that omit a dragon type mean none of that type.
    expect(
      vectorize({ ...row, red: { ...row.red, dragons: {} as typeof counts.dragons } })![9],
    ).toBe(0.5);
    expect(train([])).toEqual({ intercept: 0, weights: new Array(12).fill(0) });
    expect(evaluate(train([]), []).brier).toBeNull();
  });
});
