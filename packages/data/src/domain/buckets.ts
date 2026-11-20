// Win rate by game length and by lead over the lane opponent. Buckets are stored by index.
export const bucketKinds = ["length", "gold10", "gold15", "level10", "level15"] as const;
export type BucketKind = (typeof bucketKinds)[number];
/** Game length in minutes: [min, max), the last bucket open-ended. */
export const lengthBuckets = [
  { label: "Under 20 min", max: 20 },
  { label: "20–25 min", max: 25 },
  { label: "25–30 min", max: 30 },
  { label: "30–35 min", max: 35 },
  { label: "35–40 min", max: 40 },
  { label: "40 min or more", max: null },
] as const;
/** Gold lead over the lane opponent: below each bound, the last bucket open-ended. */
export const goldBuckets = [
  { label: "Behind 1,500+", max: -1500 },
  { label: "Behind 500–1,500", max: -500 },
  { label: "Within 500", max: 500 },
  { label: "Ahead 500–1,500", max: 1500 },
  { label: "Ahead 1,500+", max: null },
] as const;
/** Level lead over the lane opponent. */
export const levelBuckets = [
  { label: "2+ levels behind", max: -1 },
  { label: "1 level behind", max: 0 },
  { label: "Even", max: 1 },
  { label: "1 level ahead", max: 2 },
  { label: "2+ levels ahead", max: null },
] as const;
export const bucketLabels: Record<BucketKind, readonly string[]> = {
  length: lengthBuckets.map((b) => b.label),
  gold10: goldBuckets.map((b) => b.label),
  gold15: goldBuckets.map((b) => b.label),
  level10: levelBuckets.map((b) => b.label),
  level15: levelBuckets.map((b) => b.label),
};
/** The index of the first bucket whose upper bound is above the value. */
export function bucketIndex(value: number, buckets: readonly { max: number | null }[]) {
  const index = buckets.findIndex((b) => b.max === null || value < b.max);
  return index < 0 ? buckets.length - 1 : index;
}
export interface BucketPoint {
  index: number;
  label: string;
  games: number;
  /** Null for an empty bucket or below the minimum sample. */
  winRate: { value: number | null; sampleCount: number };
}
export type ChampionBuckets = Record<BucketKind, BucketPoint[]>;
