// The pro model is trained at 10, 15, 20 and 25 minutes on blue-side gold, XP,
// CS and kill leads. Recorded frames can supply the same inputs within that time range.
export const checkpointMinutes = [10, 15, 20, 25] as const;
export const checkpointModelVersion = 1;
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
