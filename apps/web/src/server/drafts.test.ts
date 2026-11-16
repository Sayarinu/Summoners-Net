// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { loadDrafts } from "./drafts";
const latestDraftPatch = vi.hoisted(() => vi.fn());
const draftAnalytics = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ latestDraftPatch, draftAnalytics }) }));
beforeEach(() => {
  vi.clearAllMocks();
  latestDraftPatch.mockResolvedValue("16.4");
  draftAnalytics.mockResolvedValue({ games: 0 });
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
