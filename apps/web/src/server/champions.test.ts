import { beforeEach, expect, it, vi } from "vitest";

const tierList = vi.fn();
const championOverview = vi.fn();
const championBlindability = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ tierList, championOverview, championBlindability }) }));
const ahri = (role = "MIDDLE", patch: string | null = "16.22") => ({
  champion: { id: "Ahri", key: 103 },
  query: { role, source: "solo" },
  patch,
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
