import { describe, expect, it } from "vitest";
import fixture from "../../tests/riot/match-euw1.json" with { type: "json" };
import { parseRiotMatch } from "./riot-match.js";

const id = "EUW1_7612345678";
const clone = () => structuredClone(fixture) as typeof fixture & Record<string, unknown>;
describe("match-v5 match parser", () => {
  it("keeps Riot's identifiers and normalizes participants, items, runes and objectives", () => {
    const match = parseRiotMatch(fixture, id);
    expect(match).toMatchObject({
      matchId: id,
      platformId: "EUW1",
      queueId: 420,
      gameVersion: "16.22.734.5521",
      durationSeconds: 1834,
      endOfGameResult: "GameComplete",
      remake: false,
    });
    expect(match.participants).toHaveLength(10);
    const ahri = match.participants[0]!;
    expect(ahri).toMatchObject({
      participantId: 1,
      championId: 103,
      side: "blue",
      teamPosition: "MIDDLE",
      win: true,
      summoner1Id: 4,
      summoner2Id: 14,
      statPerks: { defense: 5001, flex: 5008, offense: 5005 },
    });
    // Empty inventory slots (item id 0) are not items.
    expect(ahri.items).toEqual([
      { slot: 0, itemId: 3089 },
      { slot: 1, itemId: 3020 },
      { slot: 3, itemId: 4645 },
      { slot: 6, itemId: 3340 },
    ]);
    expect(ahri.perks.map((p) => [p.style, p.slot, p.perkId])).toEqual([
      ["primary", 0, 8112],
      ["primary", 1, 8139],
      ["primary", 2, 8138],
      ["primary", 3, 8135],
      ["sub", 0, 8226],
      ["sub", 1, 8210],
    ]);
    expect(match.participants[9]!.side).toBe("red");
    const blue = match.teams[0]!;
    expect(blue).toMatchObject({ teamId: 100, side: "blue", win: true });
    // A ban of -1 is "no ban".
    expect(blue.bans).toEqual([{ championId: 238, pickTurn: 1 }]);
    expect(blue.objectives).toContainEqual({ name: "baron", first: true, kills: 1 });
    expect(blue.objectives).toContainEqual({ name: "atakhan", first: false, kills: 0 });
  });
  it("keeps missing statistics null and reads legacy millisecond durations", () => {
    const partial = clone();
    const p = partial.info.participants[0] as Record<string, unknown>;
    for (const field of ["kills", "goldEarned", "win", "perks", "item0", "summoner1Id"])
      delete p[field];
    delete (partial.info as Record<string, unknown>).gameEndTimestamp;
    partial.info.gameDuration = 1834000;
    (partial.info.participants[1] as Record<string, unknown>).gameEndedInEarlySurrender = undefined;
    const match = parseRiotMatch(partial, id);
    expect(match.durationSeconds).toBe(1834);
    expect(match.remake).toBeNull();
    expect(match.participants[0]).toMatchObject({
      kills: null,
      goldEarned: null,
      win: null,
      summoner1Id: null,
      statPerks: { defense: null, flex: null, offense: null },
      perks: [],
    });
    expect(match.participants[0]!.items.map((i) => i.slot)).toEqual([1, 3, 6]);
  });
  it("flags remakes and rejects payloads for another match or without identifiers", () => {
    const remake = clone();
    (remake.info.participants[3] as Record<string, unknown>).gameEndedInEarlySurrender = true;
    expect(parseRiotMatch(remake, id).remake).toBe(true);
    expect(() => parseRiotMatch(fixture, "EUW1_1")).toThrow("another match");
    const noPuuid = clone();
    delete (noPuuid.info.participants[0] as Record<string, unknown>).puuid;
    expect(() => parseRiotMatch(noPuuid, id)).toThrow();
    const duplicate = clone();
    (duplicate.info.participants[1] as Record<string, unknown>).participantId = 1;
    expect(() => parseRiotMatch(duplicate, id)).toThrow("Duplicate");
  });
});
