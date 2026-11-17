import type { SampledValue, TierListRow } from "@summonersnet/data/contracts";

export const roleLabels: Record<TierListRow["role"], string> = {
  ALL: "All Roles",
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
  UNKNOWN: "Unknown Role",
};
export const sortLabels = {
  games: "Games",
  winRate: "Win Rate",
  pickRate: "Pick Rate",
  banRate: "Ban Rate",
} as const;
/** A rate as a percentage, or "Unknown" when there is no sample; never 0% for missing data. */
export function percent(rate: SampledValue) {
  return rate.value === null ? "Unknown" : `${(rate.value * 100).toFixed(1)}%`;
}
export function interval(rate: { lower: number | null; upper: number | null }) {
  return rate.lower === null || rate.upper === null
    ? "Unknown"
    : `${(rate.lower * 100).toFixed(1)}–${(rate.upper * 100).toFixed(1)}%`;
}
export const sampleLabels: Record<TierListRow["sample"], string> = {
  shown: "",
  "low-sample": "Low Sample",
  hidden: "Too Few Games",
};
