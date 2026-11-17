/**
 * Replay track accuracy against Riot timeline positions at minute marks. The method and the
 * acceptance thresholds are documented in docs/analytics/track-accuracy.md.
 */

/** A track sample matches a minute frame when it is at most this far from the frame's time. */
export const markToleranceMs = 1000;
/** Acceptable accuracy for a detected track, in game units and shares. */
export const accuracyThresholds = {
  /** Median distance between a detected and a timeline position. */
  medianError: 400,
  /** 95th percentile distance. */
  p95Error: 1200,
  /** Share of track observations with no position. */
  nullShare: 0.25,
  /** Minute marks compared before a verdict is given. */
  minimumComparisons: 10,
} as const;
export type AccuracyThresholds = typeof accuracyThresholds;

export interface AccuracyInput {
  roster: readonly { participantId: number; championId: number }[];
  samples: readonly {
    timeMs: number;
    positions: readonly { participantId: number; x: number | null; y: number | null }[];
  }[];
  frames: readonly {
    participantId: number;
    timestampMs: number;
    x: number | null;
    y: number | null;
  }[];
  /**
   * Every track observation per participant, when `samples` holds only the samples near minute
   * marks. Without it, observations are counted from `samples`.
   */
  counts?: readonly { participantId: number; observations: number; nulls: number }[];
}
export interface AccuracyStats {
  /** Minute marks with a timeline position and a matching track sample with a position. */
  comparisons: number;
  /** Minute marks with a timeline position whose matching track observation was null. */
  missedMarks: number;
  /** Minute marks with a timeline position but no track sample within the tolerance. */
  unsampledMarks: number;
  /** Errors in game units; null without comparisons. */
  mean: number | null;
  median: number | null;
  p95: number | null;
  observations: number;
  nullObservations: number;
  /** Null observations over all of the track's observations; null without observations. */
  nullShare: number | null;
}
export interface AccuracyReport {
  overall: AccuracyStats;
  champions: (AccuracyStats & { championId: number; participantIds: number[] })[];
}

/** The nearest-rank percentile of sorted values. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

function stats(
  errors: number[],
  missed: number,
  unsampled: number,
  observations: number,
  nulls: number,
): AccuracyStats {
  const sorted = [...errors].sort((a, b) => a - b);
  const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    comparisons: sorted.length,
    missedMarks: missed,
    unsampledMarks: unsampled,
    mean: round(sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    observations,
    nullObservations: nulls,
    nullShare: observations ? Math.round((nulls / observations) * 10000) / 10000 : null,
  };
}

/**
 * Compares each timeline frame with a position against the track sample nearest its timestamp
 * (within {@link markToleranceMs}), per champion and overall.
 */
export function compareTrack(input: AccuracyInput, toleranceMs = markToleranceMs): AccuracyReport {
  const times = input.samples.map((s) => s.timeMs);
  const nearest = (timeMs: number) => {
    let best = -1;
    for (let i = 0; i < times.length; i++)
      if (best < 0 || Math.abs(times[i]! - timeMs) < Math.abs(times[best]! - timeMs)) best = i;
    return best >= 0 && Math.abs(times[best]! - timeMs) <= toleranceMs
      ? input.samples[best]
      : undefined;
  };
  const per = new Map<
    number,
    { errors: number[]; missed: number; unsampled: number; observations: number; nulls: number }
  >();
  for (const { participantId } of input.roster)
    per.set(participantId, { errors: [], missed: 0, unsampled: 0, observations: 0, nulls: 0 });
  if (input.counts)
    for (const c of input.counts) {
      const p = per.get(c.participantId);
      if (p) Object.assign(p, { observations: c.observations, nulls: c.nulls });
    }
  else
    for (const s of input.samples)
      for (const o of s.positions) {
        const p = per.get(o.participantId);
        if (!p) continue;
        p.observations++;
        if (o.x === null || o.y === null) p.nulls++;
      }
  for (const f of input.frames) {
    const p = per.get(f.participantId);
    if (!p || f.x === null || f.y === null) continue;
    const sample = nearest(f.timestampMs);
    const o = sample?.positions.find((q) => q.participantId === f.participantId);
    if (!sample || !o) p.unsampled++;
    else if (o.x === null || o.y === null) p.missed++;
    else p.errors.push(Math.hypot(o.x - f.x, o.y - f.y));
  }
  const byChampion = Map.groupBy(input.roster, (r) => r.championId);
  const sum = (ids: readonly number[]) => {
    const parts = ids.map((id) => per.get(id)!);
    return stats(
      parts.flatMap((p) => p.errors),
      parts.reduce((a, p) => a + p.missed, 0),
      parts.reduce((a, p) => a + p.unsampled, 0),
      parts.reduce((a, p) => a + p.observations, 0),
      parts.reduce((a, p) => a + p.nulls, 0),
    );
  };
  return {
    overall: sum(input.roster.map((r) => r.participantId)),
    champions: [...byChampion]
      .map(([championId, members]) => {
        const participantIds = members.map((m) => m.participantId).sort((a, b) => a - b);
        return { championId, participantIds, ...sum(participantIds) };
      })
      .sort((a, b) => a.participantIds[0]! - b.participantIds[0]!),
  };
}

/** Whether a report meets the thresholds; each failure is described. Too few marks fail. */
export function evaluateAccuracy(
  stats: AccuracyStats,
  thresholds: AccuracyThresholds = accuracyThresholds,
) {
  const failures: string[] = [];
  if (stats.comparisons < thresholds.minimumComparisons)
    failures.push(
      `Only ${stats.comparisons} minute marks compared; at least ${thresholds.minimumComparisons} are needed.`,
    );
  if (stats.median !== null && stats.median > thresholds.medianError)
    failures.push(`Median error ${stats.median} exceeds ${thresholds.medianError}.`);
  if (stats.p95 !== null && stats.p95 > thresholds.p95Error)
    failures.push(`95th percentile error ${stats.p95} exceeds ${thresholds.p95Error}.`);
  if (stats.nullShare !== null && stats.nullShare > thresholds.nullShare)
    failures.push(`Null share ${stats.nullShare} exceeds ${thresholds.nullShare}.`);
  return { pass: failures.length === 0, failures };
}

export interface TrackAccuracy {
  matchId: string;
  report: AccuracyReport;
  verdict: { pass: boolean; failures: string[] };
  thresholds: AccuracyThresholds;
}
