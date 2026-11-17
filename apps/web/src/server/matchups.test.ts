import type { ChampionMatchupsQuery, MatchupMatrixQuery } from "@summonersnet/data/contracts";
import { beforeEach, expect, it, vi } from "vitest";
const championMatchups =
    vi.fn<(input: ChampionMatchupsQuery) => Promise<{ patch: string } | null>>(),
  matchupMatrix = vi.fn<(input: MatchupMatrixQuery) => Promise<{ patch: string }>>();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ championMatchups, matchupMatrix }) }));
const { loadChampionMatchups, loadMatchupMatrix } = await import("./matchups");
beforeEach(() => {
  championMatchups.mockReset().mockResolvedValue({ patch: "16.22" });
  matchupMatrix.mockReset().mockResolvedValue({ patch: "16.22" });
});
it("validates routes, filters and both page axes before any data query", async () => {
  expect(await loadChampionMatchups("../x", {})).toBeNull();
  expect(await loadMatchupMatrix("ALL", {})).toBeNull();
  for (const params of [
    { source: "all" },
    { patch: ["16.22"] },
    { page: ["1"] },
    { page: "0" },
    { value: "unknown" },
    { sort: "SQL" },
    { champion: "Ahri" },
  ])
    expect(await loadChampionMatchups("Ahri", params)).toMatchObject({
      matchups: null,
      error: "Choose Solo queue or Pro, a catalog patch, a role, a statistic and a positive page.",
    });
  for (const params of [
    { columnPage: ["1"] },
    { columnPage: "0" },
    { metric: "SQL" },
    { role: "TOP" },
    { pageSize: "100" },
  ])
    expect(await loadMatchupMatrix("MIDDLE", params)).toMatchObject({
      matrix: null,
      error: "Choose Solo queue or Pro, a catalog patch, a role, a statistic and a positive page.",
    });
  expect(championMatchups).not.toHaveBeenCalled();
  expect(matchupMatrix).not.toHaveBeenCalled();
});
it("passes validated filters, normalizes only patch sentinels and preserves not found", async () => {
  await loadChampionMatchups("Ahri", {
    source: "pro",
    role: "TOP",
    patch: "16.22",
    value: "raw",
    page: "2",
    sort: "gold10",
    order: "asc",
  });
  expect(championMatchups).toHaveBeenCalledWith({
    champion: "Ahri",
    source: "pro",
    role: "TOP",
    patch: "16.22",
    value: "raw",
    page: 2,
    pageSize: 25,
    sort: "gold10",
    order: "asc",
  });
  await loadChampionMatchups("Ahri", { patch: "all" });
  expect(championMatchups.mock.lastCall?.[0].patch).toBeUndefined();
  championMatchups.mockResolvedValueOnce(null);
  expect(await loadChampionMatchups("Unknown", {})).toBeNull();
  expect(
    await loadMatchupMatrix("MIDDLE", { patch: "", columnPage: "2", metric: "cs15" }),
  ).toMatchObject({ matrix: { patch: "16.22" }, error: null });
  expect(matchupMatrix).toHaveBeenCalledWith({
    role: "MIDDLE",
    source: "solo",
    value: "shrunk",
    page: 1,
    columnPage: 2,
    metric: "cs15",
  });
});
