// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { loadDraftAssistant, loadDrafts } from "./drafts";
const latestDraftPatch = vi.hoisted(() => vi.fn());
const draftAnalytics = vi.hoisted(() => vi.fn());
const draftAssistant = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ latestDraftPatch, draftAnalytics, draftAssistant }) }));
beforeEach(() => {
  vi.clearAllMocks();
  latestDraftPatch.mockResolvedValue("16.4");
  draftAnalytics.mockResolvedValue({ games: 0 });
  draftAssistant.mockResolvedValue({ candidates: [] });
});
it("validates external filters before reading data", async () => {
  for (const params of [
    { patch: "invalid" },
    { patch: ["16.4"] },
    { league: "x".repeat(101) },
    { priorityPage: "0" },
    { unexpected: "value" },
  ]) {
    expect((await loadDrafts(params)).error).toContain("Enter a patch");
  }
  expect(latestDraftPatch).not.toHaveBeenCalled();
  expect(draftAnalytics).not.toHaveBeenCalled();
});
it("defaults to the newest archived catalog patch and handles an empty archive", async () => {
  const result = await loadDrafts({ league: "", rolePage: "2" });
  expect(result.query).toEqual({ patch: "16.4", priorityPage: 1, rolePage: 2 });
  expect(draftAnalytics).toHaveBeenLastCalledWith(result.query);
  latestDraftPatch.mockResolvedValue(null);
  expect(await loadDrafts({})).toEqual({ query: null, analytics: null, error: null });
});
it("preserves explicit patch and league filters", async () => {
  await loadDrafts({ patch: "16.5", league: "LPL", priorityPage: "3" });
  expect(latestDraftPatch).not.toHaveBeenCalled();
  expect(draftAnalytics).toHaveBeenCalledWith({
    patch: "16.5",
    league: "LPL",
    priorityPage: 3,
    rolePage: 1,
  });
});
it("validates the draft assistant URL before reading stored aggregates", async () => {
  for (const params of [
    { blue: "Ahri,Ahri" },
    { blue: "Ahri:MIDDLE", role: "MIDDLE" },
    { red: "Ahri:SUPPORT" },
    { bans: ["Zed"] },
    { side: "purple" },
    { unexpected: "value" },
  ])
    expect(await loadDraftAssistant(params)).toMatchObject({
      assistant: null,
      error: expect.stringContaining("Enter picks"),
    });
  expect(draftAssistant).not.toHaveBeenCalled();
  expect(
    await loadDraftAssistant({ patch: "all", role: "TOP", red: "Nunu:TOP", bans: "", blue: "" }),
  ).toEqual({
    assistant: { candidates: [] },
    input: { blue: "", red: "Nunu:TOP", bans: "" },
    error: null,
  });
  expect(draftAssistant).toHaveBeenCalledWith({ role: "TOP", red: "Nunu:TOP" });
});
