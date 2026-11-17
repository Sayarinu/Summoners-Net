import { z } from "zod";
import { applySamplePolicy, deltaShrinkGames, shrinkDelta } from "./statistics.js";
import { matchupEstimate, matchupRoles, type MetricCounts } from "./matchups.js";
import type { PatchChampion } from "./patch-overview.js";

const championId = z.string().regex(/^[A-Za-z0-9]{1,40}$/);
const role = z.enum(matchupRoles);
/** `Ahri` or `Ahri:MIDDLE`; a pick's role is optional but needed for lane and synergy parts. */
const pick = z
  .string()
  .regex(/^[A-Za-z0-9]{1,40}(:[A-Z]{3,7})?$/)
  .transform((value, ctx) => {
    const [champion, assigned] = value.split(":") as [string, string | undefined];
    const parsed = assigned === undefined ? undefined : role.safeParse(assigned);
    if (parsed && !parsed.success) {
      ctx.addIssue({ code: "custom", message: "Unknown role" });
      return z.NEVER;
    }
    return { champion, role: parsed?.data ?? null };
  });
/** A comma-separated URL list, trimmed, with empty entries ignored. */
const entries = z
  .string()
  .max(600)
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
const picks = entries.pipe(z.array(pick).max(5));

export const draftAssistantQuerySchema = z
  .strictObject({
    source: z.enum(["solo", "pro"]).default("solo"),
    patch: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    side: z.enum(["blue", "red"]).default("blue"),
    role: role.default("MIDDLE"),
    blue: picks,
    red: picks,
    bans: entries.pipe(z.array(championId).max(10)),
  })
  .superRefine((q, ctx) => {
    const picked = [...q.blue, ...q.red].map((p) => p.champion);
    if (new Set(picked).size !== picked.length)
      ctx.addIssue({ code: "custom", message: "A champion can be picked only once" });
    const ours = q.side === "blue" ? q.blue : q.red;
    if (ours.some((p) => p.role === q.role))
      ctx.addIssue({ code: "custom", message: "The role to fill is already picked" });
    for (const side of [q.blue, q.red]) {
      const roles = side.flatMap((p) => (p.role ? [p.role] : []));
      if (new Set(roles).size !== roles.length)
        ctx.addIssue({ code: "custom", message: "Each role can be picked once per side" });
    }
  });
export type DraftAssistantQuery = z.input<typeof draftAssistantQuerySchema>;
export type ParsedDraftAssistantQuery = z.output<typeof draftAssistantQuerySchema>;

/** A part of a candidate's score: win-rate points above 50%, null below its minimum sample. */
export interface DraftPart {
  value: number | null;
  sampleCount: number;
}
export interface DraftCandidateInput {
  champion: PatchChampion;
  /** Lane games in the role, for tie-breaking and display. */
  games: number;
  /** The candidate's pooled win-rate counts across its lane opponents; the shrinkage baseline. */
  baseline: MetricCounts;
  /** Win-rate counts against the enemy picked in the same role; null when none is picked. */
  laneMatchup: MetricCounts | null;
  /** Stored blindability score (lower-tail win rate) and the picks its opponents cover. */
  blindability: { score: number | null; coveredPicks: number };
  /** Duo results with each ally whose role is known. */
  allies: { result: { games: number; wins: number }; expected: number | null }[];
}
export interface DraftCandidate {
  champion: PatchChampion;
  games: number;
  matchup: DraftPart | null;
  synergy: DraftPart | null;
  blindability: DraftPart | null;
  /** Mean of the known parts; null when none is known. */
  score: number | null;
  parts: number;
}

/** Shrunk lane win rate against the enemy laner, as points above 50%. */
export function matchupPart(c: DraftCandidateInput): DraftPart | null {
  if (!c.laneMatchup) return null;
  const shrunk = matchupEstimate(c.laneMatchup, c.baseline).shrunk;
  return { value: shrunk === null ? null : shrunk - 0.5, sampleCount: c.laneMatchup.count };
}
/** Mean shrunk duo delta over allies with enough results (the champion synergy policy). */
export function synergyPart(c: DraftCandidateInput): DraftPart | null {
  if (c.allies.length === 0) return null;
  const deltas = c.allies.flatMap((a) => {
    const rate = a.result.games > 0 ? a.result.wins / a.result.games : null;
    const delta = shrinkDelta(
      rate === null || a.expected === null ? null : rate - a.expected,
      a.result.games,
      deltaShrinkGames,
    );
    const shown = applySamplePolicy({ value: delta, sampleCount: a.result.games });
    return shown.value === null ? [] : [shown.value];
  });
  return {
    value: deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null,
    sampleCount: c.allies.reduce((s, a) => s + a.result.games, 0),
  };
}
/**
 * Ranks candidates by the mean of their known parts. Blindability counts only while the lane
 * opponent is unknown; once it is picked, the lane matchup replaces it. Unknown parts are left out
 * of the mean, never counted as zero; candidates with no known part rank last.
 */
export function rankDraftCandidates(
  candidates: readonly DraftCandidateInput[],
  laneOpponentKnown: boolean,
): DraftCandidate[] {
  return candidates
    .map((c) => {
      const matchup = matchupPart(c);
      const synergy = synergyPart(c);
      const blindability = laneOpponentKnown
        ? null
        : {
            value: c.blindability.score === null ? null : c.blindability.score - 0.5,
            sampleCount: c.blindability.coveredPicks,
          };
      const known = [matchup, synergy, blindability].flatMap((p) =>
        p?.value === null || p === null ? [] : [p.value],
      );
      return {
        champion: c.champion,
        games: c.games,
        matchup,
        synergy,
        blindability,
        score: known.length ? known.reduce((s, v) => s + v, 0) / known.length : null,
        parts: known.length,
      };
    })
    .sort(
      (a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        b.games - a.games ||
        a.champion.championKey - b.champion.championKey,
    );
}

export interface DraftAssistant {
  query: ParsedDraftAssistantQuery;
  patch: string | null;
  patches: string[];
  /** Champion ids in the input that are not in the local catalog; they are ignored. */
  unknownChampions: string[];
  laneOpponent: PatchChampion | null;
  /** Allies whose role is known and so contribute synergy. */
  synergyAllies: PatchChampion[];
  candidates: DraftCandidate[];
}
