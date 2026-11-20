import { beforeEach, expect, it, vi } from "vitest";
const summoner = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ data: () => ({ summoner }) }));
const { loadSummoner } = await import("./summoners");
const puuid = "a".repeat(78);
beforeEach(() => summoner.mockReset().mockResolvedValue({ gameName: "Fixture" }));
it("validates opaque player identifiers and bounded pages before querying", async () => {
  expect(await loadSummoner(puuid, { region: "euw1", page: "2", championPage: "3" })).toEqual({
    profile: { gameName: "Fixture" },
    error: null,
  });
  expect(summoner).toHaveBeenCalledWith({ puuid, region: "euw1", page: 2, championPage: 3 });
  expect(await loadSummoner("../bad", {})).toBeNull();
  for (const params of [
    { region: "europe" },
    { page: "0" },
    { championPage: "10001" },
    { page: ["1", "2"] },
  ]) {
    const result = await loadSummoner(puuid, params);
    expect(result?.profile).toBeNull();
    expect(result?.error).toMatch(/supported region/);
  }
  expect(summoner).toHaveBeenCalledTimes(1);
  summoner.mockResolvedValue(null);
  expect(await loadSummoner(puuid, {})).toBeNull();
});
