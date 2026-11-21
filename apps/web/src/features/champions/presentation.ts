import type {
  ChampionLaneRole,
  MatchupRow,
  SampledValue,
  TierListRow,
} from "@summonersnet/data/contracts";

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
  kda: "KDA",
  damagePerMinute: "Damage per Minute",
  goldDiffAt15: "Gold Difference at 15",
  tier: "Tier",
} as const;
/** A per-game average, or "Unknown" when no game reported it; never 0 for missing data. */
export function average(value: SampledValue, digits = 1, signed = false) {
  if (value.value === null) return "Unknown";
  const text = value.value.toFixed(digits);
  return signed && value.value > 0 ? `+${text}` : text;
}
/** A rate as a percentage, or "Unknown" when there is no sample; never 0% for missing data. */
export function percent(rate: SampledValue) {
  return rate.value === null ? "Unknown" : `${(rate.value * 100).toFixed(1)}%`;
}
/** A sampled rate, or a dash when the sample is below the minimum; never 0% for missing data. */
export function sampledRate(rate: SampledValue) {
  if (rate.value !== null) return percent(rate);
  return rate.sampleCount > 0 ? "—" : "Unknown";
}
export const sampleLabels: Record<TierListRow["sample"], string> = {
  shown: "",
  "low-sample": "Low Sample",
  hidden: "Too Few Games",
};

/** A champion's best and worst lane opponents by shrunk win rate, for the overview's cards. */
export interface MatchupSummary {
  role: ChampionLaneRole;
  source: "solo" | "pro";
  /** The combined patches, newest first. */
  patches: string[];
  /** Opponents with enough games in this role and these patches. */
  opponents: number;
  best: MatchupRow[];
  worst: MatchupRow[];
}
/** A signed percentage-point difference, such as +2.4%; unknown stays unknown. */
export function signedPoints(value: number | null) {
  return value === null ? "Unknown" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

/** "Patch 16.22", or the combined patches oldest first: "Patches 16.21, 16.22". */
export function patchesLabel(patches: readonly string[]) {
  if (!patches.length) return "Patch unavailable";
  if (patches.length === 1) return `Patch ${patches[0]}`;
  return `Patches ${[...patches].reverse().join(", ")}`;
}
/** Adds each patch as its own `patch` value, as the filter form submits them. */
export function appendPatches(params: URLSearchParams, patches: readonly string[]) {
  for (const patch of patches) params.append("patch", patch);
  return params;
}
