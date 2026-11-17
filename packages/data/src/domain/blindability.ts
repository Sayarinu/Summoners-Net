import { z } from "zod";
import { matchupEstimate, matchupRoles, type MetricCounts } from "./matchups.js";
import type { Page } from "./models.js";
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
/** Shrunk win rates against each opponent with enough observations, by opponent key. */
export function shrunkWinRates(matchups: readonly BlindabilityMatchup[]): Map<number, number> {
  const baseline = matchups.reduce<MetricCounts>(
    (s, m) => ({
      total: (s.total ?? 0) + (m.winRate.total ?? 0),
      count: s.count + m.winRate.count,
    }),
    { total: null, count: 0 },
  );
  return new Map(
    matchups.flatMap((m) => {
      const shrunk = matchupEstimate(m.winRate, baseline).shrunk;
      return shrunk === null ? [] : [[m.opponentKey, shrunk] as const];
    }),
  );
}
export function blindability(
  championKey: number,
  matchups: readonly BlindabilityMatchup[],
  rolePicks: ReadonlyMap<number, number>,
): Blindability {
  const points = [...shrunkWinRates(matchups)].flatMap(([opponentKey, winRate]) => {
    const picks = rolePicks.get(opponentKey) ?? 0;
    return picks === 0 ? [] : [{ opponentKey, winRate, picks }];
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

export const counterPickReasons = ["blind-unavailable", "never-best-response"] as const;
export type CounterPickReason = (typeof counterPickReasons)[number];
export interface DraftValue extends Blindability {
  /** Pick-weighted win rate against the enemies this champion is the best response to. */
  counterWinRate: number | null;
  counterOpponents: number;
  counterPicks: number;
  counterReason: CounterPickReason | null;
}
/**
 * For each enemy, the champion with the highest shrunk win rate against it (ties go to the lower
 * champion key). `rates` maps each champion to its shrunk win rates by opponent.
 */
export function bestResponses(
  rates: ReadonlyMap<number, ReadonlyMap<number, number>>,
): Map<number, number> {
  const best = new Map<number, { champion: number; winRate: number }>();
  for (const [champion, opponents] of rates)
    for (const [enemy, winRate] of opponents) {
      const current = best.get(enemy);
      if (
        !current ||
        winRate > current.winRate ||
        (winRate === current.winRate && champion < current.champion)
      )
        best.set(enemy, { champion, winRate });
    }
  return new Map([...best].map(([enemy, b]) => [enemy, b.champion]));
}
/**
 * Blind and counter-pick values for every champion in one role. Picking blind meets the whole
 * field; counter-picking plays the champion only into the enemies it is the best response to.
 */
export function roleDraftValues(
  samples: ReadonlyMap<number, readonly BlindabilityMatchup[]>,
  rolePicks: ReadonlyMap<number, number>,
): Map<number, DraftValue> {
  const rates = new Map([...samples].map(([champion, m]) => [champion, shrunkWinRates(m)]));
  const responses = bestResponses(rates);
  return new Map(
    [...samples].map(([champion, matchups]) => {
      const blind = blindability(champion, matchups, rolePicks);
      const points = [...responses].flatMap(([enemy, response]) => {
        const picks = rolePicks.get(enemy) ?? 0;
        return response === champion && picks > 0
          ? [{ winRate: rates.get(champion)!.get(enemy)!, picks }]
          : [];
      });
      const counterPicks = points.reduce((s, p) => s + p.picks, 0);
      const counterReason: CounterPickReason | null =
        blind.reason !== null
          ? "blind-unavailable"
          : points.length === 0
            ? "never-best-response"
            : null;
      return [
        champion,
        {
          ...blind,
          counterWinRate:
            counterReason === null
              ? points.reduce((s, p) => s + p.picks * p.winRate, 0) / counterPicks
              : null,
          counterOpponents: points.length,
          counterPicks,
          counterReason,
        },
      ];
    }),
  );
}

export const championBlindabilityQuerySchema = z.strictObject({
  championKey: z.number().int().positive(),
  source: z.enum(["solo", "pro"]),
  patch: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  role: z.enum(matchupRoles),
});
export type ChampionBlindabilityQuery = z.input<typeof championBlindabilityQuerySchema>;
export interface ChampionBlindability extends Omit<DraftValue, "worstOpponentKey"> {
  /** Share of the role's opponent picks with a sampled matchup; null without opponent picks. */
  coverage: number | null;
  /** The blindability score: the lower-tail win rate, null with a reason when coverage is too low. */
  score: number | null;
  /** Counter-pick win rate minus the blind expected win rate; null when either is unknown. */
  counterDifference: number | null;
  worstOpponent: PatchChampion | null;
  builtAt: string;
}

export const counterPickSorts = ["difference", "counter", "blind", "score", "games"] as const;
export const counterPickListQuerySchema = z.strictObject({
  role: z.enum(matchupRoles),
  source: z.enum(["solo", "pro"]).default("solo"),
  patch: z
    .string()
    .regex(/^\d{1,2}\.\d{1,2}$/)
    .optional(),
  sort: z.enum(counterPickSorts).default("difference"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CounterPickListQuery = z.input<typeof counterPickListQuerySchema>;
export interface CounterPickRow {
  champion: PatchChampion;
  games: number;
  coveredPicks: number;
  rolePicks: number;
  coverage: number | null;
  blind: number | null;
  counter: number | null;
  difference: number | null;
  score: number | null;
  counterOpponents: number;
  counterPicks: number;
  reason: BlindabilityReason | null;
  counterReason: CounterPickReason | null;
}
export interface CounterPickList {
  query: z.output<typeof counterPickListQuerySchema>;
  patch: string | null;
  patches: string[];
  page: Page<CounterPickRow>;
}
