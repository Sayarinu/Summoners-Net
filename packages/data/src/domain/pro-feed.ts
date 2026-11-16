import { z } from "zod";
import type { Identity, Page } from "./models.js";
const filter = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v.isWellFormed() && !v.includes(String.fromCharCode(0)))
  .optional();
export const proFeedQuerySchema = z.strictObject({
  team: filter,
  league: filter,
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProFeedQuery = z.input<typeof proFeedQuerySchema>;
export interface ProFeedGame {
  matchId: string;
  participantId: number;
  puuid: string;
  sourceIdentityId: string;
  player: Identity;
  team: Identity | null;
  league: string | null;
  proObservedAt: string | null;
  championKey: number;
  championId: string | null;
  championName: string | null;
  imageUrl: string | null;
  win: boolean | null;
  occurredAt: string;
}
export interface ProFeed {
  query: z.output<typeof proFeedQuerySchema>;
  page: Page<ProFeedGame>;
  teams: { id: string; name: string }[];
  leagues: string[];
}
