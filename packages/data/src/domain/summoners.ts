import { z } from "zod";
import { riotPlatforms } from "./riot-platforms.js";
import type { Page } from "./models.js";
import type { SampledValue } from "./historical.js";
export const summonerQuerySchema = z.strictObject({
  puuid: z
    .string()
    .min(20)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
  region: z.enum(riotPlatforms).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  championPage: z.coerce.number().int().min(1).max(10000).default(1),
});
export type SummonerQuery = z.input<typeof summonerQuerySchema>;
export interface SummonerChampion {
  championKey: number;
  championId: string | null;
  name: string | null;
  imageUrl: string | null;
  games: number;
  winRate: SampledValue;
}
export interface SummonerGame {
  matchId: string;
  platform: string | null;
  occurredAt: string;
  patch: string | null;
  championKey: number;
  championName: string | null;
  win: boolean | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  durationSeconds: number | null;
}
export interface LadderHistoryPoint {
  day: string;
  leaguePoints: number | null;
  rank: number | null;
  tier: string | null;
  observedAt: string | null;
  sampleCount: number;
}
export interface SummonerProfile {
  query: z.output<typeof summonerQuerySchema>;
  gameName: string | null;
  tagLine: string | null;
  games: Page<SummonerGame>;
  champions: Page<SummonerChampion>;
  history: { platform: string; points: LadderHistoryPoint[] }[];
  historyFrom: string;
  historyTo: string;
}
