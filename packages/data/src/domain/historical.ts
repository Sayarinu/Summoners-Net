import { z } from "zod";
import { regions } from "./models.js";

export const historicalQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
    year: z.coerce.number().int().min(2014).max(2100).optional(),
    sourceLeague: z.string().trim().min(1).max(100).optional(),
    competition: z.enum(regions).optional(),
    patch: z.string().trim().min(1).max(40).optional(),
    team: z.string().trim().min(1).max(200).optional(),
    player: z.string().trim().min(1).max(200).optional(),
    champion: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type HistoricalQuery = z.input<typeof historicalQuerySchema>;
export type ParsedHistoricalQuery = z.output<typeof historicalQuerySchema>;

export const historicalSubjectSchema = z
  .object({
    kind: z.enum(["player", "team", "champion"]),
    value: z.string().trim().min(1).max(200),
  })
  .strict();
export type HistoricalSubject = z.input<typeof historicalSubjectSchema>;

export interface SampledValue {
  value: number | null;
  sampleCount: number;
}
export interface HistoricalGameListItem {
  id: string;
  year: number;
  sourceLeague: string;
  competition: (typeof regions)[number] | null;
  sourceGameId: string;
  occurredAt: string;
  patch: string | null;
  complete: boolean;
  summaryEligible: boolean;
  teams: { name: string; side: "blue" | "red"; won: boolean | null }[];
}
export interface HistoricalParticipant {
  slot: string;
  side: "blue" | "red";
  position: string;
  player: { name: string; sourceId: string | null } | null;
  team: { name: string; sourceId: string | null };
  champion: string | null;
  won: boolean | null;
  statistics: {
    combat: Record<string, number | null>;
    objectives: Record<string, number | null>;
    damage: Record<string, number | null>;
    vision: Record<string, number | null>;
    economy: Record<string, number | null>;
    checkpoints: Record<string, number | null>;
  };
}
export interface HistoricalGameDetail extends HistoricalGameListItem {
  context: {
    sourceYear: number | null;
    sourceUrl: string | null;
    split: string | null;
    week: string | null;
    playoffs: boolean | null;
    gameNumber: string | null;
    durationSeconds: number | null;
  };
  draft: {
    side: "blue" | "red";
    firstPick: boolean | null;
    picks: (string | null)[];
    bans: (string | null)[];
  }[];
  participants: HistoricalParticipant[];
}
export interface HistoricalSummary {
  subject: z.output<typeof historicalSubjectSchema>;
  games: number;
  results: number;
  wins: number;
  winRate: SampledValue;
  kda: SampledValue;
  championUsage: { champion: string; games: number; wins: number; resultGames: number }[];
  damagePerMinute: SampledValue;
  earnedGoldPerMinute: SampledValue;
  csPerMinute: SampledValue;
  visionScorePerMinute: SampledValue;
  checkpointGoldDifference: Record<"10" | "15" | "20" | "25", SampledValue>;
  checkpointXpDifference: Record<"10" | "15" | "20" | "25", SampledValue>;
  checkpointCsDifference: Record<"10" | "15" | "20" | "25", SampledValue>;
  teamObjectives: Record<string, SampledValue>;
}
export interface HistoricalCoverage {
  year: number;
  status: "complete" | "incomplete";
  error: string | null;
  artifactHash: string | null;
  importedAt: string | null;
  sourceRows: number;
  games: number;
  eligibleGames: number;
  warnings: { field: string; count: number; reason: string }[];
  fields: string[];
  retainedFile: boolean;
}
