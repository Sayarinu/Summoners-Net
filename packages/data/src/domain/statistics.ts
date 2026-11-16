import type { Game, Summary } from "./models.js";
import type { SampledValue } from "./historical.js";
export function summarize(games: readonly Game[], kind: "team" | "player", id: string): Summary {
  let eligibleGames = 0,
    resultGames = 0,
    wins = 0,
    kills = 0,
    deaths = 0,
    assists = 0,
    kdaGames = 0;
  const champions = new Map<
    string,
    { name: string; games: number; wins: number; resultGames: number }
  >();
  for (const game of games) {
    if (!game.complete) continue;
    const played = game.participants.filter((p) =>
      kind === "player" ? p.player?.id === id : p.team.id === id,
    );
    if (!played.length) continue;
    eligibleGames++;
    const row = kind === "player" ? played[0] : played.find((p) => p.role === "team");
    if (row) {
      if (row.won !== null) {
        resultGames++;
        if (row.won) wins++;
      }
      if (row.kills !== null && row.deaths !== null && row.assists !== null) {
        kdaGames++;
        kills += row.kills;
        deaths += row.deaths;
        assists += row.assists;
      }
    }
    const picks = new Map(
      played.filter((p) => p.role !== "team" && p.champion).map((p) => [p.champion!, p]),
    );
    for (const [name, pick] of picks) {
      const item = champions.get(name) ?? { name, games: 0, wins: 0, resultGames: 0 };
      item.games++;
      if (pick.won !== null) {
        item.resultGames++;
        if (pick.won) item.wins++;
      }
      champions.set(name, item);
    }
  }
  return {
    eligibleGames,
    resultGames,
    wins,
    winRate: resultGames ? wins / resultGames : null,
    kda: deaths ? (kills + assists) / deaths : null,
    kdaGames,
    champions: [...champions.values()].sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name),
    ),
  };
}

// Shared rate statistics. Every result is a SampledValue: it carries its sample count, and a
// missing input gives a null value, never zero. Inconsistent counts are programming errors.
type Count = number | null | undefined;
function counts(successes: Count, trials: Count) {
  if (successes == null || trials == null) return null;
  if (
    !Number.isInteger(successes) ||
    !Number.isInteger(trials) ||
    successes < 0 ||
    successes > trials
  )
    throw new RangeError(`Invalid counts: ${successes} of ${trials}`);
  return { successes, trials };
}

export interface RateInterval extends SampledValue {
  lower: number | null;
  upper: number | null;
}
/** Observed rate with a Wilson score interval; z = 1.96 gives 95% coverage. */
export function wilsonInterval(successes: Count, trials: Count, z = 1.96): RateInterval {
  const c = counts(successes, trials);
  if (!c || c.trials === 0)
    return { value: null, sampleCount: c?.trials ?? 0, lower: null, upper: null };
  const n = c.trials;
  const p = c.successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = (z / denominator) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    value: p,
    sampleCount: n,
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  };
}

/** A Beta prior expressed as a baseline rate and a strength in pseudo-trials. */
export interface RatePrior {
  baseline: number;
  strength: number;
}
/**
 * Fits a prior to many groups (for example every champion on a patch) by the method of moments.
 * Returns null when the groups cannot support one: fewer than two groups with trials, or a pooled
 * rate of exactly 0 or 1. When the observed spread is no larger than sampling noise, the strength
 * is capped at maximumStrength, which shrinks every group almost fully to the baseline.
 */
export function fitRatePrior(
  groups: readonly { successes: Count; trials: Count }[],
  maximumStrength = 10000,
): RatePrior | null {
  const valid = groups.flatMap((g) => {
    const c = counts(g.successes, g.trials);
    return c && c.trials > 0 ? [c] : [];
  });
  if (valid.length < 2) return null;
  const total = valid.reduce((n, g) => n + g.trials, 0);
  const baseline = valid.reduce((n, g) => n + g.successes, 0) / total;
  if (baseline === 0 || baseline === 1) return null;
  const observed =
    valid.reduce((n, g) => n + g.trials * (g.successes / g.trials - baseline) ** 2, 0) / total;
  const noise = (baseline * (1 - baseline) * valid.length) / total;
  const spread = observed - noise;
  const strength = spread > 0 ? (baseline * (1 - baseline)) / spread - 1 : maximumStrength;
  return { baseline, strength: Math.min(maximumStrength, Math.max(0, strength)) };
}

/** Empirical-Bayes estimate: the observed rate pulled toward the prior's baseline. */
export function shrinkRate(successes: Count, trials: Count, prior: RatePrior | null): SampledValue {
  const c = counts(successes, trials);
  if (!c || !prior) return { value: null, sampleCount: c?.trials ?? 0 };
  if (!(prior.strength >= 0) || !(prior.baseline >= 0 && prior.baseline <= 1))
    throw new RangeError("Invalid prior");
  const pseudo = prior.strength;
  if (c.trials + pseudo === 0) return { value: null, sampleCount: 0 };
  return {
    value: (c.successes + prior.baseline * pseudo) / (c.trials + pseudo),
    sampleCount: c.trials,
  };
}

/** Observed minus expected, keeping the observed sample count. */
export function deltaVersusExpected(observed: SampledValue, expected: number | null): SampledValue {
  return {
    value: observed.value === null || expected === null ? null : observed.value - expected,
    sampleCount: observed.sampleCount,
  };
}

/** Below minimum a value is hidden (null); below reliable it is shown but flagged low sample. */
export interface SamplePolicy {
  minimum: number;
  reliable: number;
}
export const defaultSamplePolicy: SamplePolicy = { minimum: 10, reliable: 50 };
export type SampleStatus = "shown" | "low-sample" | "hidden";
export function applySamplePolicy<T extends SampledValue>(
  sampled: T,
  policy: SamplePolicy = defaultSamplePolicy,
): T & { status: SampleStatus } {
  if (!(policy.minimum >= 0 && policy.reliable >= policy.minimum))
    throw new RangeError("Invalid sample policy");
  if (sampled.value === null || sampled.sampleCount < policy.minimum)
    return {
      ...sampled,
      value: null,
      ...("lower" in sampled ? { lower: null, upper: null } : {}),
      status: "hidden",
    };
  return { ...sampled, status: sampled.sampleCount < policy.reliable ? "low-sample" : "shown" };
}

/**
 * The win rate two teammates would have if they did not interact: each one's distance from 50%
 * added together (a linear approximation of combining log-odds), clamped to [0, 1].
 */
export function expectedPairRate(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.min(1, Math.max(0, a + b - 0.5));
}
/** Pseudo-games that pull a small sample's delta toward zero: delta × n / (n + k). */
export const deltaShrinkGames = 50;
export function shrinkDelta(delta: number | null, games: number, pseudoGames = deltaShrinkGames) {
  return delta === null || games + pseudoGames <= 0
    ? null
    : (delta * games) / (games + pseudoGames);
}
