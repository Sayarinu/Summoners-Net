import { database } from "./persistence/database.js";
import { queries } from "./persistence/queries.js";
export { querySchema, regions } from "./domain/models.js";
export { historicalQuerySchema, historicalSubjectSchema } from "./domain/historical.js";
export type {
  BrowseQuery,
  ParsedQuery,
  Match,
  Game,
  Participant,
  Identity,
  Page,
  Profile,
  Summary,
  SyncStatus,
  SourceStatus,
  RiotKeyStatus,
  Broadcast,
} from "./domain/models.js";
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
export type { SearchHit } from "./persistence/queries.js";
export function createQueries(connectionString: string, clock: () => Date = () => new Date()) {
  const pool = database(connectionString);
  return { ...queries(pool, clock), close: () => pool.end() };
}
export type Queries = ReturnType<typeof createQueries>;

export type { MapImage } from "./domain/map.js";

export { catalogIconQuerySchema } from "./domain/catalog-icons.js";
export type { CatalogIconQuery, CatalogIcon } from "./domain/catalog-icons.js";

export { draftQuerySchema } from "./domain/drafts.js";
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
