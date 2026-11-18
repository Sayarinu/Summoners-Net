// The pro model is trained on blue-side gold, XP, CS and kill leads. Oracle's Elixir reports
// them at 10, 15, 20 and 25 minutes; Leaguepedia frame timelines supply them for every minute.
export const checkpointMinutes = [10, 15, 20, 25] as const;
/** 2: trained on every recorded minute and stores the minutes it covers. */
export const checkpointModelVersion = 2;
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
export const checkpointFeatures = [
  { name: "minute", scale: 30 },
  { name: "goldDiff", scale: 5000 },
  { name: "xpDiff", scale: 5000 },
  { name: "csDiff", scale: 100 },
  { name: "killDiff", scale: 10 },
  { name: "goldDiffByMinute", scale: 150000 },
] as const;
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
export function vectorizeCheckpoint(c: Checkpoint): number[] | null {
  if (c.goldDiff === null || c.xpDiff === null || c.csDiff === null || c.killDiff === null)
    return null;
  const raw = {
    minute: c.minute,
    goldDiff: c.goldDiff,
    xpDiff: c.xpDiff,
    csDiff: c.csDiff,
    killDiff: c.killDiff,
    goldDiffByMinute: c.goldDiff * c.minute,
  };
  return checkpointFeatures.map((f) => raw[f.name] / f.scale);
}
