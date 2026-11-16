import { describe, expect, it } from "vitest";
import {
  applySamplePolicy,
  deltaVersusExpected,
  fitRatePrior,
  shrinkRate,
  wilsonInterval,
} from "./statistics.js";

const close = (value: number | null) => (value === null ? null : Number(value.toFixed(4)));
const interval = (s: number | null, n: number | null) => {
  const r = wilsonInterval(s, n);
  return [close(r.value), close(r.lower), close(r.upper), r.sampleCount];
};

describe("Wilson score intervals", () => {
  it("gives no rate for zero games or missing counts, never zero", () => {
    expect(wilsonInterval(0, 0)).toEqual({ value: null, sampleCount: 0, lower: null, upper: null });
    expect(wilsonInterval(null, 10)).toEqual({
      value: null,
      sampleCount: 0,
      lower: null,
      upper: null,
    });
    expect(wilsonInterval(3, undefined).value).toBeNull();
  });
  it("stays inside [0, 1] for all wins and all losses", () => {
    expect(interval(10, 10)).toEqual([1, 0.7225, 1, 10]);
    expect(interval(0, 10)).toEqual([0, 0, 0.2775, 10]);
  });
  it("is wide for very small samples and narrows with more games", () => {
    expect(interval(1, 1)).toEqual([1, 0.2065, 1, 1]);
    expect(interval(5, 10)).toEqual([0.5, 0.2366, 0.7634, 10]);
    const big = wilsonInterval(500, 1000);
    expect(big.upper! - big.lower!).toBeLessThan(0.07);
  });
  it("rejects inconsistent counts", () => {
    expect(() => wilsonInterval(3, 2)).toThrow(RangeError);
    expect(() => wilsonInterval(-1, 2)).toThrow(RangeError);
    expect(() => wilsonInterval(1.5, 2)).toThrow(RangeError);
  });
});

describe("empirical-Bayes shrinkage", () => {
  const groups = [
    { successes: 60, trials: 100 },
    { successes: 40, trials: 100 },
    { successes: 55, trials: 100 },
    { successes: 45, trials: 100 },
  ];
  it("fits a baseline and strength from many groups", () => {
    const prior = fitRatePrior(groups)!;
    expect(prior.baseline).toBe(0.5);
    expect(prior.strength).toBeGreaterThan(0);
    expect(prior.strength).toBeLessThan(10000);
  });
  it("cannot fit a prior from too few groups or a pooled rate of 0 or 1", () => {
    expect(fitRatePrior([])).toBeNull();
    expect(
      fitRatePrior([
        { successes: 5, trials: 10 },
        { successes: 0, trials: 0 },
      ]),
    ).toBeNull();
    expect(
      fitRatePrior([
        { successes: 0, trials: 5 },
        { successes: 0, trials: 9 },
      ]),
    ).toBeNull();
    expect(
      fitRatePrior([
        { successes: 5, trials: 5 },
        { successes: 9, trials: 9 },
      ]),
    ).toBeNull();
    expect(
      fitRatePrior([
        { successes: null, trials: 5 },
        { successes: 1, trials: 2 },
      ]),
    ).toBeNull();
  });
  it("pools fully when the spread is no larger than sampling noise", () => {
    const prior = fitRatePrior([
      { successes: 50, trials: 100 },
      { successes: 50, trials: 100 },
    ]);
    expect(prior).toEqual({ baseline: 0.5, strength: 10000 });
  });
  it("pulls small samples harder than large ones", () => {
    const prior = { baseline: 0.5, strength: 20 };
    expect(shrinkRate(1, 1, prior).value).toBeCloseTo(11 / 21);
    expect(shrinkRate(1, 1, prior).sampleCount).toBe(1);
    expect(shrinkRate(10, 10, prior).value).toBeCloseTo(20 / 30);
    expect(shrinkRate(0, 10, prior).value).toBeCloseTo(10 / 30);
    expect(shrinkRate(700, 1000, prior).value).toBeCloseTo(710 / 1020);
    expect(shrinkRate(0, 0, prior)).toEqual({ value: 0.5, sampleCount: 0 });
  });
  it("gives null for missing inputs or no prior", () => {
    expect(shrinkRate(null, 10, { baseline: 0.5, strength: 1 })).toEqual({
      value: null,
      sampleCount: 0,
    });
    expect(shrinkRate(3, 10, null)).toEqual({ value: null, sampleCount: 10 });
    expect(shrinkRate(0, 0, { baseline: 0.5, strength: 0 })).toEqual({
      value: null,
      sampleCount: 0,
    });
    expect(() => shrinkRate(1, 2, { baseline: 2, strength: 1 })).toThrow(RangeError);
    expect(() => shrinkRate(1, 2, { baseline: 0.5, strength: -1 })).toThrow(RangeError);
  });
});

describe("delta versus expected", () => {
  it("subtracts the expectation and keeps the sample count", () => {
    expect(deltaVersusExpected({ value: 0.6, sampleCount: 40 }, 0.5).value).toBeCloseTo(0.1);
    expect(deltaVersusExpected({ value: 0.6, sampleCount: 40 }, 0.5).sampleCount).toBe(40);
    expect(deltaVersusExpected({ value: null, sampleCount: 0 }, 0.5)).toEqual({
      value: null,
      sampleCount: 0,
    });
    expect(deltaVersusExpected({ value: 0.4, sampleCount: 3 }, null)).toEqual({
      value: null,
      sampleCount: 3,
    });
  });
});

describe("minimum-sample policy", () => {
  it("hides, flags or shows a value by its sample count", () => {
    expect(applySamplePolicy({ value: 1, sampleCount: 3 })).toEqual({
      value: null,
      sampleCount: 3,
      status: "hidden",
    });
    expect(applySamplePolicy({ value: 0.6, sampleCount: 20 }).status).toBe("low-sample");
    expect(applySamplePolicy({ value: 0, sampleCount: 50 })).toEqual({
      value: 0,
      sampleCount: 50,
      status: "shown",
    });
    expect(applySamplePolicy({ value: null, sampleCount: 500 }).status).toBe("hidden");
    expect(
      applySamplePolicy({ value: 0.5, sampleCount: 2 }, { minimum: 1, reliable: 1 }).status,
    ).toBe("shown");
  });
  it("hides the interval with the value", () => {
    expect(applySamplePolicy(wilsonInterval(1, 1))).toEqual({
      value: null,
      sampleCount: 1,
      lower: null,
      upper: null,
      status: "hidden",
    });
    expect(applySamplePolicy(wilsonInterval(30, 60)).lower).not.toBeNull();
  });
  it("rejects an inconsistent policy", () => {
    expect(() =>
      applySamplePolicy({ value: 1, sampleCount: 1 }, { minimum: 5, reliable: 2 }),
    ).toThrow(RangeError);
  });
});
