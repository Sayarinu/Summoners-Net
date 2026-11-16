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
export const riotKeyCheckUrl = "https://na1.api.riotgames.com/lol/status/v4/platform-data";

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
