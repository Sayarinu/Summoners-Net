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
  expect(screen.getByRole("heading", { name: "Blue side won" })).toBeVisible();
  expect(
    screen.getByText(/model v1 \(#4, features v1\).*Brier score on held-out games is 0\.181/),
  ).toBeVisible();
  expect(container.querySelectorAll(".np-chart__markers path")).toHaveLength(1);
  expect(screen.getByRole("table", { name: "Kills and objectives" })).toHaveTextContent(
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
  expect(screen.queryByText("Blue side win probability by minute")).toBeNull();
  expect(screen.getByRole("heading", { name: "Result unknown" })).toBeVisible();
});
