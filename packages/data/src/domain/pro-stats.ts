import type { SampledValue } from "./historical.js";

export interface ProChampionStats {
  patch: string | null;
  league: string | null;
  leagues: string[];
  /** Games with a complete derived draft in the selection; every rate's denominator here. */
  games: number;
  picks: number;
  bans: number;
  /** Picked or banned. */
  presence: SampledValue;
  pickRate: SampledValue;
  banRate: SampledValue;
  /** Over picks with a known result. */
  winRate: SampledValue;
  sides: { side: "blue" | "red"; picks: number; winRate: SampledValue }[];
  /** Picked before the opposing champion in the same role, or after it. */
  blindRate: SampledValue;
  counterRate: SampledValue;
  /** Oracle names in these drafts with no champion mapping, reported rather than guessed. */
  unmapped: { name: string; picks: number; bans: number }[];
}

/** Patch history rows per page. */
export const proHistoryPageSize = 12;
/** One patch of a champion's pro play, with every rate over that patch's selected games. */
export interface ProPatchHistoryRow {
  patch: string;
  /** Games with a complete derived draft on this patch in the selection. */
  games: number;
  picks: number;
  bans: number;
  presence: SampledValue;
  pickRate: SampledValue;
  banRate: SampledValue;
  winRate: SampledValue;
  blueWinRate: SampledValue;
  redWinRate: SampledValue;
}
/** A champion's pro play across patches, newest first, paginated in SQL. */
export interface ProPatchHistory {
  league: string | null;
  page: { items: ProPatchHistoryRow[]; page: number; pageSize: number; total: number };
}
