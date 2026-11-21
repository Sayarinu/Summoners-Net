import type { SampledValue } from "./historical.js";

/**
 * How a team plays over the selected complete games, from its Oracle's Elixir team rows. Rates
 * and averages use only the games that recorded the value; `sampleCount` is that number.
 */
export interface TeamStatistics {
  games: number;
  winRate: SampledValue;
  sides: { side: "blue" | "red"; games: number; winRate: SampledValue }[];
  /** Average game length in seconds, for wins and for losses. */
  gameLength: { wins: SampledValue; losses: SampledValue };
  goldDiffAt15: SampledValue;
  killsPerMinute: SampledValue;
  firstBlood: SampledValue;
  firstTower: SampledValue;
  firstDragon: SampledValue;
  firstHerald: SampledValue;
  firstBaron: SampledValue;
  /** The team's share of each objective taken by either team. */
  dragonControl: SampledValue;
  heraldControl: SampledValue;
  voidGrubControl: SampledValue;
  baronControl: SampledValue;
  towersPerGame: SampledValue;
}
