import { it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ChampionPool } from "@summonersnet/data/contracts";
import { PlayerChampionPool } from "./champion-pool";

const known = (value: number, sampleCount = 4) => ({ value, sampleCount });
const unknown = { value: null, sampleCount: 0 };
const pool: ChampionPool = {
  sort: "kda",
  page: {
    page: 1,
    pageSize: 10,
    total: 12,
    items: [
      {
        champion: "Ahri",
        games: 4,
        wins: 3,
        winRate: known(0.75),
        kda: known(5.25),
        killParticipation: known(0.7),
        csPerMinute: known(9.1),
        goldPerMinute: known(432),
        damagePerMinute: known(611.6),
        goldDiffAt15: known(250),
        csDiffAt15: known(-4.5),
      },
      {
        champion: "Orianna",
        games: 1,
        wins: 0,
        winRate: known(0, 1),
        kda: unknown,
        killParticipation: unknown,
        csPerMinute: unknown,
        goldPerMinute: unknown,
        damagePerMinute: unknown,
        goldDiffAt15: unknown,
        csDiffAt15: unknown,
      },
    ],
  },
};

it("lists each champion's record and per-game statistics, with unknown values left empty", () => {
  render(
    <PlayerChampionPool
      pool={pool}
      portraits={{ Ahri: { id: "Ahri", imageUrl: null } }}
      filters={{ year: "2026", league: "LCK" }}
    />,
  );
  const [ahri, orianna] = within(screen.getByRole("table", { name: "Champion Pool" }))
    .getAllByRole("row")
    .slice(1);
  expect(ahri).toHaveTextContent("Ahri475.0% (3–1)5.2570.0%9.1432612+250-4.5");
  expect(orianna).toHaveTextContent("Orianna10.0% (0–1)Unknown");
  expect(within(ahri!).getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri",
  );
  const sorts = screen.getByRole("navigation", { name: "Sort Champion Pool" });
  expect(within(sorts).getByRole("link", { name: "KDA" })).toHaveAttribute("aria-current", "page");
  expect(within(sorts).getByRole("link", { name: "DPM" })).toHaveAttribute(
    "href",
    "?poolSort=damagePerMinute&year=2026&league=LCK",
  );
  expect(screen.getByText("12 champions")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Champion Pool Pages" })).toBeVisible();
});
