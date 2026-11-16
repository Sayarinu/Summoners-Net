import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { SummonerProfile } from "@summonersnet/data/contracts";
import { SummonerPage } from "./page";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const puuid = "a".repeat(78);
const profile: SummonerProfile = {
  query: { puuid, region: "euw1", page: 1, championPage: 1 },
  gameName: "Fixture",
  tagLine: "EUW",
  games: {
    page: 1,
    pageSize: 25,
    total: 26,
    items: [
      {
        matchId: "EUW1_123",
        platform: "euw1",
        occurredAt: "2026-03-01T12:00:00Z",
        patch: "16.4",
        championKey: 103,
        championName: "Ahri",
        win: null,
        kills: null,
        deaths: 2,
        assists: 3,
        durationSeconds: null,
      },
    ],
  },
  champions: {
    page: 1,
    pageSize: 25,
    total: 26,
    items: [
      {
        championKey: 103,
        championId: "Ahri",
        name: "Ahri",
        imageUrl: null,
        games: 1,
        winRate: { value: null, sampleCount: 0 },
      },
    ],
  },
  historyFrom: "2026-01-31",
  historyTo: "2026-03-01",
  history: [
    {
      platform: "euw1",
      points: [
        {
          day: "2026-02-28",
          leaguePoints: null,
          rank: null,
          tier: null,
          observedAt: null,
          sampleCount: 0,
        },
        {
          day: "2026-03-01",
          leaguePoints: 100,
          rank: 2,
          tier: "CHALLENGER",
          observedAt: "2026-03-01T10:00:00Z",
          sampleCount: 1,
        },
      ],
    },
  ],
};
it("shows stored identity, unknown statistics and gap-preserving charts with data tables", () => {
  render(<SummonerPage profile={profile} error={null} puuid={puuid} timezone="UTC" />);
  expect(screen.getByRole("heading", { name: "Fixture#EUW" })).toBeVisible();
  const games = screen.getByRole("table", { name: "Recent ranked solo games" });
  expect(games).toHaveTextContent("? / 2 / 3");
  expect(games).toHaveTextContent("Unknown");
  expect(screen.getByRole("table", { name: "Sampled champion pool" })).toHaveTextContent("Unknown");
  expect(screen.getByRole("img", { name: "EUW1 LP history" })).toBeVisible();
  fireEvent.click(screen.getByText("View data for EUW1 LP history"));
  const data = screen.getByRole("table", { name: "EUW1 LP history data" });
  expect(data).toHaveTextContent("Unknown");
  expect(data).toHaveTextContent("100");
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Recent game pages" })).getByRole("button", {
      name: "Next page",
    }),
  );
  expect(push).toHaveBeenLastCalledWith(`/summoners/${puuid}?page=2&championPage=1&region=euw1`);
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Champion pool pages" })).getByRole("button", {
      name: "Next page",
    }),
  );
  expect(push).toHaveBeenLastCalledWith(`/summoners/${puuid}?page=1&championPage=2&region=euw1`);
});
it("shows empty history, source fallbacks, known results and invalid input", () => {
  const alternate: SummonerProfile = {
    ...profile,
    gameName: null,
    tagLine: null,
    history: [],
    query: { puuid, page: 1, championPage: 1 },
    games: {
      ...profile.games,
      items: [
        {
          ...profile.games.items[0]!,
          platform: null,
          patch: null,
          championName: null,
          win: true,
          kills: 3,
          durationSeconds: 1200,
        },
        { ...profile.games.items[0]!, matchId: "EUW1_124", win: false },
      ],
    },
    champions: {
      ...profile.champions,
      items: [
        {
          ...profile.champions.items[0]!,
          name: null,
          championId: null,
          winRate: { value: 0.5, sampleCount: 2 },
        },
      ],
    },
  };
  const view = render(
    <SummonerPage profile={alternate} error={null} puuid={puuid} timezone="UTC" />,
  );
  expect(screen.getByText("No ladder snapshots in this window")).toBeVisible();
  expect(screen.getByText("50.0%")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Riot ID not resolved" })).toBeVisible();
  expect(screen.getByRole("table", { name: "Recent ranked solo games" })).toHaveTextContent("20.0");
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Recent game pages" })).getByRole("button", {
      name: "Next page",
    }),
  );
  expect(push).toHaveBeenLastCalledWith(`/summoners/${puuid}?page=2&championPage=1`);
  view.rerender(<SummonerPage profile={null} error="Invalid input" puuid={puuid} timezone="UTC" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid input");
});
