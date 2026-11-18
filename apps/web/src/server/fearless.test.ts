import { expect, it, vi } from "vitest";
import { game, match, seriesGames } from "../../tests/fixtures";
import { previousFearlessPicks } from "./fearless";

const archivedGame = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ historicalGame: archivedGame }) }));

it("orders confirmed Fearless picks by game and recorded pick slot", async () => {
  const worlds = {
    ...match,
    league: "Worlds" as const,
    event: "2026 · Playoffs",
    startsAt: "2026-11-14T19:45:00.000Z",
  };
  const champions = Array.from({ length: 10 }, (_, index) => `Champion ${index}`);
  const more = champions.map((champion) => `Later ${champion}`);
  const roles = ["top", "jungle", "mid", "bottom", "support"];
  const picks = (names: string[]) =>
    names.map((champion, index) => ({ champion, role: roles[index % roles.length]! }));
  const first = {
    draftOrder: [
      { action: "ban", slot: 1, champion: "Banned Champion" },
      ...picks(champions)
        .map((pick, index) => ({ action: "pick", slot: index + 1, ...pick }))
        .reverse(),
    ],
  };
  const second = {
    draftOrder: [],
    participants: picks(more).map(({ champion, role }) => ({
      ...game.participants[0],
      champion,
      position: role,
    })),
  };
  archivedGame.mockImplementation((id: string) =>
    Promise.resolve(id === "oracle:game:second" ? second : first),
  );
  expect(await previousFearlessPicks(worlds, seriesGames(), 2)).toEqual(picks(champions));
  const linked = seriesGames().map((entry) =>
    entry.number === 2 ? { ...entry, gameId: "oracle:game:second" } : entry,
  );
  expect(await previousFearlessPicks(worlds, linked.reverse(), 3)).toEqual([
    ...picks(champions),
    ...picks(more),
  ]);
  expect(await previousFearlessPicks(worlds, seriesGames(), 1)).toEqual([]);
  expect(await previousFearlessPicks(worlds, seriesGames(), 3)).toEqual([]);
  expect(await previousFearlessPicks(match, seriesGames(), 2)).toBeNull();
});
