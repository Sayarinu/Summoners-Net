import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SoloGame } from "@summonersnet/data/contracts";
import { SoloGamePage } from "./page";

const game: SoloGame = {
  matchId: "EUW1_1",
  patch: "16.22",
  queueId: 420,
  durationSeconds: 1834,
  startedAt: null,
  teams: [
    { side: "blue", win: true },
    { side: "red", win: false },
  ],
  participants: [
    {
      participantId: 1,
      side: "blue",
      championKey: 103,
      championId: "Ahri",
      championName: "Ahri",
      role: "MIDDLE",
      kills: 3,
      deaths: 2,
      assists: null,
    },
  ],
  winProbability: {
    model: {
      id: 4,
      modelVersion: 1,
      featureVersion: 1,
      brier: 0.181,
      trainedAt: "2026-03-01T00:00:00.000Z",
    },
    reason: null,
    points: [
      { minute: 0, blueWinProbability: 0.5 },
      { minute: 1, blueWinProbability: 0.62 },
      { minute: 2, blueWinProbability: null },
    ],
    markers: [
      { id: "k", minute: 1, timestampMs: 98000, team: "blue", kind: "kill", label: "Blue kill" },
    ],
  },
};
it("charts win probability with the model's version and calibration, markers and gaps", () => {
  const { container } = render(<SoloGamePage game={game} />);
  expect(screen.getByRole("heading", { name: "Blue Side Won" })).toBeVisible();
  expect(
    screen.getByText(/model v1 \(#4, features v1\).*Brier score on held-out games is 0\.181/),
  ).toBeVisible();
  expect(container.querySelectorAll(".np-chart__markers path")).toHaveLength(1);
  expect(screen.getByRole("table", { name: "Kills and Objectives" })).toHaveTextContent(
    "1:38BlueBlue kill62.0%",
  );
  expect(screen.getByRole("table", { name: "Players" })).toHaveTextContent("3 / 2 / ?");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute("href", "/champions/Ahri");
});
it("explains why there is no chart instead of drawing a flat line", () => {
  render(
    <SoloGamePage
      game={{
        ...game,
        teams: [],
        winProbability: {
          model: null,
          reason: "No win probability model is active yet.",
          points: [],
          markers: [],
        },
      }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("No win probability model is active yet.");
  expect(screen.queryByText("Blue Side Win Probability by Minute")).toBeNull();
  expect(screen.getByRole("heading", { name: "Result unknown" })).toBeVisible();
});
it("shows the pre-game draft win probability with its inputs", () => {
  render(
    <SoloGamePage
      game={game}
      draft={{
        model: { id: 9, modelVersion: 1, brier: 0.238, evalGames: 40, patches: ["16.22"] },
        reason: null,
        blueWinProbability: 0.6,
        inputs: [
          {
            kind: "lane",
            side: "blue",
            role: "MIDDLE",
            championKeys: [game.participants[0]!.championKey, 9999],
            value: null,
            sampleCount: 4,
          },
        ],
        coverage: {
          strength: { known: 8, total: 10 },
          lane: { known: 0, total: 1 },
          synergy: { known: 3, total: 20 },
        },
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Draft Win Probability" })).toBeVisible();
  expect(screen.getByLabelText("Draft Win Probability by Side")).toHaveTextContent(
    "Blue Side60.0%",
  );
  expect(screen.getByLabelText("Draft Win Probability by Side")).toHaveTextContent(
    "Lane Matchup Coverage0 of 1",
  );
  expect(screen.getByRole("table", { name: "Draft Model Inputs" })).toHaveTextContent(
    "Champion 9999",
  );
  expect(screen.getByRole("table", { name: "Draft Model Inputs" })).toHaveTextContent("Unknown4");
});
