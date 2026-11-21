import type { CounterPickListQuery, MatchupMatrixQuery } from "@summonersnet/data/contracts";
import { beforeEach, expect, it, vi } from "vitest";
const counterPickList = vi.fn<(input: CounterPickListQuery) => Promise<{ patch: string }>>(),
  matchupMatrix = vi.fn<(input: MatchupMatrixQuery) => Promise<{ patch: string }>>();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({
  data: () => ({ counterPickList, matchupMatrix }),
}));
const { loadCounterPickList, loadMatchupMatrix } = await import("./matchups");
beforeEach(() => {
  matchupMatrix.mockReset().mockResolvedValue({ patch: "16.22" });
});
it("validates the matrix role, filters and both page axes before any data query", async () => {
  expect(await loadMatchupMatrix("ALL", {})).toBeNull();
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
  expect(matchupMatrix).not.toHaveBeenCalled();
});
it("passes validated matrix filters and normalizes only patch sentinels", async () => {
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
it("validates the counter-pick list role and filters before reading", async () => {
  counterPickList.mockReset().mockResolvedValue({ patch: "16.22" });
  expect(await loadCounterPickList("ALL", {})).toBeNull();
  for (const params of [{ sort: "SQL" }, { pageSize: "101" }, { page: ["1"] }, { role: "TOP" }])
    expect(await loadCounterPickList("MIDDLE", params)).toMatchObject({
      list: null,
      role: "MIDDLE",
    });
  expect(counterPickList).not.toHaveBeenCalled();
  expect(
    await loadCounterPickList("TOP", { patch: "all", sort: "blind", order: "asc", page: "2" }),
  ).toEqual({ list: { patch: "16.22" }, error: null, role: "TOP" });
  expect(counterPickList).toHaveBeenCalledWith({
    role: "TOP",
    source: "solo",
    sort: "blind",
    order: "asc",
    page: 2,
    pageSize: 25,
  });
});
