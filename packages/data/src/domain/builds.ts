// Builds from timeline item events. Only ITEM_PURCHASED adds a purchase. ITEM_UNDO of a purchase
// removes the latest matching purchase; sales, destructions and undone sales add nothing.
export interface ItemInfo {
  tags: readonly string[];
  from: readonly number[];
  into: readonly number[];
  totalGold: number | null;
}
export interface ItemEvent {
  type: string;
  timestampMs: number;
  /** For an undo, the item before it: the purchase undone, or 0 for an undone sale. */
  itemId: number | null;
  afterItemId: number | null;
}
export interface Build {
  /** Starting items, sorted; null when nothing was bought in the opening window. */
  start: number[] | null;
  /** The first upgraded boots bought. */
  boots: number | null;
  /** Completed items in purchase order, each counted once. */
  completed: number[];
}
/** Purchases made before the first back: 90 seconds after the game starts. */
export const startWindowMs = 90000;
/** The cheapest completed item; Doran's items and other starters cost far less. */
export const completedMinimumGold = 1600;

export type ItemKind = "boots" | "completed" | "trinket" | "other";
export function itemKind(info: ItemInfo | undefined): ItemKind {
  if (!info) return "other";
  if (info.tags.includes("Trinket")) return "trinket";
  // Upgraded boots build from the basic boots; the basic boots do not.
  if (info.tags.includes("Boots")) return info.from.length ? "boots" : "other";
  if (
    !info.into.length &&
    !info.tags.includes("Consumable") &&
    (info.totalGold ?? 0) >= completedMinimumGold
  )
    return "completed";
  return "other";
}

/** Applies undos to the purchase list in event order. */
export function purchases(events: readonly ItemEvent[]) {
  const bought: { itemId: number; timestampMs: number }[] = [];
  for (const e of [...events].sort((a, b) => a.timestampMs - b.timestampMs)) {
    if (e.type === "ITEM_PURCHASED" && e.itemId)
      bought.push({ itemId: e.itemId, timestampMs: e.timestampMs });
    else if (e.type === "ITEM_UNDO" && e.itemId) {
      const last = bought.map((b) => b.itemId).lastIndexOf(e.itemId);
      if (last >= 0) bought.splice(last, 1);
    }
  }
  return bought;
}

export function deriveBuild(
  events: readonly ItemEvent[],
  items: ReadonlyMap<number, ItemInfo>,
): Build {
  const bought = purchases(events);
  const start = bought
    .filter((b) => b.timestampMs < startWindowMs && itemKind(items.get(b.itemId)) !== "trinket")
    .map((b) => b.itemId)
    .sort((a, b) => a - b);
  const completed: number[] = [];
  for (const b of bought)
    if (itemKind(items.get(b.itemId)) === "completed" && !completed.includes(b.itemId))
      completed.push(b.itemId);
  return {
    start: start.length ? start : null,
    boots: bought.find((b) => itemKind(items.get(b.itemId)) === "boots")?.itemId ?? null,
    completed,
  };
}

export const buildKinds = [
  "start",
  "boots",
  "path",
  "slot1",
  "slot2",
  "slot3",
  "runes",
  "keystone",
  "shards",
  "spells",
  "skills",
  "skillmax",
] as const;
export interface BuildItem {
  kind: "item" | "rune" | "shard" | "spell" | "skill";
  /**
   * Data Dragon id: item id, rune or style id, stat shard id, summoner spell key, or ability slot
   * (1 Q, 2 W, 3 E).
   */
  id: number;
  /** Data Dragon's own id for a summoner spell ("SummonerFlash"), used for its icon. */
  catalogId: string;
  /** Null when Data Dragon has no entry, as for stat shards. */
  name: string | null;
  imageUrl: string | null;
}
export interface BuildRow {
  items: BuildItem[];
  games: number;
  /**
   * Rune and spell rows: the share of the champion's games in the selection, null below the
   * minimum sample. Item rows have none (sample 0): only games with timelines count for items.
   */
  pickRate: { value: number | null; sampleCount: number };
  /** Null below the minimum sample, with the sample count kept. */
  winRate: { value: number | null; sampleCount: number };
  sample: "shown" | "low-sample" | "hidden";
}
export type ChampionBuilds = Record<(typeof buildKinds)[number], BuildRow[]> & {
  /** Games whose skill-ups did not decide the order, left out of skills and skillmax. */
  excluded: { skills: number; skillmax: number };
};
