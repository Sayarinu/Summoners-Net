import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Leaderboard } from "@summonersnet/data/contracts";
import { LeaderboardPage } from "./page";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const list: Leaderboard = {
  query: { region: "euw1", page: 1, pageSize: 2 },
  lastSuccess: "2026-03-01T12:00:00Z",
  lastAttempt: "2026-03-02T12:00:00Z",
  refreshFailed: true,
  page: {
    page: 1,
    pageSize: 2,
    total: 3,
    items: [
      {
        rank: 1,
        puuid: "a",
        gameName: "Fixture",
        tagLine: "EUW",
        tier: "CHALLENGER",
        leaguePoints: 1000,
        wins: 3,
        losses: 1,
        winRate: { value: 0.75, sampleCount: 4 },
        sampledGames: 2,
        champions: [
          { championKey: 103, championId: "Ahri", name: "Ahri", imageUrl: null, games: 2 },
        ],
      },
      {
        rank: 2,
        puuid: "b",
        gameName: null,
        tagLine: null,
        tier: "MASTER",
        leaguePoints: 0,
        wins: 0,
        losses: 0,
        winRate: { value: null, sampleCount: 0 },
        sampledGames: 0,
        champions: [],
      },
    ],
  },
};
it("shows ranks, samples, missing statistics and refresh failure without losing the ladder", () => {
  render(<LeaderboardPage list={list} error={null} region="euw1" timezone="UTC" />);
  expect(screen.getByRole("heading", { name: "EUW1 leaderboard" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Showing the previous successful ladder");
  expect(screen.getByText(/Last Refreshed/)).toHaveTextContent("03/01/2026");
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Fixture#EUW");
  expect(rows[1]).toHaveTextContent("75.0% · 4 games");
  expect(screen.getByRole("img", { name: "Ahri" })).toBeVisible();
  expect(rows[1]).toHaveTextContent("2 games");
  expect(rows[2]).toHaveTextContent("Unknown · 0 games");
  expect(rows[2]).toHaveTextContent("No sampled games");
  expect(rows[2]).toHaveTextContent("Riot ID not resolved");
  expect(screen.getByRole("link", { name: "EUW1" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
  expect(push).toHaveBeenCalledWith("/leaderboards/euw1?page=2&pageSize=2");
});
it("shows empty and invalid states and fallback champion identity", () => {
  const view = render(<LeaderboardPage list={null} error={null} region="kr" timezone="UTC" />);
  expect(screen.getByText("No Ladder Stored for This Region")).toBeVisible();
  view.rerender(<LeaderboardPage list={null} error="Invalid page" region="kr" timezone="UTC" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid page");
  view.rerender(
    <LeaderboardPage
      list={{
        ...list,
        refreshFailed: false,
        page: {
          ...list.page,
          items: [
            {
              ...list.page.items[0]!,
              champions: [
                { championKey: 999, championId: null, name: null, imageUrl: null, games: 1 },
              ],
            },
          ],
        },
      }}
      error={null}
      region="euw1"
      timezone="UTC"
    />,
  );
  expect(screen.getByRole("img", { name: "Champion 999" })).toBeVisible();
  expect(screen.queryByRole("status")).toBeNull();
});
