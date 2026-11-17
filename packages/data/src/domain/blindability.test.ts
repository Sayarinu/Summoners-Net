import { describe, expect, it } from "vitest";
import {
  bestResponses,
  blindability,
  roleDraftValues,
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

describe("counter-pick values", () => {
  // Every pair has 50 games and every champion wins 75 of 150, a 0.5 baseline, so each shrunk
  // rate is (wins + 25) / 100. Champion 5 wins 10 of 50 against 1, 2 and 3: (10 + 10) / 100 = 0.2.
  const wins: Record<number, Record<number, number>> = {
    1: { 2: 30, 3: 25, 4: 20 },
    2: { 1: 20, 3: 30, 4: 25 },
    3: { 1: 25, 2: 20, 4: 30 },
    4: { 1: 30, 2: 25, 3: 20 },
    5: { 1: 10, 2: 10, 3: 10 },
  };
  const samples = new Map(
    Object.entries(wins).map(([champion, row]) => [
      Number(champion),
      Object.entries(row).map(([opponent, w]) => ({
        opponentKey: Number(opponent),
        games: 50,
        winRate: { total: w, count: 50 },
      })),
    ]),
  );
  const picks = new Map([
    [1, 100],
    [2, 200],
    [3, 300],
    [4, 400],
    [5, 50],
  ]);
  it("picks the champion with the highest shrunk rate against each enemy", () => {
    // Enemy 1: 2 → 0.45, 3 → 0.50, 4 → 0.55. Enemy 2: 1 → 0.55. Enemy 3: 2 → 0.55. Enemy 4: 3 → 0.55.
    const rates = new Map(
      [...samples].map(([c, m]) => [
        c,
        new Map(m.map((o) => [o.opponentKey, (o.winRate.total! + 25) / 100])),
      ]),
    );
    expect(bestResponses(rates)).toEqual(
      new Map([
        [1, 4],
        [2, 1],
        [3, 2],
        [4, 3],
      ]),
    );
    // Equal rates go to the lower champion key.
    expect(
      bestResponses(
        new Map([
          [7, new Map([[9, 0.6]])],
          [6, new Map([[9, 0.6]])],
        ]),
      ),
    ).toEqual(new Map([[9, 6]]));
  });
  it("compares the pick-weighted blind rate with the rate into best-response enemies", () => {
    const values = roleDraftValues(samples, picks);
    // Champion 1 blind: (200·0.55 + 300·0.50 + 400·0.45) / 900 = 440 / 900.
    // It is the best response only to enemy 2 (200 picks), at 0.55.
    const one = values.get(1)!;
    expect(one.expected).toBeCloseTo(440 / 900, 12);
    expect(one).toMatchObject({ counterOpponents: 1, counterPicks: 200, counterReason: null });
    expect(one.counterWinRate).toBeCloseTo(0.55, 12);
    // Champion 4 blind: (100·0.55 + 200·0.50 + 300·0.45) / 600 = 290 / 600; counters enemy 1 at 0.55.
    const four = values.get(4)!;
    expect(four.expected).toBeCloseTo(290 / 600, 12);
    expect(four.counterWinRate! - four.expected!).toBeCloseTo(0.55 - 290 / 600, 12);
    // Champion 5 has a blind rate but is never the best response.
    expect(values.get(5)).toMatchObject({
      counterWinRate: null,
      counterOpponents: 0,
      counterPicks: 0,
      counterReason: "never-best-response",
      reason: null,
    });
    expect(values.get(5)!.expected).toBeCloseTo(0.2, 12);
  });
  it("leaves the counter-pick rate unknown when the blind rate has too little coverage", () => {
    const thin = roleDraftValues(new Map([[1, samples.get(1)!.slice(0, 2)]]), picks);
    expect(thin.get(1)).toMatchObject({
      reason: "few-opponents",
      expected: null,
      counterWinRate: null,
      counterOpponents: 2,
      counterReason: "blind-unavailable",
    });
  });
});
