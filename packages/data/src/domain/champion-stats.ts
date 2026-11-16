import { z } from "zod";
import type { SampledValue } from "./historical.js";
import type { ChampionBuilds } from "./builds.js";
import type { ChampionBuckets } from "./buckets.js";

export const championRoles = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
  "UNKNOWN",
  "ALL",
] as const;
/** Filters for champion aggregates; the patch defaults to the newest with data. */
export const championStatsQuerySchema = z
  .object({
    source: z.enum(["solo", "pro"]).default("solo"),
    patch: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    queue: z.string().trim().min(1).max(20).optional(),
    region: z.string().trim().min(1).max(100).optional(),
    tier: z.string().trim().min(1).max(20).optional(),
    role: z.enum(championRoles).default("ALL"),
    champion: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(250).default(250),
  })
  .strict();
export type ChampionStatsQuery = z.input<typeof championStatsQuerySchema>;

export interface ChampionStatsRow {
  championKey: number;
  role: (typeof championRoles)[number];
  games: number;
  wins: number;
  /** Win rate with its Wilson interval; null without games of known result. */
  winRate: SampledValue & { lower: number | null; upper: number | null };
  pickRate: SampledValue;
  /** Bans are counted per champion, so only ALL rows carry a ban rate. */
  banRate: SampledValue;
}
export interface ChampionStats {
  source: "solo" | "pro";
  patch: string | null;
  /** Games in the filtered slice, the denominator of pick and ban rates. */
  sliceGames: number;
  rows: ChampionStatsRow[];
}

export const tierListSorts = ["winRate", "pickRate", "banRate", "games"] as const;
/** Tier list filters as they arrive in a query string. */
export const tierListQuerySchema = z
  .object({
    source: z.enum(["solo", "pro"]).default("solo"),
    patch: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    role: z.enum(championRoles).default("ALL"),
    region: z.string().trim().min(1).max(100).optional(),
    tier: z.string().trim().min(1).max(20).optional(),
    sort: z.enum(tierListSorts).default("games"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export type TierListQuery = z.input<typeof tierListQuerySchema>;
export type ParsedTierListQuery = z.output<typeof tierListQuerySchema>;
export interface TierListRow {
  championKey: number;
  /** Data Dragon's champion id and name; null when the catalog does not know the key. */
  championId: string | null;
  name: string | null;
  /** The locally cached icon, when the worker has cached it. */
  imageUrl: string | null;
  role: (typeof championRoles)[number];
  games: number;
  wins: number;
  winRate: SampledValue & { lower: number | null; upper: number | null };
  pickRate: SampledValue;
  banRate: SampledValue;
  /** From the shared minimum-sample policy, applied to the win rate's sample. */
  sample: "shown" | "low-sample" | "hidden";
}
export interface TierList {
  query: ParsedTierListQuery;
  /** The patch shown: the requested one, or the newest with aggregates for the source. */
  patch: string | null;
  sliceGames: number;
  page: { items: TierListRow[]; page: number; pageSize: number; total: number };
  facets: { patches: string[]; regions: string[]; tiers: string[] };
}

/** Champion overview filters: the tier list's filters, keyed by Data Dragon's champion id. */
export const championOverviewQuerySchema = z
  .object({
    champion: z.string().regex(/^[A-Za-z0-9]{1,40}$/),
    source: z.enum(["solo", "pro"]).default("solo"),
    patch: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    role: z.enum(championRoles).default("ALL"),
    region: z.string().trim().min(1).max(100).optional(),
    tier: z.string().trim().min(1).max(20).optional(),
  })
  .strict();
export type ChampionOverviewQuery = z.input<typeof championOverviewQuerySchema>;
export type ParsedChampionOverviewQuery = z.output<typeof championOverviewQuerySchema>;
export type ChampionTier = "S" | "A" | "B" | "C" | "D";
/**
 * Tier from the shrunk win rate's distance to the slice's baseline, in percentage points:
 * S at +3 or more, A at +1.5, B within 1.5 either way, C down to -3, D below.
 */
export function tierFromDelta(delta: number | null): ChampionTier | null {
  if (delta === null) return null;
  const points = delta * 100;
  return points >= 3 ? "S" : points >= 1.5 ? "A" : points > -1.5 ? "B" : points > -3 ? "C" : "D";
}
export interface ChampionOverview {
  query: ParsedChampionOverviewQuery;
  champion: { id: string; key: number; name: string; imageUrl: string | null };
  patch: string | null;
  sliceGames: number;
  games: number;
  winRate: SampledValue & { lower: number | null; upper: number | null };
  pickRate: SampledValue;
  banRate: SampledValue;
  /** The win rate pulled toward the slice's baseline; its sample is the champion's results. */
  shrunkWinRate: SampledValue;
  baseline: number | null;
  tier: ChampionTier | null;
  /** Oldest to newest; a patch without data has a null win rate and zero games. */
  trend: { patch: string; winRate: SampledValue; games: number }[];
  facets: { patches: string[]; regions: string[]; tiers: string[] };
  /** Solo-queue builds from timelines; null for pro play, which has no item events. */
  builds: ChampionBuilds | null;
  /** Solo-queue win rate by game length and by lead at 10 and 15 minutes; null for pro play. */
  buckets: ChampionBuckets | null;
}
