import { matchupPriorGames, type matchupRoles } from "./matchups.js";
import {
  defaultSamplePolicy,
  deltaShrinkGames,
  expectedPairRate,
  shrinkDelta,
} from "./statistics.js";

/**
 * Pre-game draft win probability. Three blue-minus-red features, in win-rate points above 50%:
 * champion strength (role win rates), lane matchups (shrunk) and synergy (shrunk duo deltas).
 * Inputs below the minimum sample are left out of their sum; coverage says how many counted.
 */
export const draftModelVersion = 1;
export const draftFeatureVersion = 1;
export const draftFeatures = [
  { name: "strength", label: "Champion strength difference (per 10 points)" },
  { name: "lane", label: "Lane matchup advantage (per 10 points)" },
  { name: "synergy", label: "Synergy difference (per 10 points)" },
] as const;
/** Features are scaled so one unit is ten win-rate percentage points. */
export const draftFeatureScale = 10;
const minimum = defaultSamplePolicy.minimum;

export type DraftRole = (typeof matchupRoles)[number];
export interface DraftSlot {
  championKey: number;
  role: DraftRole;
}
export interface DraftTeams {
  blue: readonly DraftSlot[];
  red: readonly DraftSlot[];
}
export interface Counts {
  wins: number;
  games: number;
}
/** Stored or training counts; null where nothing was observed. */
export interface DraftLookup {
  strength(championKey: number, role: DraftRole): Counts | null;
  /** The champion's results against the opponent in the role, and its pooled lane baseline. */
  lane(championKey: number, opponentKey: number, role: DraftRole): Counts | null;
  laneBaseline(championKey: number, role: DraftRole): Counts | null;
  duo(a: DraftSlot, b: DraftSlot): Counts | null;
}
export interface DraftInput {
  kind: "strength" | "lane" | "synergy";
  /** The side the value favours when positive; lanes are from blue's side. */
  side: "blue" | "red";
  role: DraftRole;
  /** The champion, or both champions of a lane or a pair. */
  championKeys: number[];
  /** Win-rate points above 50% (or above the expected pair rate); null below the minimum sample. */
  value: number | null;
  sampleCount: number;
}
export interface Coverage {
  known: number;
  total: number;
}
export interface DraftFeatures {
  x: number[];
  inputs: DraftInput[];
  coverage: { strength: Coverage; lane: Coverage; synergy: Coverage };
}

const rate = (c: Counts | null) => (c && c.games >= minimum ? c.wins / c.games : null);
const pairs = <T>(list: readonly T[]) =>
  list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b] as const));

export function draftFeatureValues(teams: DraftTeams, lookup: DraftLookup): DraftFeatures {
  const inputs: DraftInput[] = [];
  for (const side of ["blue", "red"] as const)
    for (const s of teams[side]) {
      const c = lookup.strength(s.championKey, s.role);
      const r = rate(c);
      inputs.push({
        kind: "strength",
        side,
        role: s.role,
        championKeys: [s.championKey],
        value: r === null ? null : r - 0.5,
        sampleCount: c?.games ?? 0,
      });
    }
  for (const b of teams.blue) {
    const r = teams.red.find((x) => x.role === b.role);
    if (!r) continue;
    const c = lookup.lane(b.championKey, r.championKey, b.role);
    const base = rate(lookup.laneBaseline(b.championKey, b.role));
    const shrunk =
      c && c.games >= minimum && base !== null
        ? (c.wins + matchupPriorGames * base) / (c.games + matchupPriorGames)
        : null;
    inputs.push({
      kind: "lane",
      side: "blue",
      role: b.role,
      championKeys: [b.championKey, r.championKey],
      value: shrunk === null ? null : shrunk - 0.5,
      sampleCount: c?.games ?? 0,
    });
  }
  for (const side of ["blue", "red"] as const)
    for (const [a, b] of pairs(teams[side])) {
      const c = lookup.duo(a, b);
      const expected = expectedPairRate(
        rate(lookup.strength(a.championKey, a.role)),
        rate(lookup.strength(b.championKey, b.role)),
      );
      const delta =
        c && c.games >= minimum && expected !== null
          ? shrinkDelta(c.wins / c.games - expected, c.games, deltaShrinkGames)
          : null;
      inputs.push({
        kind: "synergy",
        side,
        role: a.role,
        championKeys: [a.championKey, b.championKey],
        value: delta,
        sampleCount: c?.games ?? 0,
      });
    }
  const feature = (kind: DraftInput["kind"]) =>
    inputs
      .filter((i) => i.kind === kind && i.value !== null)
      .reduce((s, i) => s + (i.side === "blue" ? 1 : -1) * i.value!, 0) * draftFeatureScale;
  const coverage = (kind: DraftInput["kind"]): Coverage => ({
    known: inputs.filter((i) => i.kind === kind && i.value !== null).length,
    total: inputs.filter((i) => i.kind === kind).length,
  });
  return {
    x: [feature("strength"), feature("lane"), feature("synergy")],
    inputs,
    coverage: {
      strength: coverage("strength"),
      lane: coverage("lane"),
      synergy: coverage("synergy"),
    },
  };
}

/** One finished game for training: both full teams and blue's result. */
export interface DraftGame {
  matchId: string;
  patch: string;
  teams: DraftTeams;
  blueWin: boolean;
}
const slotKey = (patch: string, s: DraftSlot) => `${patch}|${s.championKey}|${s.role}`;
const laneKey = (patch: string, a: DraftSlot, b: DraftSlot) =>
  `${patch}|${a.role}|${a.championKey}|${b.championKey}`;
const duoKey = (patch: string, a: DraftSlot, b: DraftSlot) => {
  const [x, y] = [`${a.championKey}:${a.role}`, `${b.championKey}:${b.role}`].sort();
  return `${patch}|${x}|${y}`;
};
/** The counts one game adds, from each side's point of view. */
function contributions(g: DraftGame) {
  const out = new Map<string, Counts>();
  const add = (key: string, won: boolean) => {
    const c = out.get(key) ?? { wins: 0, games: 0 };
    out.set(key, { wins: c.wins + Number(won), games: c.games + 1 });
  };
  for (const side of ["blue", "red"] as const) {
    const won = side === "blue" ? g.blueWin : !g.blueWin;
    const own = g.teams[side],
      other = g.teams[side === "blue" ? "red" : "blue"];
    for (const s of own) {
      add(`s|${slotKey(g.patch, s)}`, won);
      const o = other.find((x) => x.role === s.role);
      if (o) add(`l|${laneKey(g.patch, s, o)}`, won);
    }
    for (const [a, b] of pairs(own)) add(`d|${duoKey(g.patch, a, b)}`, won);
  }
  return out;
}
/**
 * Counts built from training games only. `lookupFor` scores a game against them; for a training
 * game it leaves out the game's own result, so no game informs its own features.
 */
export function trainingCounts(games: readonly DraftGame[]) {
  const totals = new Map<string, Counts>();
  for (const g of games)
    for (const [key, c] of contributions(g)) {
      const t = totals.get(key) ?? { wins: 0, games: 0 };
      totals.set(key, { wins: t.wins + c.wins, games: t.games + c.games });
    }
  return {
    lookupFor(game: DraftGame, leaveOut: boolean): DraftLookup {
      const own = leaveOut ? contributions(game) : new Map<string, Counts>();
      const get = (key: string): Counts | null => {
        const t = totals.get(key);
        if (!t) return null;
        const o = own.get(key);
        const games = t.games - (o?.games ?? 0);
        return games > 0 ? { wins: t.wins - (o?.wins ?? 0), games } : null;
      };
      return {
        strength: (championKey, role) => get(`s|${slotKey(game.patch, { championKey, role })}`),
        lane: (championKey, opponentKey, role) =>
          get(
            `l|${laneKey(game.patch, { championKey, role }, { championKey: opponentKey, role })}`,
          ),
        // In training every lane game of a champion in a role is a strength game there too.
        laneBaseline: (championKey, role) => get(`s|${slotKey(game.patch, { championKey, role })}`),
        duo: (a, b) => get(`d|${duoKey(game.patch, a, b)}`),
      };
    },
  };
}

export interface DraftWinProbability {
  /** The active draft model and its held-out calibration, or null with a reason. */
  model: {
    id: number;
    modelVersion: number;
    brier: number | null;
    evalGames: number;
    patches: string[];
  } | null;
  reason: string | null;
  blueWinProbability: number | null;
  inputs: DraftInput[];
  coverage: DraftFeatures["coverage"];
}
