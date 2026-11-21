// Skill orders from timeline skill-up events. Only normal level-ups of the basic abilities count
// (slots 1-3: Q, W, E); the ultimate (slot 4) and evolutions are ignored.
export interface SkillEvent {
  timestampMs: number;
  skillSlot: number | null;
  levelUpType: string | null;
}
export interface SkillOrder {
  /** The first three basic level-ups, repeats included, such as [1, 3, 1]; null if fewer. */
  first: number[] | null;
  /** Basic abilities in the order they reach five points; null if fewer than two did. */
  max: number[] | null;
}
export const basicSlots = [1, 2, 3] as const;
export const maxRank = 5;
export const skillNames: Record<number, string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };

export function deriveSkillOrder(events: readonly SkillEvent[]): SkillOrder {
  const basics = [...events]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .filter(
      (e) =>
        (e.levelUpType === null || e.levelUpType === "NORMAL") &&
        e.skillSlot !== null &&
        (basicSlots as readonly number[]).includes(e.skillSlot),
    )
    .map((e) => e.skillSlot!);
  const points = new Map<number, number>();
  const maxed: number[] = [];
  for (const slot of basics) {
    const rank = (points.get(slot) ?? 0) + 1;
    points.set(slot, rank);
    if (rank === maxRank) maxed.push(slot);
  }
  // Once two basic abilities are maxed, the remaining one is maxed last.
  const max =
    maxed.length >= 2
      ? [...maxed.slice(0, 2), ...basicSlots.filter((s) => !maxed.slice(0, 2).includes(s))]
      : null;
  return { first: basics.length >= 3 ? basics.slice(0, 3) : null, max };
}

/** Levels in a skill path: most ranked games reach 15, fewer reach 18. */
export const skillPathLevels = 15;
/**
 * Every normal level-up in order, the ultimate included (slot 4), for the first
 * `skillPathLevels` levels; null when the game ended before the champion reached that level.
 */
export function deriveSkillPath(events: readonly SkillEvent[]): number[] | null {
  const ups = [...events]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .filter(
      (e) =>
        (e.levelUpType === null || e.levelUpType === "NORMAL") &&
        e.skillSlot !== null &&
        e.skillSlot >= 1 &&
        e.skillSlot <= 4,
    )
    .map((e) => e.skillSlot!);
  return ups.length >= skillPathLevels ? ups.slice(0, skillPathLevels) : null;
}

/** A champion's last level; its skill grid covers every level. */
export const maxChampionLevel = 18;
const ultimateLevels = [6, 11, 16];
/**
 * A skill path continued to level 18 by the client's rules: the ultimate at 16, then points into
 * the basic ability with the most ranks that is not yet maxed, so it follows the max order.
 */
export function completeSkillPath(path: readonly number[]): number[] {
  const ranks = new Map<number, number>();
  for (const slot of path) ranks.set(slot, (ranks.get(slot) ?? 0) + 1);
  const rank = (slot: number) => ranks.get(slot) ?? 0;
  const full = [...path];
  while (full.length < maxChampionLevel) {
    const level = full.length + 1;
    const next =
      ultimateLevels.includes(level) && rank(4) < 3
        ? 4
        : basicSlots.filter((s) => rank(s) < maxRank).sort((a, b) => rank(b) - rank(a))[0];
    if (next === undefined) break;
    full.push(next);
    ranks.set(next, rank(next) + 1);
  }
  return full;
}
