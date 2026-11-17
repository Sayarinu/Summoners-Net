import { expect, it, vi } from "vitest";

const soloGame = vi.fn().mockResolvedValue({ matchId: "EUW1_1" });
const soloGamePositions = vi.fn().mockResolvedValue({ matchId: "EUW1_1", tracks: [] });
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ soloGame, soloGamePositions }) }));
const { loadSoloGame, loadSoloGameMap } = await import("./solo-games");

it("validates the match id before reading", async () => {
  expect(await loadSoloGame("EUW1_1")).toEqual({ matchId: "EUW1_1" });
  expect(await loadSoloGame("../etc/passwd")).toBeNull();
  expect(soloGame).toHaveBeenCalledTimes(1);
});
it("loads a game's map only for a valid, stored match", async () => {
  expect(await loadSoloGameMap("EUW1_1")).toEqual({
    game: { matchId: "EUW1_1" },
    positions: { matchId: "EUW1_1", tracks: [] },
  });
  expect(await loadSoloGameMap("not a match")).toBeNull();
  soloGame.mockResolvedValueOnce(null);
  expect(await loadSoloGameMap("EUW1_2")).toBeNull();
  expect(soloGamePositions).toHaveBeenCalledTimes(2);
});
