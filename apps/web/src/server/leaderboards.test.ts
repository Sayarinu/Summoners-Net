import { beforeEach, expect, it, vi } from "vitest";
const leaderboard = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ leaderboard }) }));
const { loadLeaderboard } = await import("./leaderboards");
beforeEach(() => leaderboard.mockReset().mockResolvedValue({ page: { items: [] } }));
it("validates regions and pagination before querying", async () => {
  expect(await loadLeaderboard("euw1", { page: "2", pageSize: "10" })).toEqual({
    list: { page: { items: [] } },
    error: null,
  });
  expect(leaderboard).toHaveBeenCalledWith({ region: "euw1", page: 2, pageSize: 10 });
  expect(await loadLeaderboard("europe", {})).toBeNull();
  for (const params of [{ page: "0" }, { pageSize: "101" }, { page: ["1", "2"] }, { extra: "x" }]) {
    const result = await loadLeaderboard("euw1", params);
    expect(result?.list).toBeNull();
    expect(result?.error).toMatch(/positive page/);
  }
  expect(leaderboard).toHaveBeenCalledTimes(1);
});
