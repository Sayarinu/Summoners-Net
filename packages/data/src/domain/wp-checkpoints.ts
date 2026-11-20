// The pro model is trained on blue-side gold, XP, CS and kill leads. Oracle's Elixir reports
// them at 10, 15, 20 and 25 minutes; Leaguepedia frame timelines supply them for every minute.
export const checkpointMinutes = [10, 15, 20, 25] as const;
/**
 * 2: trained on every recorded minute and stores the minutes it covers.
 * 3: game time is capped at 60 minutes and scaled per 60, so long games stay in range; trained on
 * recorded minutes only once enough games have a timeline; evaluated per game phase.
 */
export const checkpointModelVersion = 3;
/** The pro model's feature version: 2 replaced `minute` and its gold product with capped game time. */
export const checkpointFeatureVersion = 2;
/** Game time past this is treated as this long; few games run longer. */
export const gameTimeCap = 60;
export interface MinuteRange {
  first: number;
  last: number;
}
/** The minutes a model without a stored range was trained on: the reported checkpoints. */
export const reportedMinutes: MinuteRange = {
  first: checkpointMinutes[0],
  last: checkpointMinutes.at(-1)!,
};
/**
 * The reported checkpoint minutes, widened one minute at a time in each direction while every
 * added minute has at least `minimum` games, so the model never scores a sparsely seen minute.
 */
export function coveredMinutes(gamesByMinute: ReadonlyMap<number, number>, minimum: number) {
  const enough = (minute: number) => (gamesByMinute.get(minute) ?? 0) >= minimum;
  let { first, last } = reportedMinutes;
  while (first > 0 && enough(first - 1)) first--;
  while (enough(last + 1)) last++;
  return { first, last };
}
/**
 * Every checkpoint feature a pro model has been trained on, by name. A model stores the names it
 * used, so it is always scored with its own features and scales, whichever version is current.
 */
const featureValues = {
  minute: { scale: 30, value: (c: KnownCheckpoint) => c.minute },
  gameTime: { scale: 60, value: (c: KnownCheckpoint) => Math.min(c.minute, gameTimeCap) },
  goldDiff: { scale: 5000, value: (c: KnownCheckpoint) => c.goldDiff },
  xpDiff: { scale: 5000, value: (c: KnownCheckpoint) => c.xpDiff },
  csDiff: { scale: 100, value: (c: KnownCheckpoint) => c.csDiff },
  killDiff: { scale: 10, value: (c: KnownCheckpoint) => c.killDiff },
  goldDiffByMinute: { scale: 150000, value: (c: KnownCheckpoint) => c.goldDiff * c.minute },
  goldDiffByGameTime: {
    scale: 300000,
    value: (c: KnownCheckpoint) => c.goldDiff * Math.min(c.minute, gameTimeCap),
  },
} as const;
export type CheckpointFeature = keyof typeof featureValues;
/** The features the current pro model version is trained on. */
export const checkpointFeatures: readonly CheckpointFeature[] = [
  "gameTime",
  "goldDiff",
  "xpDiff",
  "csDiff",
  "killDiff",
  "goldDiffByGameTime",
];
type KnownCheckpoint = { [K in keyof Checkpoint]: NonNullable<Checkpoint[K]> };
export interface Checkpoint {
  minute: number;
  goldDiff: number | null;
  xpDiff: number | null;
  csDiff: number | null;
  killDiff: number | null;
}
/** Checkpoints from a team row's statistics; a missing value leaves that checkpoint unknown. */
export function checkpointsFrom(statistics: Record<string, unknown>): Checkpoint[] {
  const value = (key: string) => {
    const v = statistics[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return checkpointMinutes.map((minute) => {
    const kills = value(`killsat${minute}`);
    const opponent = value(`opp_killsat${minute}`);
    return {
      minute,
      goldDiff: value(`golddiffat${minute}`),
      xpDiff: value(`xpdiffat${minute}`),
      csDiff: value(`csdiffat${minute}`),
      killDiff: kills === null || opponent === null ? null : kills - opponent,
    };
  });
}
/**
 * A checkpoint as model input, with the given features (the current ones by default). Null when a
 * value is missing or a feature name is unknown, so the checkpoint is left unscored.
 */
export function vectorizeCheckpoint(
  c: Checkpoint,
  features: readonly string[] = checkpointFeatures,
): number[] | null {
  if (c.goldDiff === null || c.xpDiff === null || c.csDiff === null || c.killDiff === null)
    return null;
  const known = c as KnownCheckpoint;
  const vector: number[] = [];
  for (const name of features) {
    if (!(name in featureValues)) return null;
    const feature = featureValues[name as CheckpointFeature];
    vector.push(feature.value(known) / feature.scale);
  }
  return vector;
}

/** Game phases evaluated separately, by minute. */
export const gamePhases = [
  { phase: "early", label: "Early (Before 15:00)", first: 0, last: 14 },
  { phase: "mid", label: "Mid (15:00–25:00)", first: 15, last: 25 },
  { phase: "late", label: "Late (After 25:00)", first: 26, last: Infinity },
] as const;
export type GamePhase = (typeof gamePhases)[number]["phase"];
export const phaseOf = (minute: number): GamePhase =>
  gamePhases.find((p) => minute >= p.first && minute <= p.last)!.phase;
