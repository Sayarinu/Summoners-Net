import { expect, it, vi } from "vitest";

const wpaLeaderboard = vi.fn().mockResolvedValue({ patch: "16.22" });
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ wpaLeaderboard }) }));
const { loadWpaLeaderboard } = await import("./wpa-leaderboards");

it("validates the query string before reading", async () => {
  expect(await loadWpaLeaderboard({ kind: "player", patch: "all", page: "2" })).toEqual({
    board: { patch: "16.22" },
    error: null,
  });
  expect(wpaLeaderboard).toHaveBeenCalledWith({ kind: "player", page: 2, sort: "perGame" });
  for (const bad of [{ kind: "team" }, { patch: "latest" }, { extra: "1" }])
    expect((await loadWpaLeaderboard(bad)).error).toMatch(/Choose a board/);
  expect(wpaLeaderboard).toHaveBeenCalledTimes(1);
});
