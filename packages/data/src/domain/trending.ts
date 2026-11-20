import { z } from "zod";
import { championRoles } from "./champion-stats.js";
import type { Page } from "./models.js";
import type { ProportionTrend } from "./statistics.js";
export const trendingQuerySchema = z.strictObject({
  source: z.enum(["solo", "pro"]).default("solo"),
  patch: z
    .string()
    .regex(/^\d{1,2}\.\d{1,2}$/)
    .optional(),
  role: z.enum(championRoles).default("ALL"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type TrendingQuery = z.input<typeof trendingQuerySchema>;
export interface TrendingChampion {
  championKey: number;
  championId: string | null;
  name: string | null;
  imageUrl: string | null;
  role: (typeof championRoles)[number];
  pickRate: ProportionTrend;
  winRate: ProportionTrend;
}
export interface TrendingChampions {
  query: z.output<typeof trendingQuerySchema>;
  patch: string | null;
  previousPatch: string | null;
  currentGames: number;
  previousGames: number;
  patches: string[];
  page: Page<TrendingChampion>;
}
