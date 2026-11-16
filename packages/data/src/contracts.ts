// Browser-safe validation and public query DTOs; no persistence or provider code.
export { querySchema, regions, timezoneSchema } from "./domain/models.js";
export { historicalQuerySchema, historicalSubjectSchema } from "./domain/historical.js";
export type {
  HistoricalQuery,
  HistoricalSubject,
  HistoricalGameListItem,
  HistoricalGameDetail,
  HistoricalParticipant,
  HistoricalSummary,
  HistoricalCoverage,
  SampledValue,
} from "./domain/historical.js";

export type { MapImage } from "./domain/map.js";

export { catalogIconQuerySchema } from "./domain/catalog-icons.js";
export type { CatalogIconQuery, CatalogIcon } from "./domain/catalog-icons.js";

export { draftQuerySchema } from "./domain/drafts.js";
export { championStatsQuerySchema, championRoles } from "./domain/champion-stats.js";
export type {
  ChampionStats,
  ChampionStatsQuery,
  ChampionStatsRow,
} from "./domain/champion-stats.js";
export type {
  DraftQuery,
  ParsedDraftQuery,
  DraftPriority,
  DraftRole,
  DraftAnalytics,
} from "./domain/drafts.js";

export {
  replayTrackSchema,
  parseReplayTrackFile,
  replayTrackMaxBytes,
} from "./domain/replay-tracks.js";
export type { ReplayTrack, ReplayTrackSample } from "./domain/replay-tracks.js";
