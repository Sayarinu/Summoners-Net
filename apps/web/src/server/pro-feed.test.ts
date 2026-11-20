import { beforeEach, expect, it, vi } from "vitest";
const proFeed = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ proFeed }) }));
const { loadProFeed } = await import("./pro-feed");
beforeEach(() => proFeed.mockReset().mockResolvedValue({ page: { items: [] } }));
it("validates both filters and bounded pagination before querying", async () => {
  expect(
    await loadProFeed({ team: "oracle:team:10", league: "LCK", page: "2", pageSize: "10" }),
  ).toEqual({ feed: { page: { items: [] } }, error: null });
  expect(proFeed).toHaveBeenCalledWith({
    team: "oracle:team:10",
    league: "LCK",
    page: 2,
    pageSize: 10,
  });
  for (const params of [
    { team: ["a", "b"] },
    { league: "x".repeat(301) },
    { team: "\0" },
    { page: "0" },
    { pageSize: "101" },
    { unknown: "x" },
  ]) {
    const result = await loadProFeed(params);
    expect(result.feed).toBeNull();
    expect(result.error).toMatch(/valid team and league/);
  }
  expect(proFeed).toHaveBeenCalledTimes(1);
});
