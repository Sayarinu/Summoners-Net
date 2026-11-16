import { expect, it } from "vitest";
import { deriveDraft } from "./draft-order.js";
import { draftParticipants } from "../../tests/draft-fixtures.js";

it("uses the first-pick flags for snake order, phases and eventual role order on either map side", () => {
  const blue = deriveDraft(true, draftParticipants());
  expect(blue).toMatchObject({ excludedReason: null, firstPickSide: "blue", firstPickWon: true });
  expect(blue.events).toHaveLength(20);
  expect(blue.events.find((e) => e.champion === "Jinx")).toMatchObject({
    action: "pick",
    phase: 1,
    slot: 5,
    role: "bottom",
    blind: true,
  });
  expect(blue.events.find((e) => e.champion === "Vi")).toMatchObject({
    action: "ban",
    phase: 2,
    slot: 8,
    role: null,
    blind: null,
  });
  const red = deriveDraft(true, draftParticipants("red"));
  expect(red).toMatchObject({ firstPickSide: "red", firstPickWon: false });
  expect(red.events.find((e) => e.champion === "Jinx")).toMatchObject({ slot: 6, blind: false });
  expect(red.events.find((e) => e.champion === "Vi")).toMatchObject({ slot: 7 });
});
it("excludes incomplete, conflicting, duplicated and unmatched drafts without inventing positions", () => {
  expect(deriveDraft(false, draftParticipants()).events).toEqual([]);
  const cases = [
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.firstpick = null;
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.firstpick = "false";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.firstpick = "invalid";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.pick1 = "NA";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.pick1 = "x".repeat(101);
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[0]!.draft.pick1 = "Ahri";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.pick1 = "Bard";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[5]!.draft.ban1 = "Ahri";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p.pop();
      p.pop();
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[0]!.position = "mid";
    },
    (p: ReturnType<typeof draftParticipants>) => {
      p[0]!.champion = null;
    },
  ];
  for (const change of cases) {
    const rows = draftParticipants();
    change(rows);
    const result = deriveDraft(true, rows);
    expect(result.excludedReason).toBeTypeOf("string");
    expect(result).toMatchObject({
      firstPickSide: null,
      firstPickWon: null,
      events: [],
    });
  }
});
it.each([
  ["true", "false"],
  ["1.0", "0.0"],
])("accepts equivalent flags %s/%s and leaves absent results unknown", (first, second) => {
  const rows = draftParticipants();
  rows[5]!.draft.firstpick = first;
  rows[11]!.draft.firstpick = second;
  rows.forEach((r) => (r.result = null));
  expect(deriveDraft(true, rows)).toMatchObject({
    excludedReason: null,
    firstPickSide: "blue",
    firstPickWon: null,
  });
});
