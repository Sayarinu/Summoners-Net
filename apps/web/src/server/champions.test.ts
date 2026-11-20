import { beforeEach, expect, it, vi } from "vitest";

const tierList = vi.fn();
const championOverview = vi.fn();
const championBlindability = vi.fn();
const championJunglePaths = vi.fn().mockResolvedValue(null);
const championMatchups = vi.fn().mockResolvedValue(null);
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({
  data: () => ({
    tierList,
    championOverview,
    championBlindability,
    championJunglePaths,
    championMatchups,
  }),
}));
const ahri = (role = "MIDDLE", patch: string | null = "16.22", roles: { role: string }[] = []) => ({
  champion: { id: "Ahri", key: 103 },
  query: { role, source: "solo" },
  patch,
  roles,
});
const { loadChampionOverview, loadTierList } = await import("./champions");
beforeEach(() => {
  tierList.mockReset().mockResolvedValue({ patch: "16.22" });
  championBlindability.mockReset().mockResolvedValue({ counterDifference: 0.05 });
});

it("validates the query string before reading aggregates", async () => {
  expect(
    await loadTierList({ role: "MIDDLE", tier: "", region: "all", sort: "winRate", page: "2" }),
  ).toEqual({
    list: { patch: "16.22" },
    error: null,
  });
  expect(tierList).toHaveBeenCalledWith(
    expect.objectContaining({ role: "MIDDLE", sort: "winRate", page: 2, source: "solo" }),
  );
  for (const bad of [{ role: "SUPPORT" }, { patch: "latest" }, { sort: "name" }, { extra: "1" }]) {
    const result = await loadTierList(bad);
    expect(result.list).toBeNull();
    expect(result.error).toMatch(/Choose filters/);
  }
  expect(tierList).toHaveBeenCalledTimes(1);
});

it("validates champion ids and filters, and returns null for unknown champions", async () => {
  championOverview
    .mockReset()
    .mockImplementation(({ champion }: { champion: string }) =>
      Promise.resolve(champion === "Ahri" ? ahri() : null),
    );
  expect(await loadChampionOverview("Ahri", { role: "MIDDLE", region: "all" })).toEqual({
    overview: ahri(),
    draftValue: { counterDifference: 0.05 },
    junglePaths: null,
    matchupSummary: null,
    error: null,
  });
  expect(championBlindability).toHaveBeenLastCalledWith({
    championKey: 103,
    source: "solo",
    patch: "16.22",
    role: "MIDDLE",
  });
  expect(championOverview).toHaveBeenLastCalledWith(
    expect.objectContaining({ champion: "Ahri", role: "MIDDLE", source: "solo" }),
  );
  // Invalid filters fall back to the defaults with an error; the champion still shows.
  const invalid = await loadChampionOverview("Ahri", { role: "SUPPORT" });
  expect(invalid?.error).toMatch(/Choose filters/);
  expect(championOverview).toHaveBeenLastCalledWith({ champion: "Ahri" });
  expect(await loadChampionOverview("Unknown", {})).toBeNull();
  const calls = championOverview.mock.calls.length;
  expect(await loadChampionOverview("../etc", {})).toBeNull();
  expect(championOverview.mock.calls.length).toBe(calls);
});

it("validates player sorting and pages including repeated query parameters", async () => {
  championOverview.mockReset().mockResolvedValue(ahri());
  const valid = await loadChampionOverview("Ahri", { playersSort: "winRate", playersPage: "2" });
  expect(valid?.error).toBeNull();
  expect(championOverview).toHaveBeenLastCalledWith(
    expect.objectContaining({ playersSort: "winRate", playersPage: 2 }),
  );
  for (const params of [
    { playersSort: "rank" },
    { playersPage: "0" },
    { playersPage: "1001" },
    { playersPage: ["1", "2"] },
    { playersSort: "all" },
    { playersPage: "" },
  ]) {
    expect((await loadChampionOverview("Ahri", params))?.error).toMatch(/Choose filters/);
    expect(championOverview).toHaveBeenLastCalledWith({ champion: "Ahri" });
  }
});

it("reads counter-pick values only for a lane role with a patch", async () => {
  for (const overview of [ahri("ALL"), ahri("MIDDLE", null)]) {
    championOverview.mockReset().mockResolvedValue(overview);
    expect((await loadChampionOverview("Ahri", {}))?.draftValue).toBeNull();
  }
  expect(championBlindability).not.toHaveBeenCalled();
});
it("reads jungle paths for the overview's champion and patch in solo queue only", async () => {
  championJunglePaths.mockReset().mockResolvedValue({ games: 3 });
  const overview = (source: string, patch: string | null) => ({
    champion: { id: "LeeSin", key: 64 },
    patch,
    query: { source },
    roles: [],
  });
  championOverview.mockReset().mockResolvedValueOnce(overview("solo", "16.22"));
  expect((await loadChampionOverview("LeeSin", {}))?.junglePaths).toEqual({ games: 3 });
  expect(championJunglePaths).toHaveBeenCalledWith({ championKey: 64, patch: "16.22" });
  championOverview.mockResolvedValueOnce(overview("pro", "16.22"));
  expect((await loadChampionOverview("LeeSin", { source: "pro" }))?.junglePaths).toBeNull();
  championOverview.mockResolvedValueOnce(overview("solo", null));
  expect((await loadChampionOverview("LeeSin", {}))?.junglePaths).toBeNull();
  expect(championJunglePaths).toHaveBeenCalledTimes(1);
});

it("summarizes the best and worst opponents for the role, or the most played one", async () => {
  const row = (key: number, shrunk: number | null) => ({
    opponent: { championKey: key },
    metrics: { winRate: { shrunk, baseline: 0.5 } },
  });
  championMatchups.mockReset().mockImplementation(({ order }: { order: string }) =>
    Promise.resolve({
      patch: "16.22",
      page: {
        total: 9,
        items:
          order === "desc"
            ? [row(1, 0.58), row(2, 0.52), row(3, 0.48)]
            : [row(4, 0.41), row(3, 0.48), row(2, 0.52)],
      },
    }),
  );
  championOverview.mockReset().mockResolvedValue(ahri("ALL", "16.22", [{ role: "TOP" }]));
  const result = await loadChampionOverview("Ahri", {});
  expect(championMatchups).toHaveBeenCalledWith(
    expect.objectContaining({ champion: "Ahri", role: "TOP", sort: "winRate", order: "asc" }),
  );
  // Above-average opponents are strengths and below-average ones weaknesses, each listed once.
  expect(result?.matchupSummary).toMatchObject({ role: "TOP", patch: "16.22", opponents: 9 });
  expect(result?.matchupSummary?.best.map((r) => r.opponent.championKey)).toEqual([1, 2]);
  expect(result?.matchupSummary?.worst.map((r) => r.opponent.championKey)).toEqual([4, 3]);
  // No lane role played and no role selected: no summary is read.
  championMatchups.mockClear();
  championOverview.mockReset().mockResolvedValue(ahri("ALL"));
  expect((await loadChampionOverview("Ahri", {}))?.matchupSummary).toBeNull();
  expect(championMatchups).not.toHaveBeenCalled();
  // A summary resolved to another patch would describe a different sample.
  championMatchups.mockResolvedValue({ patch: "16.21", page: { total: 0, items: [] } });
  championOverview.mockReset().mockResolvedValue(ahri("MIDDLE"));
  expect((await loadChampionOverview("Ahri", {}))?.matchupSummary).toBeNull();
});
