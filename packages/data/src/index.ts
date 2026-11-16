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
  RiotStorageStatus,
  RiotCrawlStatus,
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
export {
  championStatsQuerySchema,
  championRoles,
  tierListQuerySchema,
  tierListSorts,
  championOverviewQuerySchema,
  tierFromDelta,
} from "./domain/champion-stats.js";
export type {
  ChampionStats,
  ChampionStatsQuery,
  ChampionStatsRow,
  ParsedTierListQuery,
  ChampionOverview,
  ChampionOverviewQuery,
  ChampionTier,
} from "./domain/champion-stats.js";
export type { BuildItem, BuildRow, ChampionBuilds } from "./domain/builds.js";
export type { BucketKind, BucketPoint, ChampionBuckets } from "./domain/buckets.js";
export type { BotLaneMatrix, Synergies, SynergyRow } from "./domain/synergies.js";
export { synergySorts } from "./domain/synergies.js";
export type { ProChampionStats } from "./domain/pro-stats.js";
export type { SoloGame, SoloGameMarker } from "./domain/solo-games.js";
export { soloMatchIdSchema } from "./domain/solo-games.js";
export type { ProGameWinProbability } from "./persistence/pro-wp.js";
export { wpaKinds, wpaLeaderboardQuerySchema, wpaSorts } from "./domain/wpa-leaderboards.js";
export type {
  WpaLeaderboard,
  WpaLeaderboardQuery,
  WpaLeaderboardRow,
} from "./domain/wpa-leaderboards.js";
export type { TierList, TierListQuery, TierListRow } from "./domain/champion-stats.js";
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

export { replayFileMaxBytes, replayPlatformSchema } from "./domain/replays.js";
export { riotPlatforms } from "./domain/riot-platforms.js";
export type { ReplayMetadataSummary } from "./domain/replays.js";

export {
  leaderboardQuerySchema,
  type LeaderboardQuery,
  type Leaderboard,
  type LeaderboardRow,
  type LeaderboardChampion,
} from "./domain/leaderboards.js";

export {
  summonerQuerySchema,
  type SummonerQuery,
  type SummonerProfile,
  type SummonerGame,
  type SummonerChampion,
  type LadderHistoryPoint,
} from "./domain/summoners.js";

export {
  proAccountLinksMaxBytes,
  proAccountLinksSchema,
  parseProAccountLinksFile,
  type ProAccountLinksFile,
  type ProAccountLink,
} from "./domain/pro-accounts.js";

export {
  proFeedQuerySchema,
  type ProFeedQuery,
  type ProFeed,
  type ProFeedGame,
} from "./domain/pro-feed.js";

export {
  trendingQuerySchema,
  type TrendingQuery,
  type TrendingChampions,
  type TrendingChampion,
} from "./domain/trending.js";
export {
  trendMinimumSample,
  trendMinimumOutcomes,
  trendCriticalZ,
  type ProportionTrend,
} from "./domain/statistics.js";

export {
  overviewPatchSchema,
  type PatchOverview,
  type PatchChampion,
  type PatchTrend,
  type NewPatchBuild,
  type PatchProLeader,
} from "./domain/patch-overview.js";
