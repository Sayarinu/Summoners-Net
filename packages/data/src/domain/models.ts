import { z } from "zod";
export const regions = [
  "LCK",
  "LPL",
  "LEC",
  "LCS",
  "LCP",
  "Worlds",
  "MSI",
  "First Stand",
  "EWC",
] as const;
export type League = (typeof regions)[number];
export type Source = "pandascore" | "oracle" | "ddragon";
export const identitySchema = z.object({
  id: z.string(),
  source: z.enum(["pandascore", "oracle"]),
  sourceId: z.string(),
  kind: z.enum(["team", "player"]),
  name: z.string().min(1),
  imageUrl: z.union([z.url(), z.string().regex(/^\/api\/images\/[a-f0-9]{64}$/)]).nullable(),
  country: z.string().nullable(),
  role: z.string().nullable(),
  entityId: z.string().optional(),
  publicSlug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  imageSource: z.string().nullable().optional(),
  sourceCount: z.number().int().positive().optional(),
  aliases: z.array(z.string()).optional(),
});
export type Identity = z.infer<typeof identitySchema>;
export const broadcastSchema = z.object({
  provider: z.enum(["twitch", "youtube"]),
  externalId: z.string(),
  url: z.url(),
  language: z.string(),
});
export type Broadcast = z.infer<typeof broadcastSchema>;
export const matchGameSchema = z.object({
  sourceId: z.string(),
  number: z.number().int(),
  state: z.string(),
  startsAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  winnerId: z.string().nullable(),
});
export const matchSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  tournamentSourceId: z.string().nullable().optional(),
  name: z.string(),
  league: z.enum(regions),
  event: z.string(),
  startsAt: z.iso.datetime().nullable(),
  state: z.enum(["scheduled", "live", "final", "postponed", "cancelled", "unknown"]),
  bestOf: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]),
  teams: z
    .array(
      identitySchema.extend({
        score: z.number().int().nonnegative().nullable(),
      }),
    )
    .max(2),
  broadcasts: z.array(broadcastSchema),
  games: z.array(matchGameSchema).default([]),
  updatedAt: z.iso.datetime(),
});
export type Match = z.infer<typeof matchSchema>;
export const participantSchema = z.object({
  slot: z.string(),
  side: z.enum(["blue", "red"]),
  role: z.string(),
  team: identitySchema,
  player: identitySchema.nullable(),
  champion: z.string().nullable(),
  won: z.boolean().nullable(),
  kills: z.number().nonnegative().nullable(),
  deaths: z.number().nonnegative().nullable(),
  assists: z.number().nonnegative().nullable(),
});
export type Participant = z.infer<typeof participantSchema>;
export const gameSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  matchId: z.string().nullable(),
  league: z.enum(regions),
  event: z.string(),
  year: z.number().int(),
  occurredAt: z.iso.datetime(),
  number: z.number().int().positive(),
  patch: z.string().nullable(),
  complete: z.boolean(),
  participants: z.array(participantSchema),
});
export type Game = z.infer<typeof gameSchema>;
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Summary {
  eligibleGames: number;
  resultGames: number;
  wins: number;
  winRate: number | null;
  kda: number | null;
  kdaGames: number;
  champions: {
    name: string;
    games: number;
    wins: number;
    resultGames: number;
  }[];
}
export interface RosterObservation {
  player: Identity;
  team: Identity;
  observedAt: string;
}
export interface Profile {
  identity: Identity;
  summary: Summary;
  games: Page<Game>;
  roster: RosterObservation[];
  sources?: Identity[];
  aliases?: string[];
  resolution?: {
    gameId: string;
    playedAt: string;
    observedAt: string;
    matchedPlayers: number;
    method?: "lineup" | "fixtures";
    matchedFixtures?: number;
  }[];
}
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    if (value !== "UTC" && !value.includes("/")) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone, such as America/Phoenix or UTC.");
export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  league: z.enum(regions).optional(),
  year: z.coerce.number().int().min(2014).max(2100).optional(),
  q: z.string().trim().max(100).default(""),
  date: z.iso.date().optional(),
  timezone: timezoneSchema.default("UTC"),
  state: matchSchema.shape.state.optional(),
});
export type BrowseQuery = z.input<typeof querySchema>;
export type ParsedQuery = z.output<typeof querySchema>;
export const syncRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.enum(["running", "matches", "rosters", "metadata", "entities", "resolve"]) })
    .strict(),
  z
    .object({
      kind: z.enum(["entity-history", "entity-rosters"]),
      year: z.number().int().min(2014).max(2100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("history"),
      year: z.number().int().min(2014).max(2100),
      file: z.string().min(1).optional(),
      method: z.enum(["manual", "upload"]).optional(),
    })
    .strict(),
]);
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export interface SourceStatus {
  source: Source;
  lastSuccess: string | null;
  lastAttempt: string | null;
  error: string | null;
  records: number;
}
export interface SyncStatus {
  sources: SourceStatus[];
  jobs: {
    id: string;
    kind: string;
    state: string;
    error: string | null;
    requestedAt: string;
  }[];
  pandaRequests: number;
  cooldownUntil: string | null;
  history: {
    year: number;
    games: number;
    eligible: number;
    latestGameAt: string;
  }[];
}
