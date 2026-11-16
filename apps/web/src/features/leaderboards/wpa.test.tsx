import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { WpaLeaderboard } from "@summonersnet/data/contracts";
import { WpaLeaderboardPage } from "./wpa";

const board: WpaLeaderboard = {
  query: { kind: "player", sort: "perGame", page: 1 },
  model: { id: 3, modelVersion: 1, brier: 0.18 },
  patch: "16.22",
  patches: ["16.22", "16.21"],
  page: {
    page: 1,
    pageSize: 50,
    total: 2,
    items: [
      {
        kind: "player",
        subject: "p1",
        name: "Top Laner#NA1",
        championId: null,
        games: 40,
        total: { value: 120, sampleCount: 40 },
        perGame: { value: 3, sampleCount: 40 },
      },
      {
        kind: "player",
        subject: "p2",
        name: null,
        championId: null,
        games: 4,
        total: { value: null, sampleCount: 4 },
        perGame: { value: null, sampleCount: 4 },
      },
    ],
  },
};
it("ranks rows with the model version, links players and marks small samples", () => {
  render(<WpaLeaderboardPage board={board} error={null} />);
  expect(screen.getByText(/Patch 16.22 · model v1 \(#3, Brier 0.180\)/)).toBeVisible();
  const table = screen.getByRole("table", { name: "Players by win probability added" });
  expect(table).toHaveTextContent("1Top Laner#NA140+3.00 pts+120.0 pts");
  expect(table).toHaveTextContent("2Unresolved player4Too few gamesUnknown");
  expect(screen.getByRole("link", { name: "Top Laner#NA1" })).toHaveAttribute(
    "href",
    "/summoners/p1",
  );
});
it("shows champion and role boards, the no-model state and errors", () => {
  const view = render(
    <WpaLeaderboardPage
      board={{
        ...board,
        query: { kind: "champion", sort: "total", page: 1 },
        page: {
          ...board.page,
          items: [
            {
              ...board.page.items[0]!,
              kind: "champion",
              subject: "103",
              name: "Ahri",
              championId: "Ahri",
            },
          ],
        },
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute("href", "/champions/Ahri");
  view.rerender(
    <WpaLeaderboardPage
      board={{
        ...board,
        query: { kind: "role", sort: "games", page: 1 },
        page: {
          ...board.page,
          items: [{ ...board.page.items[0]!, kind: "role", subject: "UTILITY" }],
        },
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("table", { name: "Roles by win probability added" })).toHaveTextContent(
    "Support",
  );
  view.rerender(<WpaLeaderboardPage board={{ ...board, model: null, patch: null }} error={null} />);
  expect(screen.getByText("No win probability model yet")).toBeVisible();
  view.rerender(<WpaLeaderboardPage board={{ ...board, patch: null }} error={null} />);
  expect(screen.getByText("No scored games yet")).toBeVisible();
  view.rerender(<WpaLeaderboardPage board={null} error="Choose a board" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a board");
});
