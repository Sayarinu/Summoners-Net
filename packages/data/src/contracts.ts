export { roleKey } from "./domain/resolution.js";
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
export {
  championStatsQuerySchema,
  championRoles,
  championLaneRoles,
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
  ChampionLaneRole,
} from "./domain/champion-stats.js";
export type { BuildItem, BuildRow, ChampionBuilds } from "./domain/builds.js";
export type { BucketKind, BucketPoint, ChampionBuckets } from "./domain/buckets.js";
export type { BotLaneMatrix, Synergies, SynergyRow } from "./domain/synergies.js";
export { synergySorts } from "./domain/synergies.js";
export type { ProChampionStats } from "./domain/pro-stats.js";
export type {
  SoloGame,
  SoloGameMarker,
  SoloGamePositions,
  TimelinePositionFrame,
  MapEvent,
  SoloGameMapEvents,
} from "./domain/solo-games.js";
export { mapEventLimit, soloMatchIdSchema, timelineMinuteLimit } from "./domain/solo-games.js";
export {
  heatmapKinds,
  heatmapMinimumGames,
  heatmapQuerySchema,
  heatmapRoles,
  heatmapSubjectKinds,
} from "./domain/heatmaps.js";
export type {
  Heatmap,
  HeatmapKind,
  HeatmapQuery,
  HeatmapSample,
  HeatmapSubjectKind,
} from "./domain/heatmaps.js";
export { clearMinutes, junglePathMinimumSample } from "./domain/jungle-paths.js";
export type {
  ChampionJunglePaths,
  GankLane,
  JunglePathCluster,
  JungleRoute,
  JungleSide,
} from "./domain/jungle-paths.js";
export { featureLabels, modelDiagnosticsQuerySchema } from "./domain/model-diagnostics.js";
export type { ModelDiagnostics, ModelSummary } from "./domain/model-diagnostics.js";
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
export {
  trackRangeLimitMs,
  trackRangeQuerySchema,
  trackRangeSampleLimit,
} from "./domain/track-views.js";
export type {
  MatchTrackSummary,
  TrackObservation,
  TrackRange,
  TrackRangeQuery,
} from "./domain/track-views.js";
export type { TrackMovement, TrackZone } from "./domain/track-movements.js";
export { accuracyThresholds } from "./domain/track-accuracy.js";
export type { AccuracyReport, AccuracyStats, TrackAccuracy } from "./domain/track-accuracy.js";

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

export {
  championPlayerMinimumGames,
  championPlayerPageSize,
  championPlayerSorts,
  type ChampionPlayer,
  type ChampionPlayers,
} from "./domain/champion-players.js";

export {
  matchupMatrixQuerySchema,
  matchupMatrixPageSize,
  matchupPairsQuerySchema,
  type MatchupPairs,
  type MatchupPairsQuery,
  type MatchupMatrix,
  type MatchupMatrixQuery,
  championMatchupsQuerySchema,
  matchupRoles,
  matchupMetrics,
  matchupMinimumSample,
  matchupPriorGames,
  type ChampionMatchupsQuery,
  type ChampionMatchups,
  type MatchupRow,
  type MatchupMetric,
  type MatchupEstimate,
  type MatchupExclusions,
} from "./domain/matchups.js";

export {
  championBlindabilityQuerySchema,
  blindabilityMinimumCoverage,
  blindabilityMinimumOpponents,
  blindabilityTailShare,
  blindabilityReasons,
  counterPickListQuerySchema,
  counterPickReasons,
  counterPickSorts,
  type BlindabilityReason,
  type ChampionBlindability,
  type ChampionBlindabilityQuery,
  type CounterPickList,
  type CounterPickListQuery,
  type CounterPickReason,
  type CounterPickRow,
} from "./domain/blindability.js";

export {
  draftAssistantQuerySchema,
  type DraftAssistant,
  type DraftAssistantQuery,
  type DraftCandidate,
  type DraftPart,
} from "./domain/draft-assistant.js";

export { draftFeatures, type DraftInput, type DraftWinProbability } from "./domain/draft-model.js";
export type { ChampionDirectory, PatchDirectory } from "./domain/directories.js";

export { gameReplayUrl, isRecording, recordingUrl } from "./domain/broadcasts.js";
