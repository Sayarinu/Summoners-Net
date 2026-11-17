import { describe, expect, it } from "vitest";
import {
  draftAssistantQuerySchema,
  rankDraftCandidates,
  type DraftCandidateInput,
} from "./draft-assistant.js";

const champion = (championKey: number) => ({
  championKey,
  championId: `C${championKey}`,
  name: null,
  imageUrl: null,
});
// A: 0.5 baseline; 30 of 50 against the laner shrinks to (30 + 25) / 100 = 0.55 (+0.05). A duo of
// 60 wins in 100 against an expected 0.5 is +0.1, shrunk to 0.1 · 100 / 150. Blindability 0.48.
const a: DraftCandidateInput = {
  champion: champion(1),
  games: 150,
  baseline: { total: 75, count: 150 },
  laneMatchup: { total: 30, count: 50 },
  blindability: { score: 0.48, coveredPicks: 900 },
  allies: [{ result: { games: 100, wins: 60 }, expected: 0.5 }],
};
// B: only 3 lane games and 5 duo games, both below the minimum of 10; blindability 0.6.
const b: DraftCandidateInput = {
  champion: champion(2),
  games: 80,
  baseline: { total: 40, count: 80 },
  laneMatchup: { total: 2, count: 3 },
  blindability: { score: 0.6, coveredPicks: 700 },
  allies: [{ result: { games: 5, wins: 5 }, expected: 0.5 }],
};
// C: never met the laner; a duo of 45 in 100 is −0.05, shrunk to −0.05 · 100 / 150. No blindability.
const c: DraftCandidateInput = {
  champion: champion(3),
  games: 60,
  baseline: { total: 30, count: 60 },
  laneMatchup: null,
  blindability: { score: null, coveredPicks: 20 },
  allies: [{ result: { games: 100, wins: 45 }, expected: 0.5 }],
};
const synergyA = (0.1 * 100) / 150,
  synergyC = (-0.05 * 100) / 150;

describe("rankDraftCandidates", () => {
  it("averages the lane matchup and synergy once the lane opponent is picked", () => {
    const ranked = rankDraftCandidates([b, c, a], true);
    expect(ranked.map((r) => r.champion.championKey)).toEqual([1, 3, 2]);
    const [first, second, last] = ranked as [
      (typeof ranked)[0],
      (typeof ranked)[0],
      (typeof ranked)[0],
    ];
    expect(first.matchup?.sampleCount).toBe(50);
    expect(first.matchup?.value).toBeCloseTo(0.05, 12);
    expect(first.synergy?.sampleCount).toBe(100);
    expect(first.synergy?.value).toBeCloseTo(synergyA, 12);
    expect(first.blindability).toBeNull();
    expect(first.score).toBeCloseTo((0.05 + synergyA) / 2, 12);
    expect(first.parts).toBe(2);
    // An unknown part is left out of the mean, not counted as zero.
    expect(second).toMatchObject({ matchup: null, parts: 1 });
    expect(second.score).toBeCloseTo(synergyC, 12);
    // Small samples keep their counts and rank last with no score.
    expect(last).toMatchObject({
      matchup: { value: null, sampleCount: 3 },
      synergy: { value: null, sampleCount: 5 },
      score: null,
      parts: 0,
    });
  });
  it("uses blindability while the lane opponent is unknown", () => {
    const unknownLane = [a, b, c].map((x) => ({ ...x, laneMatchup: null }));
    const ranked = rankDraftCandidates(unknownLane, false);
    expect(ranked.map((r) => r.champion.championKey)).toEqual([2, 1, 3]);
    expect(ranked[0]).toMatchObject({ blindability: { sampleCount: 700 }, parts: 1 });
    expect(ranked[0]!.blindability?.value).toBeCloseTo(0.1, 12);
    expect(ranked[1]!.score).toBeCloseTo((-0.02 + synergyA) / 2, 12);
    expect(ranked[2]).toMatchObject({ blindability: { value: null, sampleCount: 20 }, parts: 1 });
  });
  it("breaks score ties by lane games, then champion key", () => {
    const flat = (key: number, games: number): DraftCandidateInput => ({
      ...c,
      champion: champion(key),
      games,
      allies: [],
    });
    expect(
      rankDraftCandidates([flat(9, 10), flat(8, 10), flat(7, 20)], true).map(
        (r) => r.champion.championKey,
      ),
    ).toEqual([7, 8, 9]);
  });
});

describe("draftAssistantQuerySchema", () => {
  it("parses comma-separated picks with optional roles and bans", () => {
    expect(
      draftAssistantQuerySchema.parse({
        side: "red",
        role: "TOP",
        blue: "Ahri:MIDDLE, LeeSin ,",
        red: "Nunu:JUNGLE",
        bans: "Zed,Yasuo",
      }),
    ).toMatchObject({
      source: "solo",
      side: "red",
      role: "TOP",
      blue: [
        { champion: "Ahri", role: "MIDDLE" },
        { champion: "LeeSin", role: null },
      ],
      red: [{ champion: "Nunu", role: "JUNGLE" }],
      bans: ["Zed", "Yasuo"],
    });
    expect(draftAssistantQuerySchema.parse({})).toMatchObject({ blue: [], red: [], bans: [] });
  });
  it.each([
    [{ blue: "Ahri,Ahri" }],
    [{ blue: "Ahri", red: "Ahri" }],
    [{ blue: "Ahri:MIDDLE", role: "MIDDLE" }],
    [{ red: "Ahri:TOP,Zed:TOP" }],
    [{ blue: "Ahri:SUPPORT" }],
    [{ blue: "A,B,C,D,E,F" }],
    [{ bans: "../x" }],
    [{ side: "purple" }],
    [{ extra: "1" }],
  ])("rejects %o", (input) => {
    expect(draftAssistantQuerySchema.safeParse(input).success).toBe(false);
  });
});
