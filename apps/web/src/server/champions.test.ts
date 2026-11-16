import { beforeEach, expect, it, vi } from "vitest";

const tierList = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ tierList }) }));
const { loadTierList } = await import("./champions");
beforeEach(() => tierList.mockReset().mockResolvedValue({ patch: "16.22" }));

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
