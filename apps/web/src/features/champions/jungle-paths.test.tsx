import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChampionJunglePaths } from "@summonersnet/data/contracts";
import { JunglePathsSection } from "./jungle-paths";

const paths: ChampionJunglePaths = {
  patch: "16.22",
  games: 15,
  minimumSample: 10,
  clusters: [
    {
      startSide: "blue-buff",
      route: "cross",
      gankLane: "top",
      games: 12,
      resultGames: 12,
      winRate: 0.75,
      path: [
        { x: 3871, y: 7901 },
        { x: 3783, y: 6495 },
        { x: 6943, y: 5422 },
      ],
    },
    {
      startSide: null,
      route: null,
      gankLane: null,
      games: 3,
      resultGames: 2,
      winRate: null,
      path: [null, { x: 3783, y: 6495 }, null],
    },
  ],
};

it("tables clustered paths with samples and draws them on the minimap", () => {
  const { container } = render(<JunglePathsSection paths={paths} champion="Lee Sin" />);
  expect(screen.getByRole("heading", { name: "Early jungle paths" })).toBeVisible();
  expect(screen.getByText(/Inferred from 15 jungle games on patch 16.22/)).toBeVisible();
  const table = screen.getByRole("table", { name: "Jungle paths" });
  expect(table).toHaveTextContent("Blue buff sideCrosses to the other sideTop1275.0% (12)");
  expect(table).toHaveTextContent("UnknownUnknownUnknown3Too few games (2)");
  // The second path has one located minute, so only the first can be drawn as a line.
  expect(container.querySelectorAll(".np-minimap__path")).toHaveLength(1);
  expect(
    screen.getAllByText(/1\. Blue buff side, crosses to the other side, top gank/),
  ).not.toHaveLength(0);
});
it("says when the champion has no jungle games", () => {
  render(<JunglePathsSection paths={{ ...paths, games: 0, clusters: [] }} champion="Ahri" />);
  expect(screen.getByText("No jungle games")).toBeVisible();
  expect(screen.getByText(/Inferred from 0 jungle games/)).toBeVisible();
});
