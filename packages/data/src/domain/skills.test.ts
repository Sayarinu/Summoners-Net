import { expect, it } from "vitest";
import { deriveSkillOrder, type SkillEvent } from "./skills.js";

const ups = (...slots: (number | [number, string])[]): SkillEvent[] =>
  slots.map((s, i) => ({
    timestampMs: i * 60000,
    skillSlot: Array.isArray(s) ? s[0] : s,
    levelUpType: Array.isArray(s) ? s[1] : "NORMAL",
  }));

it("takes the first three basic level-ups and the order abilities reach five points", () => {
  // A standard Q > E > W max: Q E W, then Q at 4, R at 6, ...
  const order = deriveSkillOrder(ups(1, 3, 2, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2));
  expect(order).toEqual({ first: [1, 3, 2], max: [1, 3, 2] });
  expect(deriveSkillOrder(ups(1, 3, 1, 1)).first).toEqual([1, 3, 1]);
});
it("ignores the ultimate and evolutions, and sorts by time", () => {
  const events = ups(4, [1, "EVOLVE"], 2, 2, 2, 2, 2, 3, 3, 3, 3, 3);
  expect(deriveSkillOrder(events)).toEqual({ first: [2, 2, 2], max: [2, 3, 1] });
  expect(deriveSkillOrder([...events].reverse())).toEqual(deriveSkillOrder(events));
});
it("leaves orders unknown when the game ends before they are decided", () => {
  expect(deriveSkillOrder(ups(1, 3))).toEqual({ first: null, max: null });
  expect(deriveSkillOrder(ups(1, 1, 1, 1, 1, 3, 2))).toEqual({ first: [1, 1, 1], max: null });
  expect(deriveSkillOrder([])).toEqual({ first: null, max: null });
  expect(
    deriveSkillOrder([{ timestampMs: 0, skillSlot: null, levelUpType: null }]).first,
  ).toBeNull();
});
