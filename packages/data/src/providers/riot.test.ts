import { describe, expect, it } from "vitest";
import challenger from "../../tests/riot/challenger-euw1.json" with { type: "json" };
import account from "../../tests/riot/account.json" with { type: "json" };
import matchIds from "../../tests/riot/match-ids-euw1.json" with { type: "json" };
import {
  accountRoute,
  matchRoute,
  parseMatchCap,
  parseMatchIds,
  parseAccount,
  parseLeagueList,
  parseRiotPlatforms,
  parseRateLimitHeader,
  parseRiotKeyConfig,
  riotKeyCheckResult,
  riotKeyFingerprint,
} from "./riot.js";

const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
describe("Riot key configuration", () => {
  it("treats an empty key as not configured and defaults to a development key", () => {
    expect(parseRiotKeyConfig({})).toBeUndefined();
    expect(parseRiotKeyConfig({ RIOT_API_KEY: "  " })).toBeUndefined();
    expect(parseRiotKeyConfig({ RIOT_API_KEY: ` ${key} ` })).toEqual({ key, kind: "development" });
    expect(parseRiotKeyConfig({ RIOT_API_KEY: key, RIOT_API_KEY_KIND: "production" })).toEqual({
      key,
      kind: "production",
    });
  });
  it("rejects malformed input at startup without echoing the key", () => {
    const malformed = "RGAPI-not-a-real-key-secret";
    expect(() => parseRiotKeyConfig({ RIOT_API_KEY: malformed })).toThrow(/RIOT_API_KEY/);
    try {
      parseRiotKeyConfig({ RIOT_API_KEY: malformed });
    } catch (error) {
      expect((error as Error).message).not.toContain(malformed);
    }
    expect(() => parseRiotKeyConfig({ RIOT_API_KEY_KIND: "temporary" })).toThrow(
      "RIOT_API_KEY_KIND",
    );
  });
  it("fingerprints without revealing the key and classifies check responses", () => {
    expect(riotKeyFingerprint(key)).toMatch(/^[0-9a-f]{16}$/);
    expect(riotKeyFingerprint(key)).not.toBe(riotKeyFingerprint(key.replace("0", "1")));
    expect(riotKeyCheckResult(200)).toBe("valid");
    expect(riotKeyCheckResult(401)).toBe("rejected");
    expect(riotKeyCheckResult(403)).toBe("rejected");
    expect(riotKeyCheckResult(429)).toBe("retry");
    expect(riotKeyCheckResult(503)).toBe("retry");
  });
});
describe("Riot rate limit headers", () => {
  it("parses each limit window and ignores malformed headers", () => {
    expect(parseRateLimitHeader("20:1,100:120")).toEqual([
      { limit: 20, windowSeconds: 1 },
      { limit: 100, windowSeconds: 120 },
    ]);
    expect(parseRateLimitHeader(" 2000:10 ")).toEqual([{ limit: 2000, windowSeconds: 10 }]);
    for (const value of [null, "", "20", "20:0", "0:1", "20:1,abc", "20:1;100:120"])
      expect(parseRateLimitHeader(value)).toBeNull();
  });
});
describe("league-v4 ladders", () => {
  it("keeps Riot identifiers, rank and record, with summoner id only where returned", () => {
    const entries = parseLeagueList(challenger, "CHALLENGER");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      puuid: challenger.entries[0]!.puuid,
      summonerId: "bW9ja1N1bW1vbmVySWQtb25l",
      tier: "CHALLENGER",
      rank: "I",
      leaguePoints: 1824,
      wins: 412,
      losses: 351,
      leagueId: null,
    });
    expect(entries[1]!.summonerId).toBeNull();
  });
  it("keeps a league id where an older response still returns one", () => {
    const entries = parseLeagueList({ ...challenger, leagueId: "league-1" }, "CHALLENGER");
    expect(entries.map((e) => e.leagueId)).toEqual(["league-1", "league-1"]);
  });
  it("rejects a ladder for another tier or queue, or with malformed entries", () => {
    expect(() => parseLeagueList(challenger, "MASTER")).toThrow();
    expect(() =>
      parseLeagueList({ ...challenger, queue: "RANKED_FLEX_SR" }, "CHALLENGER"),
    ).toThrow();
    expect(() =>
      parseLeagueList(
        { ...challenger, entries: [{ ...challenger.entries[0], wins: -1 }] },
        "CHALLENGER",
      ),
    ).toThrow();
  });
  it("validates platform selection against the known list", () => {
    expect(parseRiotPlatforms(undefined)).toEqual([]);
    expect(parseRiotPlatforms(" EUW1, kr ,euw1")).toEqual(["euw1", "kr"]);
    expect(() => parseRiotPlatforms("euw1,europe")).toThrow("RIOT_PLATFORMS");
    expect(() => parseRiotPlatforms("na")).toThrow("RIOT_PLATFORMS");
  });
});
describe("account-v1", () => {
  it("keeps the PUUID and Riot ID, and rejects an account for another PUUID", () => {
    expect(parseAccount(account, account.puuid)).toEqual({
      puuid: account.puuid,
      gameName: "Midlane Fox",
      tagLine: "EUW",
    });
    expect(parseAccount({ puuid: account.puuid }, account.puuid)).toEqual({
      puuid: account.puuid,
      gameName: null,
      tagLine: null,
    });
    expect(() => parseAccount(account, "another-puuid-of-sufficient-length")).toThrow();
  });
  it("routes each platform to an account-v1 region", () => {
    expect(accountRoute("na1")).toBe("americas");
    expect(accountRoute("euw1")).toBe("europe");
    expect(accountRoute("kr")).toBe("asia");
    expect(accountRoute("sg2")).toBe("asia");
  });
});
describe("match-v5 ids", () => {
  it("parses match ids and rejects anything else", () => {
    expect(parseMatchIds(matchIds)).toEqual(matchIds);
    expect(() => parseMatchIds(["EUW1-123"])).toThrow();
    expect(() => parseMatchIds([1234])).toThrow();
    expect(() => parseMatchIds(Array.from({ length: 101 }, (_, i) => `EUW1_${i}`))).toThrow();
  });
  it("routes platforms to match-v5 regions", () => {
    expect(matchRoute("euw1")).toBe("europe");
    expect(matchRoute("kr")).toBe("asia");
    expect(matchRoute("br1")).toBe("americas");
    expect(matchRoute("oc1")).toBe("sea");
  });
  it("validates the per-patch cap", () => {
    expect(parseMatchCap(undefined)).toBe(2000);
    expect(parseMatchCap(" 500 ")).toBe(500);
    for (const bad of ["0", "-1", "1.5", "lots", "2000000"])
      expect(() => parseMatchCap(bad)).toThrow("RIOT_MATCH_CAP");
  });
});
