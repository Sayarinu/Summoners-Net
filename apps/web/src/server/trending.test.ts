import { beforeEach, expect, it, vi } from "vitest";
const trending = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ trending }) }));
const { loadTrending } = await import("./trending");
beforeEach(() => trending.mockReset().mockResolvedValue({ patch: "16.22" }));
it("validates filters and pages before querying and only normalizes the patch sentinel", async () => {
  expect(await loadTrending({ source: "pro", patch: "16.22", role: "MIDDLE", page: "2" })).toEqual({
    trends: { patch: "16.22" },
    error: null,
  });
  expect(trending).toHaveBeenLastCalledWith({
    source: "pro",
    patch: "16.22",
    role: "MIDDLE",
    page: 2,
  });
  await loadTrending({ patch: "all" });
  await loadTrending({ patch: "" });
  expect(trending).toHaveBeenLastCalledWith({ source: "solo", role: "ALL", page: 1 });
  for (const params of [
    { source: ["solo", "pro"] },
    { patch: ["16.22", "16.21"] },
    { patch: "16.22.1" },
    { role: "SUPPORT" },
    { page: "0" },
    { pageSize: "100" },
    { source: "all" },
  ]) {
    const result = await loadTrending(params);
    expect(result.trends).toBeNull();
    expect(result.error).toMatch(/Solo queue or Pro/);
  }
  expect(trending).toHaveBeenCalledTimes(3);
});
