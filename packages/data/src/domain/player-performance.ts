import type { SampledValue } from "./historical.js";
import type { League } from "./models.js";

/** A season a player appeared in, with the competition they played most recently that year. */
export interface PlayerSeason {
  year: number;
  league: League;
}

/**
 * Per-game averages and rates for one player over the selected eligible games. Each value is
 * computed only from games whose source recorded it; `sampleCount` is that number of games.
 */
export interface PlayerPerformance {
  games: number;
  killsPerGame: SampledValue;
  deathsPerGame: SampledValue;
  assistsPerGame: SampledValue;
  killParticipation: SampledValue;
  csPerMinute: SampledValue;
  goldPerMinute: SampledValue;
  goldShare: SampledValue;
  damagePerMinute: SampledValue;
  damageShare: SampledValue;
  visionScorePerMinute: SampledValue;
  wardsPerMinute: SampledValue;
  wardsClearedPerMinute: SampledValue;
  controlWardsPerGame: SampledValue;
  goldDiffAt15: SampledValue;
  csDiffAt15: SampledValue;
  xpDiffAt15: SampledValue;
  firstBloodParticipation: SampledValue;
  firstBloodVictim: SampledValue;
  pentakills: SampledValue;
}
