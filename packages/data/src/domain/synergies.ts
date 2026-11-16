import { z } from "zod";
import type { SampledValue } from "./historical.js";

export const synergySorts = ["games", "winRate", "delta"] as const;
export const synergyPageSize = 20;
export interface SynergyRow {
  allyKey: number;
  allyId: string | null;
  allyName: string | null;
  allyImageUrl: string | null;
  allyRole: string;
  games: number;
  /** Null below the minimum sample. */
  winRate: SampledValue;
  expected: number | null;
  /** Win rate minus expected, shrunk toward zero; null below the minimum sample. */
  delta: SampledValue;
}
export interface Synergies {
  sort: (typeof synergySorts)[number];
  page: { items: SynergyRow[]; page: number; pageSize: number; total: number };
}
export interface BotLaneMatrix {
  carries: { key: number; name: string | null }[];
  supports: { key: number; name: string | null }[];
  cells: { carry: number; support: number; games: number; winRate: SampledValue }[];
}
export const synergyQuerySchema = z.object({
  synergySort: z.enum(synergySorts).default("games"),
  synergyPage: z.coerce.number().int().min(1).max(1000).default(1),
});
