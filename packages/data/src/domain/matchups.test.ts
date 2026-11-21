import { expect, it } from "vitest";
import {
  matchupEstimate,
  championMatchupsQuerySchema,
  matchupMatrixQuerySchema,
} from "./matchups.js";
it("shrinks rates and signed means toward the champion baseline while preserving separate samples", () => {
  expect(matchupEstimate({ total: 8, count: 10 }, { total: 10, count: 20 })).toEqual({
    raw: 0.8,
    shrunk: 0.55,
    sampleCount: 10,
    baseline: 0.5,
    baselineSampleCount: 20,
  });
  expect(matchupEstimate({ total: 1000, count: 10 }, { total: 500, count: 20 })).toEqual({
    raw: 100,
    shrunk: 37.5,
    sampleCount: 10,
    baseline: 25,
    baselineSampleCount: 20,
  });
  expect(matchupEstimate({ total: -100, count: 10 }, { total: 0, count: 20 }).shrunk).toBeCloseTo(
    -100 / 60,
  );
  // Below the minimum the observed value is shown, but it is not shrunk or ranked.
  expect(matchupEstimate({ total: 90, count: 9 }, { total: 100, count: 10 })).toMatchObject({
    raw: 10,
    shrunk: null,
    sampleCount: 9,
    baseline: 10,
  });
  expect(matchupEstimate({ total: null, count: 0 }, { total: null, count: 0 })).toEqual({
    raw: null,
    shrunk: null,
    sampleCount: 0,
    baseline: null,
    baselineSampleCount: 0,
  });
});
it("validates source roles and bounded SQL page and sort inputs", () => {
  expect(championMatchupsQuerySchema.parse({ champion: "Ahri" })).toMatchObject({
    source: "solo",
    role: "MIDDLE",
    value: "shrunk",
    page: 1,
    pageSize: 25,
  });
  for (const bad of [
    { champion: "../x" },
    { champion: "Ahri", role: "ALL" },
    { champion: "Ahri", source: "unknown" },
    { champion: "Ahri", pageSize: 101 },
    { champion: "Ahri", sort: "SQL" },
    { champion: "Ahri", page: 0 },
  ])
    expect(championMatchupsQuerySchema.safeParse(bad).success).toBe(false);
});

it("bounds both matrix axes and rejects arbitrary metrics and roles", () => {
  expect(matchupMatrixQuerySchema.parse({ role: "TOP" })).toMatchObject({
    page: 1,
    columnPage: 1,
    metric: "winRate",
    value: "shrunk",
  });
  for (const input of [
    { role: "ALL" },
    { role: "TOP", columnPage: 0 },
    { role: "TOP", page: 10001 },
    { role: "TOP", metric: "SQL" },
    { role: "TOP", pageSize: 100 },
  ])
    expect(matchupMatrixQuerySchema.safeParse(input).success).toBe(false);
});
