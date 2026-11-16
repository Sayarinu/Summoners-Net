import { z } from "zod";
import type { SampledValue } from "./historical.js";

export const wpaKinds = ["champion", "player", "role"] as const;
export const wpaSorts = ["perGame", "total", "games"] as const;
export const wpaPageSize = 50;
export const wpaLeaderboardQuerySchema = z
  .object({
    kind: z.enum(wpaKinds).default("champion"),
    patch: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    sort: z.enum(wpaSorts).default("perGame"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export type WpaLeaderboardQuery = z.input<typeof wpaLeaderboardQuerySchema>;
export interface WpaLeaderboardRow {
  kind: (typeof wpaKinds)[number];
  /** Champion key, player PUUID or role. */
  subject: string;
  /** Champion name, Riot ID ("Name#TAG"), or role; null when unknown. */
  name: string | null;
  /** Champion's Data Dragon id, for links; null for players and roles. */
  championId: string | null;
  games: number;
  /** Total WPA in percentage points of win probability; null below the minimum sample. */
  total: SampledValue;
  perGame: SampledValue;
}
export interface WpaLeaderboard {
  query: z.output<typeof wpaLeaderboardQuerySchema>;
  /** The active model the board is built from; null with no active model. */
  model: { id: number; modelVersion: number; brier: number | null } | null;
  patch: string | null;
  patches: string[];
  page: { items: WpaLeaderboardRow[]; page: number; pageSize: number; total: number };
}
