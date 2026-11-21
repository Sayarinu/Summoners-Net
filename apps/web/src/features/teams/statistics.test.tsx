import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TeamStatistics } from "@summonersnet/data/contracts";
import { TeamStatisticsPanel } from "./statistics";

const known = (value: number, sampleCount = 10) => ({ value, sampleCount });
const unknown = { value: null, sampleCount: 0 };
const statistics: TeamStatistics = {
  games: 10,
  winRate: known(0.7),
  sides: [
    { side: "blue", games: 6, winRate: known(0.8333, 6) },
    { side: "red", games: 4, winRate: known(0.5, 4) },
  ],
  gameLength: { wins: known(1859.6, 7), losses: unknown },
  goldDiffAt15: known(812.3),
  killsPerMinute: known(0.512),
  firstBlood: known(0.6),
  firstTower: known(0.7),
  firstDragon: known(0.5),
  firstHerald: known(0.4),
  firstBaron: unknown,
  dragonControl: known(0.62),
  heraldControl: known(0.55),
  voidGrubControl: known(0.58),
  baronControl: known(0.7),
  towersPerGame: known(7.25),
};

it("shows side records, game lengths, early leads, first objectives and control", () => {
  render(<TeamStatisticsPanel statistics={statistics} />);
  const sides = screen.getByLabelText("Sides and Game Length");
  expect(sides).toHaveTextContent("Blue Side Win Rate6 Games83.3%");
  expect(sides).toHaveTextContent("Game Length in Wins7 Games31:00");
  expect(sides).toHaveTextContent("Game Length in Losses0 GamesUnknown");
  expect(sides).toHaveTextContent("Gold Diff @1510 Games+812");
  expect(screen.getByLabelText("First Objectives")).toHaveTextContent("First Baron0 GamesUnknown");
  expect(screen.getByLabelText("Objective Control")).toHaveTextContent(
    "Dragon Control10 Games62.0%",
  );
});

it("shows nothing for a selection without games", () => {
  const { container } = render(<TeamStatisticsPanel statistics={{ ...statistics, games: 0 }} />);
  expect(container).toBeEmptyDOMElement();
});
