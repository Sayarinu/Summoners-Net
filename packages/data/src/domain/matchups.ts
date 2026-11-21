import { z } from "zod";
import { patchKeySchema, patchSelectionSchema } from "./patch-selection.js";
import type { Page } from "./models.js";
import type { PatchChampion } from "./patch-overview.js";
import { defaultSamplePolicy } from "./statistics.js";
export const matchupRoles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export const matchupMetrics = [
  "winRate",
  "gold10",
  "gold15",
  "xp10",
  "xp15",
  "cs10",
  "cs15",
  "firstBlood",
  "firstTower",
] as const;
export type MatchupMetric = (typeof matchupMetrics)[number];
export const matchupMinimumSample = defaultSamplePolicy.minimum;
export const matchupPriorGames = 50;
export interface MatchupEstimate {
  raw: number | null;
  shrunk: number | null;
  sampleCount: number;
  baseline: number | null;
  baselineSampleCount: number;
}
export interface MetricCounts {
  total: number | null;
  count: number;
}
/** A fixed-strength prior at the champion's pooled same-role baseline, with small samples hidden. */
export function matchupEstimate(value: MetricCounts, baseline: MetricCounts): MatchupEstimate {
  const base =
    baseline.total !== null && baseline.count >= matchupMinimumSample
      ? baseline.total / baseline.count
      : null;
  const raw =
    value.total !== null && value.count >= matchupMinimumSample ? value.total / value.count : null;
  return {
    raw,
    shrunk:
      raw === null || base === null
        ? null
        : (value.total! + matchupPriorGames * base) / (value.count + matchupPriorGames),
    sampleCount: value.count,
    baseline: base,
    baselineSampleCount: baseline.count,
  };
}
export const championMatchupsQuerySchema = z.strictObject({
  champion: z.string().regex(/^[A-Za-z0-9]{1,40}$/),
  source: z.enum(["solo", "pro"]).default("solo"),
  /** One patch, or several whose games are combined. */
  patch: patchSelectionSchema.optional(),
  role: z.enum(matchupRoles).default("MIDDLE"),
  sort: z.enum(["games", ...matchupMetrics]).default("games"),
  value: z.enum(["shrunk", "raw"]).default("shrunk"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ChampionMatchupsQuery = z.input<typeof championMatchupsQuerySchema>;
export interface MatchupRow {
  opponent: PatchChampion;
  games: number;
  metrics: Record<MatchupMetric, MatchupEstimate>;
}
export interface MatchupExclusions {
  role: string;
  games: number;
  participants: number;
  unknownRole: number;
  ambiguousRole: number;
  missingOpponent: number;
  unmappedChampion: number;
}
export interface ChampionMatchups {
  query: z.output<typeof championMatchupsQuerySchema>;
  champion: PatchChampion;
  /** The newest chosen patch. */
  patch: string | null;
  /** The chosen patches whose games are combined, newest first. */
  combined: string[];
  /** Patches with matchups, newest first. */
  patches: string[];
  /** Opponents with at least `minimumGames` win-rate observations; the rest are counted. */
  page: Page<MatchupRow>;
  minimumGames: number;
  hiddenOpponents: number;
  exclusions: MatchupExclusions[];
}

export const matchupMatrixPageSize = 8;
export const matchupMatrixQuerySchema = championMatchupsQuerySchema
  .pick({
    source: true,
    patch: true,
    value: true,
    page: true,
  })
  .extend({
    // The matrix compares one patch at a time.
    patch: patchKeySchema.optional(),
    role: z.enum(matchupRoles),
    metric: z.enum(matchupMetrics).default("winRate"),
    columnPage: z.coerce.number().int().min(1).max(10000).default(1),
  });
export type MatchupMatrixQuery = z.input<typeof matchupMatrixQuerySchema>;
export interface MatchupMatrix {
  query: z.output<typeof matchupMatrixQuerySchema>;
  patch: string | null;
  patches: string[];
  total: number;
  pageSize: number;
  rows: PatchChampion[];
  columns: PatchChampion[];
  cells: { championKey: number; opponentKey: number; games: number; estimate: MatchupEstimate }[];
}

/** Every observed pair in a role, for export; paged in SQL in champion and opponent key order. */
export const matchupPairsQuerySchema = matchupMatrixQuerySchema
  .pick({ source: true, patch: true, role: true, metric: true })
  .extend({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(200),
  });
export type MatchupPairsQuery = z.input<typeof matchupPairsQuerySchema>;
export interface MatchupPairs {
  query: z.output<typeof matchupPairsQuerySchema>;
  patch: string | null;
  page: Page<{
    champion: PatchChampion;
    opponent: PatchChampion;
    games: number;
    estimate: MatchupEstimate;
  }>;
}
