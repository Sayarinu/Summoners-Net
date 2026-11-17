import { describe, expect, it } from "vitest";
import {
  blindability,
  championBlindabilityQuerySchema,
  summarizeOpponents,
  type BlindabilityMatchup,
} from "./blindability.js";

describe("summarizeOpponents", () => {
  it("weights opponent win rates by picks", () => {
    // E = (50·0.6 + 30·0.5 + 20·0.4) / 100 = 0.53
    // Var = (50·0.07² + 30·0.03² + 20·0.13²) / 100 = 0.0061
    // The lowest fifth of 100 picks is exactly the 20 picks of the 0.4 opponent.
    const s = summarizeOpponents([
      { winRate: 0.6, picks: 50 },
      { winRate: 0.5, picks: 30 },
      { winRate: 0.4, picks: 20 },
    ])!;
    expect(s.expected).toBeCloseTo(0.53, 12);
    expect(s.variance).toBeCloseTo(0.0061, 12);
    expect(s.worstCase).toBe(0.4);
    expect(s.lowerTail).toBeCloseTo(0.4, 12);
  });
  it("takes part of the opponent that crosses the tail boundary", () => {
    // The tail is 0.2 · 90 = 18 picks: all 10 at 0.4, then 8 of the 40 at 0.5 → 8 / 18.
    const s = summarizeOpponents([
      { winRate: 0.5, picks: 40 },
      { winRate: 0.6, picks: 40 },
      { winRate: 0.4, picks: 10 },
    ])!;
    expect(s.lowerTail).toBeCloseTo(8 / 18, 12);
    // (40·0.5 + 40·0.6 + 10·0.4) / 90 = 48 / 90
    expect(s.expected).toBeCloseTo(48 / 90, 12);
  });
  it("is null without weighted opponents", () => {
    expect(summarizeOpponents([])).toBeNull();
    expect(summarizeOpponents([{ winRate: 0.5, picks: 0 }])).toBeNull();
  });
});

describe("blindability", () => {
  // Wins 79 of 158 against all opponents: a 0.5 baseline. Shrinking with 50 prior games gives
  // (30 + 25) / 100 = 0.55, 0.5 and (20 + 25) / 100 = 0.45. Opponent 5 has 8 games: excluded.
  const matchups: BlindabilityMatchup[] = [
    { opponentKey: 2, games: 50, winRate: { total: 30, count: 50 } },
    { opponentKey: 3, games: 50, winRate: { total: 25, count: 50 } },
    { opponentKey: 4, games: 50, winRate: { total: 20, count: 50 } },
    { opponentKey: 5, games: 8, winRate: { total: 4, count: 8 } },
  ];
  const picks = (extra: number) =>
    new Map([
      [1, 999],
      [2, 50],
      [3, 30],
      [4, 20],
      [5, extra],
    ]);
  it("scores shrunk matchups weighted by opponent picks, excluding small samples", () => {
    const b = blindability(1, matchups, picks(60));
    expect(b).toMatchObject({
      games: 158,
      sampledOpponents: 4,
      coveredOpponents: 3,
      coveredPicks: 100,
      rolePicks: 160,
      worstCase: 0.45,
      worstOpponentKey: 4,
      reason: null,
    });
    expect(b.expected).toBeCloseTo(0.515, 12);
    // (50·0.035² + 30·0.015² + 20·0.065²) / 100
    expect(b.variance).toBeCloseTo(0.001525, 12);
    expect(b.lowerTail).toBeCloseTo(0.45, 12);
  });
  it("is null with a reason when coverage is too low, keeping the counts", () => {
    expect(blindability(1, matchups, picks(120))).toEqual({
      games: 158,
      sampledOpponents: 4,
      coveredOpponents: 3,
      coveredPicks: 100,
      rolePicks: 220,
      expected: null,
      worstCase: null,
      worstOpponentKey: null,
      variance: null,
      lowerTail: null,
      reason: "low-coverage",
    });
    expect(blindability(1, matchups.slice(2), picks(60)).reason).toBe("few-opponents");
    expect(blindability(1, [], new Map([[1, 10]])).reason).toBe("no-opponent-picks");
  });
  it("leaves unknown results out of the rates instead of counting them as losses", () => {
    const unknown = blindability(
      1,
      [{ opponentKey: 2, games: 12, winRate: { total: null, count: 0 } }],
      picks(0),
    );
    expect(unknown).toMatchObject({ games: 12, coveredOpponents: 0, expected: null });
  });
  it("validates the stored-score query", () => {
    expect(() =>
      championBlindabilityQuerySchema.parse({
        championKey: 0,
        source: "solo",
        patch: "16.1",
        role: "MIDDLE",
      }),
    ).toThrow();
    expect(() =>
      championBlindabilityQuerySchema.parse({
        championKey: 1,
        source: "all",
        patch: "16.1",
        role: "MIDDLE",
      }),
    ).toThrow();
  });
});
