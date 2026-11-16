import { expect, it, vi } from "vitest";

const soloGame = vi.fn().mockResolvedValue({ matchId: "EUW1_1" });
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ soloGame }) }));
const { loadSoloGame } = await import("./solo-games");

it("validates the match id before reading", async () => {
  expect(await loadSoloGame("EUW1_1")).toEqual({ matchId: "EUW1_1" });
  expect(await loadSoloGame("../etc/passwd")).toBeNull();
  expect(soloGame).toHaveBeenCalledTimes(1);
});
