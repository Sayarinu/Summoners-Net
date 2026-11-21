import { beforeEach, expect, it, vi } from "vitest";

const championOverview = vi.fn();
const tierList = vi.fn();
const championStats = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ championOverview, tierList, championStats }) }));
const { loadChampionComparison, loadPatchComparison } = await import("./compare");
beforeEach(() => {
  championOverview
    .mockReset()
    .mockImplementation(({ champion }: { champion: string }) =>
      Promise.resolve(champion === "Ahri" ? { champion: { name: "Ahri" } } : null),
    );
  tierList.mockReset().mockResolvedValue({ patch: "16.22", page: { items: [] } });
  championStats.mockReset().mockResolvedValue({ patch: "16.21", rows: [] });
});

it("reads both champions on the same validated filters", async () => {
  expect(await loadChampionComparison({})).toEqual({ comparison: null, error: null });
  const result = await loadChampionComparison({
    a: "Ahri",
    b: "Nobody",
    role: "MIDDLE",
    patch: "",
    source: "solo",
  });
  expect(result.comparison).toEqual({
    query: { a: "Ahri", b: "Nobody", role: "MIDDLE", source: "solo" },
    a: { champion: { name: "Ahri" } },
    b: null,
  });
  expect(championOverview).toHaveBeenCalledWith({
    champion: "Nobody",
    role: "MIDDLE",
    source: "solo",
  });
  for (const bad of [
    { a: "Ahri", b: "../x" },
    { a: "Ahri", b: "Zed", role: "SUPPORT" },
    { a: "Ahri", b: "Zed", patch: "latest" },
    { a: "Ahri", b: "Zed", extra: "1" },
    { a: "Ahri", b: ["Zed", "Lux"] },
  ])
    expect((await loadChampionComparison(bad)).error).toMatch(/Choose two champion ids/);
  expect(championOverview).toHaveBeenCalledTimes(2);
});

it("reads the first patch's tier list and the second patch's statistics", async () => {
  expect(await loadPatchComparison({ a: "16.22" })).toEqual({ comparison: null, error: null });
  const result = await loadPatchComparison({ a: "16.22", b: "16.21", role: "TOP", page: "2" });
  expect(tierList).toHaveBeenCalledWith(
    { source: "solo", role: "TOP", patch: "16.22", page: 2, sort: "games" },
    { minimumGames: 0 },
  );
  expect(championStats).toHaveBeenCalledWith({ source: "solo", role: "TOP", patch: "16.21" });
  expect(result.comparison?.a).toEqual({ patch: "16.22", page: { items: [] } });
  // A patch without stored aggregates is reported as missing, not shown as the newest patch.
  tierList.mockResolvedValueOnce({ patch: "16.20", page: { items: [] } });
  championStats.mockResolvedValueOnce({ patch: null, rows: [] });
  const missing = await loadPatchComparison({ a: "16.22", b: "16.21" });
  expect(missing.comparison).toMatchObject({ a: null, b: null });
  for (const bad of [
    { a: "16.22", b: "x" },
    { a: "16.22", b: "16.21", page: "0" },
    { a: "16.22", b: "16.21", source: "ranked" },
  ])
    expect((await loadPatchComparison(bad)).error).toMatch(/Choose two patches/);
});
