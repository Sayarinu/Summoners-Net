import { z } from "zod";
import type { Page } from "./models.js";
import type { SampledValue } from "./historical.js";

export const draftQuerySchema = z
  .object({
    patch: z.string().regex(/^[1-9]\d?\.[1-9]\d?$/),
    league: z.string().trim().min(1).max(100).optional(),
    priorityPage: z.coerce.number().int().min(1).max(10000).default(1),
    rolePage: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export type DraftQuery = z.input<typeof draftQuerySchema>;
export type ParsedDraftQuery = z.output<typeof draftQuerySchema>;
export interface DraftPriority {
  champion: string;
  action: "pick" | "ban";
  phase: number;
  slot: number | null;
  games: number;
  rate: SampledValue;
}
export interface DraftRole {
  champion: string;
  role: string;
  games: number;
  blindRate: SampledValue;
  counterRate: SampledValue;
}
export interface DraftAnalytics {
  games: number;
  includedGames: number;
  excludedGames: number;
  pendingGames: number;
  exclusions: { reason: string; games: number }[];
  firstPickWinRate: SampledValue;
  firstPickSides: { side: "blue" | "red"; winRate: SampledValue }[];
  priorities: Page<DraftPriority>;
  roles: Page<DraftRole>;
}
