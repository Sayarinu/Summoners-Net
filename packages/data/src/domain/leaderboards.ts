import { z } from "zod";
import { riotPlatforms } from "./riot-platforms.js";
import type { Page } from "./models.js";
import type { SampledValue } from "./historical.js";
export const leaderboardQuerySchema = z.strictObject({
  region: z.enum(riotPlatforms),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type LeaderboardQuery = z.input<typeof leaderboardQuerySchema>;
export interface LeaderboardChampion {
  championKey: number;
  championId: string | null;
  name: string | null;
  imageUrl: string | null;
  games: number;
}
export interface LeaderboardRow {
  rank: number;
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  tier: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: SampledValue;
  sampledGames: number;
  champions: LeaderboardChampion[];
}
export interface Leaderboard {
  query: z.output<typeof leaderboardQuerySchema>;
  lastSuccess: string | null;
  lastAttempt: string | null;
  refreshFailed: boolean;
  page: Page<LeaderboardRow>;
}
