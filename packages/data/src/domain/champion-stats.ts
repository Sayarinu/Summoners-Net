import { z } from "zod";
import type { SampledValue } from "./historical.js";

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
