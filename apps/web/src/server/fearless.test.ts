import { expect, it, vi } from "vitest";
import { game, match, seriesGames } from "../../tests/fixtures";
import { previousFearlessPicks } from "./fearless";

const archivedGame = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ game: archivedGame }) }));

it("carries all ten confirmed previous picks into a documented Fearless game", async () => {
  const worlds = {
    ...match,
    league: "Worlds" as const,
    event: "2026 · Playoffs",
    startsAt: "2026-11-14T19:45:00.000Z",
  };
  const champions = Array.from({ length: 10 }, (_, index) => `Champion ${index}`);
  const rawRoles = ["top", "jng", "mid", "bot", "sup"];
  const roles = ["top", "jungle", "mid", "bottom", "support"];
  archivedGame.mockResolvedValue({
    ...game,
    participants: champions.map((champion, index) => ({
      ...game.participants[0],
      champion,
      role: rawRoles[index % rawRoles.length],
    })),
  });
  expect(await previousFearlessPicks(worlds, seriesGames(), 2)).toEqual(
    champions.map((champion, index) => ({ champion, role: roles[index % roles.length] })),
  );
  expect(await previousFearlessPicks(worlds, seriesGames(), 1)).toEqual([]);
  expect(await previousFearlessPicks(worlds, seriesGames(), 3)).toEqual([]);
  expect(await previousFearlessPicks(match, seriesGames(), 2)).toEqual([]);
});
