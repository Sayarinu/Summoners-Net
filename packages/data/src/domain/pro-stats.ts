import type { SampledValue } from "./historical.js";

export interface ProChampionStats {
  patch: string | null;
  league: string | null;
  leagues: string[];
  /** The selected split and stage, and the splits recorded on this patch and league. */
  split: string | null;
  stage: string | null;
  splits: string[];
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
  /** How the champion played once picked, in the selected role (or every role). */
  performance: ProChampionPerformance;
}
/**
 * Per-game averages from each player's archive row. Every value carries the number of games that
 * reported it; a value no game reported is null.
 */
export interface ProChampionPerformance {
  games: number;
  /** (Kills + assists) / deaths over the games, with deaths counted as at least one. */
  kda: SampledValue;
  killsPerGame: SampledValue;
  deathsPerGame: SampledValue;
  assistsPerGame: SampledValue;
  killParticipation: SampledValue;
  csPerMinute: SampledValue;
  goldPerMinute: SampledValue;
  damagePerMinute: SampledValue;
  damageShare: SampledValue;
  goldDiffAt15: SampledValue;
  csDiffAt15: SampledValue;
  xpDiffAt15: SampledValue;
  firstBloodParticipation: SampledValue;
  visionScorePerMinute: SampledValue;
  /** Seconds. */
  gameLength: SampledValue;
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
