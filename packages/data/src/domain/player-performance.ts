import { z } from "zod";
import type { SampledValue } from "./historical.js";
import type { League } from "./models.js";

/** A season a player appeared in, with the competition they played most recently that year. */
export interface PlayerSeason {
  year: number;
  league: League;
}

/**
 * Per-game averages and rates for one player over the selected eligible games. Each value is
 * computed only from games whose source recorded it; `sampleCount` is that number of games.
 */
export interface PlayerPerformance {
  games: number;
  killsPerGame: SampledValue;
  deathsPerGame: SampledValue;
  assistsPerGame: SampledValue;
  killParticipation: SampledValue;
  csPerMinute: SampledValue;
  goldPerMinute: SampledValue;
  goldShare: SampledValue;
  damagePerMinute: SampledValue;
  damageShare: SampledValue;
  visionScorePerMinute: SampledValue;
  wardsPerMinute: SampledValue;
  wardsClearedPerMinute: SampledValue;
  controlWardsPerGame: SampledValue;
  goldDiffAt15: SampledValue;
  csDiffAt15: SampledValue;
  xpDiffAt15: SampledValue;
  firstBloodParticipation: SampledValue;
  firstBloodVictim: SampledValue;
  pentakills: SampledValue;
}

export const championPoolSorts = [
  "games",
  "winRate",
  "kda",
  "damagePerMinute",
  "goldDiffAt15",
] as const;
export const championPoolPageSize = 10;
/** Sorting and paging for a player's champion pool, as they arrive in a query string. */
export const championPoolQuerySchema = z.object({
  poolSort: z.enum(championPoolSorts).default("games"),
  poolPage: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ChampionPoolQuery = z.input<typeof championPoolQuerySchema>;
/** One champion a player played in the selected games, with its per-game statistics. */
export interface ChampionPoolRow {
  champion: string;
  games: number;
  wins: number;
  winRate: SampledValue;
  kda: SampledValue;
  killParticipation: SampledValue;
  csPerMinute: SampledValue;
  goldPerMinute: SampledValue;
  damagePerMinute: SampledValue;
  goldDiffAt15: SampledValue;
  csDiffAt15: SampledValue;
}
export interface ChampionPool {
  sort: (typeof championPoolSorts)[number];
  page: { items: ChampionPoolRow[]; page: number; pageSize: number; total: number };
}
