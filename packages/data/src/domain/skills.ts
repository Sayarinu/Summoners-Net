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
