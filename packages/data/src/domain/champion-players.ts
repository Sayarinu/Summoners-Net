import { z } from "zod";
import type { Page, Identity } from "./models.js";
import type { SampledValue } from "./historical.js";
import { defaultSamplePolicy } from "./statistics.js";
export const championPlayerMinimumGames = defaultSamplePolicy.minimum;
export const championPlayerPageSize = 20;
export const championPlayerSorts = ["games", "winRate"] as const;
export const championPlayersOptionsSchema = z.object({
  playersSort: z.enum(championPlayerSorts).default("games"),
  playersPage: z.coerce.number().int().min(1).max(1000).default(1),
});
export interface ChampionPlayer {
  puuid: string;
  platform: string;
  gameName: string | null;
  tagLine: string | null;
  games: number;
  winRate: SampledValue;
  tier: string;
  leaguePoints: number;
  ladderObservedAt: string;
  pro: Identity | null;
}
export interface ChampionPlayers {
  sort: (typeof championPlayerSorts)[number];
  page: Page<ChampionPlayer>;
}
