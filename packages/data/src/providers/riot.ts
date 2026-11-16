import { createHash } from "node:crypto";
import { z } from "zod";
import { riotPlatforms, type RiotPlatform } from "../domain/riot-platforms.js";
export { riotPlatforms, type RiotPlatform } from "../domain/riot-platforms.js";

export const riotKeyKinds = ["development", "personal", "production"] as const;
export type RiotKeyKind = (typeof riotKeyKinds)[number];
export interface RiotKeyConfig {
  key: string;
  kind: RiotKeyKind;
}
/** Development keys stop working 24 hours after they are generated. */
export const developmentKeyLifetimeMs = 24 * 3600000;
// Any platform answers for a valid key; status-v4 is the cheapest authenticated endpoint.
export const riotKeyCheckPath = "/lol/status/v4/platform-data";

/**
 * Validates RIOT_API_KEY and RIOT_API_KEY_KIND at startup. An empty key means Riot is not
 * configured. Error messages never include the key.
 */
export function parseRiotKeyConfig(
  env: Record<string, string | undefined> & {
    RIOT_API_KEY?: string | undefined;
    RIOT_API_KEY_KIND?: string | undefined;
  },
): RiotKeyConfig | undefined {
  const key = env.RIOT_API_KEY?.trim();
  const kind = z.enum(riotKeyKinds).safeParse(env.RIOT_API_KEY_KIND?.trim() || "development");
  if (!kind.success)
    throw new Error(`RIOT_API_KEY_KIND must be one of: ${riotKeyKinds.join(", ")}.`);
  if (!key) return undefined;
  if (!/^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))
    throw new Error("RIOT_API_KEY is not a Riot API key (expected RGAPI- followed by a UUID).");
  return { key, kind: kind.data };
}
export const riotKeyFingerprint = (key: string) =>
  createHash("sha256").update(key).digest("hex").slice(0, 16);
/** Classifies the key check response: valid, rejected, or a transient failure to retry. */
export function riotKeyCheckResult(status: number): "valid" | "rejected" | "retry" {
  if (status >= 200 && status < 300) return "valid";
  return status === 401 || status === 403 ? "rejected" : "retry";
}

// Routing values accepted by the Riot API: platforms and regional routes.

export const riotRegions = ["americas", "asia", "europe", "sea"] as const;
export type RiotRouting = RiotPlatform | (typeof riotRegions)[number];
export const riotRoutingSchema = z.enum([...riotPlatforms, ...riotRegions]);

export interface RateLimit {
  limit: number;
  windowSeconds: number;
}
/**
 * Parses an X-App-Rate-Limit or X-Method-Rate-Limit header such as "20:1,100:120" (20 requests
 * per second and 100 per two minutes). A malformed header gives null, so known limits are kept.
 */
export function parseRateLimitHeader(value: string | null): RateLimit[] | null {
  if (!value) return null;
  const limits = value.split(",").map((part) => part.trim().match(/^(\d{1,7}):(\d{1,6})$/));
  if (!limits.length || limits.some((m) => !m || Number(m[1]) < 1 || Number(m[2]) < 1)) return null;
  return limits.map((m) => ({ limit: Number(m![1]), windowSeconds: Number(m![2]) }));
}
/** Limits used for a region until Riot reports its own: the development key defaults. */
export const defaultApplicationLimits: RateLimit[] = [
  { limit: 20, windowSeconds: 1 },
  { limit: 100, windowSeconds: 120 },
];

// league-v4 apex tiers for ranked solo queue. summonerId is no longer returned for every entry,
// so it is optional; the PUUID is the stable player identifier.
export const apexTiers = [
  { tier: "CHALLENGER", path: "challengerleagues" },
  { tier: "GRANDMASTER", path: "grandmasterleagues" },
  { tier: "MASTER", path: "masterleagues" },
] as const;
export const soloQueue = "RANKED_SOLO_5x5";
export interface LadderEntry {
  puuid: string;
  summonerId: string | null;
  tier: (typeof apexTiers)[number]["tier"];
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  leagueId: string;
}
export function parseLeagueList(
  input: unknown,
  tier: (typeof apexTiers)[number]["tier"],
): LadderEntry[] {
  const count = z.number().int().min(0);
  const list = z
    .object({
      tier: z.literal(tier),
      leagueId: z.string().min(1).max(100),
      queue: z.literal(soloQueue),
      entries: z
        .array(
          z.object({
            puuid: z.string().min(20).max(100),
            summonerId: z.string().min(1).max(100).optional(),
            rank: z.enum(["I", "II", "III", "IV"]),
            leaguePoints: count,
            wins: count,
            losses: count,
          }),
        )
        .max(10000),
    })
    .parse(input);
  return list.entries.map((e) => ({
    puuid: e.puuid,
    summonerId: e.summonerId ?? null,
    tier,
    rank: e.rank,
    leaguePoints: e.leaguePoints,
    wins: e.wins,
    losses: e.losses,
    leagueId: list.leagueId,
  }));
}
/** Parses RIOT_PLATFORMS ("euw1,kr"): the platforms whose ladders the worker syncs. */
export function parseRiotPlatforms(value: string | undefined): RiotPlatform[] {
  const names = (value ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const parsed = z.array(z.enum(riotPlatforms)).safeParse(names);
  if (!parsed.success)
    throw new Error(`RIOT_PLATFORMS must list platforms from: ${riotPlatforms.join(", ")}.`);
  return [...new Set(parsed.data)];
}

/** account-v1 is served by the americas, asia and europe routes; any of them finds any account. */
export function accountRoute(platform: RiotPlatform): "americas" | "asia" | "europe" {
  if (["na1", "br1", "la1", "la2", "oc1"].includes(platform)) return "americas";
  if (["euw1", "eun1", "tr1", "ru", "me1"].includes(platform)) return "europe";
  return "asia";
}
export interface RiotAccount {
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
}
/** Parses an account-v1 AccountDto; a response for another PUUID is rejected. */
export function parseAccount(input: unknown, puuid: string): RiotAccount {
  const account = z
    .object({
      puuid: z.literal(puuid),
      gameName: z.string().min(1).max(100).optional(),
      tagLine: z.string().min(1).max(20).optional(),
    })
    .parse(input);
  return {
    puuid: account.puuid,
    gameName: account.gameName ?? null,
    tagLine: account.tagLine ?? null,
  };
}

/** match-v5 regional route for a platform. */
export function matchRoute(platform: RiotPlatform): (typeof riotRegions)[number] {
  if (["na1", "br1", "la1", "la2"].includes(platform)) return "americas";
  if (["euw1", "eun1", "tr1", "ru", "me1"].includes(platform)) return "europe";
  if (["kr", "jp1"].includes(platform)) return "asia";
  return "sea";
}
export const rankedSoloQueueId = 420;
/** Parses a match-v5 list of match ids such as "EUW1_7612345678". */
export function parseMatchIds(input: unknown): string[] {
  return z
    .array(z.string().regex(/^[A-Z0-9]{2,5}_\d{1,15}$/))
    .max(100)
    .parse(input);
}
/** Parses RIOT_MATCH_CAP: the most match ids kept per region and patch. */
export function parseMatchCap(value: string | undefined): number {
  if (!value?.trim()) return 2000;
  const cap = Number(value.trim());
  if (!Number.isInteger(cap) || cap < 1 || cap > 1000000)
    throw new Error("RIOT_MATCH_CAP must be a whole number from 1 to 1000000.");
  return cap;
}
