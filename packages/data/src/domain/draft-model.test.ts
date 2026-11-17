import { describe, expect, it } from "vitest";
import {
  draftFeatureValues,
  trainingCounts,
  type Counts,
  type DraftGame,
  type DraftLookup,
} from "./draft-model.js";

describe("draftFeatureValues", () => {
  // Blue: 1 (TOP), 2 (MIDDLE). Red: 3 (TOP), 4 (MIDDLE).
  const strength: Record<number, Counts> = {
    1: { wins: 60, games: 100 }, // +0.10
    2: { wins: 5, games: 8 }, // below the minimum: excluded
    3: { wins: 45, games: 100 }, // −0.05
    4: { wins: 50, games: 100 }, // 0
  };
  const lookup: DraftLookup = {
    strength: (key) => strength[key] ?? null,
    lane: (key, opponent) =>
      key === 1 && opponent === 3
        ? { wins: 30, games: 50 }
        : key === 2 && opponent === 4
          ? { wins: 4, games: 5 }
          : null,
    laneBaseline: (key) => strength[key] ?? null,
    duo: (a, b) =>
      a.championKey === 1 && b.championKey === 2
        ? { wins: 20, games: 30 }
        : a.championKey === 3 && b.championKey === 4
          ? { wins: 12, games: 20 }
          : null,
  };
  const teams = {
    blue: [
      { championKey: 1, role: "TOP" as const },
      { championKey: 2, role: "MIDDLE" as const },
    ],
    red: [
      { championKey: 3, role: "TOP" as const },
      { championKey: 4, role: "MIDDLE" as const },
    ],
  };
  it("sums known inputs from blue's side and reports coverage", () => {
    const f = draftFeatureValues(teams, lookup);
    // Strength: 0.10 − (−0.05 + 0) = 0.15, scaled by 10.
    expect(f.x[0]).toBeCloseTo(1.5, 12);
    // Top lane: (30 + 50 · 0.6) / (50 + 50) = 0.6, so +0.10; mid has only 5 games.
    expect(f.x[1]).toBeCloseTo(1, 12);
    // Blue's pair has no expected rate (2 is below the minimum). Red's pair: 0.6 against an
    // expected 0.45 + 0.5 − 0.5 = 0.45, shrunk to 0.15 · 20 / 70, counted against blue.
    expect(f.x[2]).toBeCloseTo((-0.15 * 20 * 10) / 70, 12);
    expect(f.coverage).toEqual({
      strength: { known: 3, total: 4 },
      lane: { known: 1, total: 2 },
      synergy: { known: 1, total: 2 },
    });
    expect(f.inputs.find((i) => i.kind === "lane" && i.role === "MIDDLE")).toEqual({
      kind: "lane",
      side: "blue",
      role: "MIDDLE",
      championKeys: [2, 4],
      value: null,
      sampleCount: 5,
    });
  });
  it("has no lane input for a role only one side has picked, and zero features without data", () => {
    const empty: DraftLookup = {
      strength: () => null,
      lane: () => null,
      laneBaseline: () => null,
      duo: () => null,
    };
    const f = draftFeatureValues({ blue: teams.blue, red: teams.red.slice(0, 1) }, empty);
    expect(f.x).toEqual([0, 0, 0]);
    expect(f.coverage).toEqual({
      strength: { known: 0, total: 3 },
      lane: { known: 0, total: 1 },
      synergy: { known: 0, total: 1 },
    });
  });
});

describe("trainingCounts", () => {
  const game = (matchId: string, blueWin: boolean): DraftGame => ({
    matchId,
    patch: "16.22",
    blueWin,
    teams: {
      blue: [
        { championKey: 1, role: "TOP" },
        { championKey: 2, role: "JUNGLE" },
      ],
      red: [{ championKey: 3, role: "TOP" }],
    },
  });
  const one = game("a", true),
    two = game("b", false);
  const counts = trainingCounts([one, two]);
  it("leaves a training game's own result out of its features", () => {
    const loo = counts.lookupFor(one, true);
    expect(loo.strength(1, "TOP")).toEqual({ wins: 0, games: 1 });
    expect(loo.lane(1, 3, "TOP")).toEqual({ wins: 0, games: 1 });
    expect(loo.lane(3, 1, "TOP")).toEqual({ wins: 1, games: 1 });
    expect(loo.duo({ championKey: 2, role: "JUNGLE" }, { championKey: 1, role: "TOP" })).toEqual({
      wins: 0,
      games: 1,
    });
    // Without leaving out, a held-out game sees the full training counts.
    const full = counts.lookupFor(one, false);
    expect(full.strength(1, "TOP")).toEqual({ wins: 1, games: 2 });
    expect(full.laneBaseline(3, "TOP")).toEqual({ wins: 1, games: 2 });
  });
  it("is null where nothing remains or nothing was observed", () => {
    const solo = trainingCounts([one]).lookupFor(one, true);
    expect(solo.strength(1, "TOP")).toBeNull();
    expect(counts.lookupFor(one, false).strength(9, "TOP")).toBeNull();
    expect(
      { ...counts.lookupFor({ ...one, patch: "16.21" }, false) }.strength(1, "TOP"),
    ).toBeNull();
  });
});
