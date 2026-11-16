import { createHash } from "node:crypto";
import { z } from "zod";

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
export const riotPlatforms = [
  "br1",
  "eun1",
  "euw1",
  "jp1",
  "kr",
  "la1",
  "la2",
  "me1",
  "na1",
  "oc1",
  "ru",
  "sg2",
  "tr1",
  "tw2",
  "vn2",
] as const;
export const riotRegions = ["americas", "asia", "europe", "sea"] as const;
export type RiotRouting = (typeof riotPlatforms)[number] | (typeof riotRegions)[number];
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
