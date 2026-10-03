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
