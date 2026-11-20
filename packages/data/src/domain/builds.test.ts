import { describe, expect, it } from "vitest";
import { deriveBuild, itemKind, purchases, type ItemEvent, type ItemInfo } from "./builds.js";

// Real Data Dragon attributes for the items used below.
const items = new Map<number, ItemInfo>([
  [1001, { tags: ["Boots"], from: [], into: [3020, 3006], totalGold: 300 }],
  [3020, { tags: ["Boots", "MagicPenetration"], from: [1001], into: [3175], totalGold: 1100 }],
  [3089, { tags: ["SpellDamage"], from: [1058, 1058], into: [], totalGold: 3500 }],
  [
    4645,
    { tags: ["SpellDamage", "MagicPenetration"], from: [3145, 1058], into: [], totalGold: 3200 },
  ],
  [
    3157,
    { tags: ["Armor", "SpellDamage", "Active"], from: [1058, 2420], into: [], totalGold: 3250 },
  ],
  [
    3135,
    { tags: ["MagicPenetration", "SpellDamage"], from: [4630, 1026], into: [], totalGold: 3000 },
  ],
  [
    1056,
    { tags: ["Health", "Lane", "ManaRegen", "SpellDamage"], from: [], into: [], totalGold: 400 },
  ],
  [
    2003,
    { tags: ["HealthRegen", "Consumable", "Lane", "Jungle"], from: [], into: [], totalGold: 50 },
  ],
  [
    3340,
    { tags: ["Active", "Jungle", "Lane", "Trinket", "Vision"], from: [], into: [], totalGold: 0 },
  ],
]);
const at = (
  type: string,
  seconds: number,
  itemId: number | null,
  afterItemId: number | null = null,
): ItemEvent => ({
  type,
  timestampMs: seconds * 1000,
  itemId,
  afterItemId,
});

describe("item classification", () => {
  it("tells upgraded boots, completed items, trinkets and everything else apart", () => {
    expect(itemKind(items.get(3020))).toBe("boots");
    expect(itemKind(items.get(1001))).toBe("other");
    expect(itemKind(items.get(3089))).toBe("completed");
    expect(itemKind(items.get(1056))).toBe("other");
    expect(itemKind(items.get(2003))).toBe("other");
    expect(itemKind(items.get(3340))).toBe("trinket");
    expect(itemKind(undefined)).toBe("other");
  });
});
describe("build derivation", () => {
  it("derives starting items, boots and the completed item order", () => {
    const build = deriveBuild(
      [
        at("ITEM_PURCHASED", 1, 3340),
        at("ITEM_PURCHASED", 2, 1056),
        at("ITEM_PURCHASED", 3, 2003),
        at("ITEM_PURCHASED", 4, 2003),
        at("ITEM_PURCHASED", 400, 1001),
        at("ITEM_PURCHASED", 700, 3020),
        at("ITEM_PURCHASED", 900, 4645),
        at("ITEM_PURCHASED", 1300, 3089),
        at("ITEM_PURCHASED", 1700, 3157),
        at("ITEM_PURCHASED", 2000, 3135),
      ],
      items,
    );
    expect(build).toEqual({
      start: [1056, 2003, 2003],
      boots: 3020,
      completed: [4645, 3089, 3157, 3135],
    });
  });
  it("never counts an undone purchase, a sale or an undone sale as a purchase", () => {
    const events = [
      at("ITEM_PURCHASED", 1, 1056),
      // Bought a second potion and undid it.
      at("ITEM_PURCHASED", 2, 2003),
      at("ITEM_UNDO", 3, 2003, 0),
      // Rabadon's first, undone in favour of Shadowflame.
      at("ITEM_PURCHASED", 600, 3089),
      at("ITEM_UNDO", 605, 3089, 0),
      at("ITEM_PURCHASED", 610, 4645),
      // Selling and undoing a sale add nothing.
      at("ITEM_SOLD", 1500, 1056),
      at("ITEM_UNDO", 1501, 0, 1056),
      at("ITEM_DESTROYED", 1600, 2003),
      at("ITEM_PURCHASED", 1700, 3089),
    ];
    expect(purchases(events).map((p) => p.itemId)).toEqual([1056, 4645, 3089]);
    expect(deriveBuild(events, items)).toEqual({
      start: [1056],
      boots: null,
      completed: [4645, 3089],
    });
  });
  it("counts a repeated completed item once and leaves an empty opening as unknown", () => {
    const build = deriveBuild(
      [at("ITEM_PURCHASED", 600, 3089), at("ITEM_PURCHASED", 900, 3089)],
      items,
    );
    expect(build).toEqual({ start: null, boots: null, completed: [3089] });
  });
});
