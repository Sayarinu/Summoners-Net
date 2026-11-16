import { describe, expect, it } from "vitest";
import {
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
