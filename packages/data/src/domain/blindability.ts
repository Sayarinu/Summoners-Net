import { z } from "zod";
import { matchupEstimate, matchupRoles, type MetricCounts } from "./matchups.js";
import type { PatchChampion } from "./patch-overview.js";

/** Covered opponents must account for at least half of the role's opponent picks. */
export const blindabilityMinimumCoverage = 0.5;
export const blindabilityMinimumOpponents = 3;
/** The lower tail is the worst-matchup fifth of the covered opponent picks. */
export const blindabilityTailShare = 0.2;
export const blindabilityReasons = ["no-opponent-picks", "few-opponents", "low-coverage"] as const;
export type BlindabilityReason = (typeof blindabilityReasons)[number];

export interface OpponentPoint {
  /** Shrunk win rate against this opponent. */
  winRate: number;
  /** How often the opponent is picked in the role; the weight. */
  picks: number;
}
export interface OpponentSummary {
  expected: number;
  worstCase: number;
  variance: number;
  lowerTail: number;
}
/** Pick-weighted mean, minimum, variance and lower-tail mean of opponent win rates. */
export function summarizeOpponents(
  points: readonly OpponentPoint[],
  tailShare = blindabilityTailShare,
): OpponentSummary | null {
  const weight = points.reduce((s, p) => s + p.picks, 0);
  if (points.length === 0 || weight <= 0) return null;
  const expected = points.reduce((s, p) => s + p.picks * p.winRate, 0) / weight;
  const variance = points.reduce((s, p) => s + p.picks * (p.winRate - expected) ** 2, 0) / weight;
  const sorted = [...points].sort((a, b) => a.winRate - b.winRate);
  // Take whole opponents from the worst matchup up, and a fraction of the one crossing the tail.
  let remaining = tailShare * weight,
    tailTotal = 0;
  for (const p of sorted) {
    const taken = Math.min(p.picks, remaining);
    tailTotal += taken * p.winRate;
    remaining -= taken;
    if (remaining <= 0) break;
  }
  return {
    expected,
    worstCase: sorted[0]!.winRate,
    variance,
    lowerTail: tailTotal / (tailShare * weight),
  };
}

export interface BlindabilityMatchup {
  opponentKey: number;
  games: number;
  winRate: MetricCounts;
}
export interface Blindability {
  games: number;
  sampledOpponents: number;
  coveredOpponents: number;
  coveredPicks: number;
  rolePicks: number;
  expected: number | null;
  worstCase: number | null;
  worstOpponentKey: number | null;
  variance: number | null;
  lowerTail: number | null;
  reason: BlindabilityReason | null;
}
/**
 * Scores one champion in one role from its stored lane samples. `rolePicks` maps every champion
 * observed in the role to its paired games there; the champion's own picks are not opponents.
 */
export function blindability(
  championKey: number,
  matchups: readonly BlindabilityMatchup[],
  rolePicks: ReadonlyMap<number, number>,
): Blindability {
  const baseline = matchups.reduce<MetricCounts>(
    (s, m) => ({
      total: (s.total ?? 0) + (m.winRate.total ?? 0),
      count: s.count + m.winRate.count,
    }),
    { total: null, count: 0 },
  );
  const points = matchups.flatMap((m) => {
    const shrunk = matchupEstimate(m.winRate, baseline).shrunk;
    const picks = rolePicks.get(m.opponentKey) ?? 0;
    return shrunk === null || picks === 0
      ? []
      : [{ opponentKey: m.opponentKey, winRate: shrunk, picks }];
  });
  const total = [...rolePicks].reduce((s, [key, n]) => (key === championKey ? s : s + n), 0);
  const covered = points.reduce((s, p) => s + p.picks, 0);
  const reason: BlindabilityReason | null =
    total === 0
      ? "no-opponent-picks"
      : points.length < blindabilityMinimumOpponents
        ? "few-opponents"
        : covered / total < blindabilityMinimumCoverage
          ? "low-coverage"
          : null;
  const summary = reason === null ? summarizeOpponents(points) : null;
  const worst = summary
    ? points.reduce((a, b) =>
        b.winRate < a.winRate || (b.winRate === a.winRate && b.opponentKey < a.opponentKey) ? b : a,
      )
    : null;
  return {
    games: matchups.reduce((s, m) => s + m.games, 0),
    sampledOpponents: matchups.length,
    coveredOpponents: points.length,
    coveredPicks: covered,
    rolePicks: total,
    expected: summary?.expected ?? null,
    worstCase: summary?.worstCase ?? null,
    worstOpponentKey: worst?.opponentKey ?? null,
    variance: summary?.variance ?? null,
    lowerTail: summary?.lowerTail ?? null,
    reason,
  };
}

export const championBlindabilityQuerySchema = z.strictObject({
  championKey: z.number().int().positive(),
  source: z.enum(["solo", "pro"]),
  patch: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  role: z.enum(matchupRoles),
});
export type ChampionBlindabilityQuery = z.input<typeof championBlindabilityQuerySchema>;
export interface ChampionBlindability extends Omit<Blindability, "worstOpponentKey"> {
  /** Share of the role's opponent picks with a sampled matchup; null without opponent picks. */
  coverage: number | null;
  /** The blindability score: the lower-tail win rate, null with a reason when coverage is too low. */
  score: number | null;
  worstOpponent: PatchChampion | null;
  builtAt: string;
}
