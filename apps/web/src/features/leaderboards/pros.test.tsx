import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ProFeed } from "@summonersnet/data/contracts";
import { ProFeedPage } from "./pros";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const player = {
  id: "oracle:player:1",
  source: "oracle" as const,
  sourceId: "1",
  kind: "player" as const,
  name: "Pro player",
  imageUrl: null,
  country: null,
  role: null,
  publicSlug: "pro-player",
};
const team = {
  ...player,
  id: "oracle:team:1",
  kind: "team" as const,
  name: "Pro team",
  publicSlug: "pro-team",
};
const row = {
  matchId: "EUW1_1",
  participantId: 1,
  puuid: "a",
  sourceIdentityId: player.id,
  player,
  team,
  league: "LCK",
  proObservedAt: "2026-03-01T01:00:00Z",
  championKey: 103,
  championId: "Ahri",
  championName: "Ahri",
  imageUrl: null,
  win: true,
  occurredAt: "2026-03-02T01:00:00Z",
};
const feed: ProFeed = {
  query: { page: 1, pageSize: 2 },
  page: {
    page: 1,
    pageSize: 2,
    total: 3,
    items: [
      row,
      {
        ...row,
        participantId: 2,
        puuid: "b",
        team: null,
        league: null,
        proObservedAt: null,
        championKey: 999,
        championId: null,
        championName: null,
        win: null,
      },
    ],
  },
  teams: [{ id: team.id, name: team.name }],
  leagues: ["LCK"],
};
it("shows linked identities, source observations and unknown values, and preserves filters on page changes", () => {
  render(
    <ProFeedPage
      feed={{ ...feed, query: { ...feed.query, league: "LCK" } }}
      error={null}
      timezone="UTC"
    />,
  );
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Pro player");
  expect(rows[1]).toHaveTextContent("Pro team");
  expect(rows[1]).toHaveTextContent("Ahri");
  expect(rows[1]).toHaveTextContent("Win");
  expect(rows[1]).toHaveTextContent("03/02/2026");
  expect(within(rows[1]!).getByRole("link", { name: "Pro player" })).toHaveAttribute(
    "href",
    "/players/pro-player",
  );
  expect(within(rows[1]!).getByRole("link", { name: "Solo queue profile" })).toHaveAttribute(
    "href",
    "/summoners/a",
  );
  expect(rows[2]).toHaveTextContent("Unknown");
  expect(rows[2]).toHaveTextContent("Champion 999");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(push).toHaveBeenLastCalledWith("/leaderboards/pros?league=LCK&page=2&pageSize=2");
});
it("resets pagination when selecting and clearing SQL filters", () => {
  const view = render(
    <ProFeedPage feed={{ ...feed, query: { page: 3, pageSize: 2 } }} error={null} timezone="UTC" />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Team$/ }));
  fireEvent.click(screen.getByRole("option", { name: "Pro team" }));
  expect(push).toHaveBeenLastCalledWith(
    "/leaderboards/pros?team=oracle%3Ateam%3A1&page=1&pageSize=2",
  );
  fireEvent.click(screen.getByRole("button", { name: /League$/ }));
  fireEvent.click(screen.getByRole("option", { name: "LCK" }));
  expect(push).toHaveBeenLastCalledWith("/leaderboards/pros?league=LCK&page=1&pageSize=2");
  view.rerender(
    <ProFeedPage
      feed={{ ...feed, query: { ...feed.query, team: team.id, league: "LCK" } }}
      error={null}
      timezone="UTC"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Team$/ }));
  fireEvent.click(screen.getByRole("option", { name: "All teams" }));
  expect(push).toHaveBeenLastCalledWith("/leaderboards/pros?league=LCK&page=1&pageSize=2");
  fireEvent.click(screen.getByRole("button", { name: /League$/ }));
  fireEvent.click(screen.getByRole("option", { name: "All leagues" }));
  expect(push).toHaveBeenLastCalledWith(
    "/leaderboards/pros?team=oracle%3Ateam%3A1&page=1&pageSize=2",
  );
});
it("explains empty and invalid states and shows losses", () => {
  const view = render(
    <ProFeedPage
      feed={{
        ...feed,
        query: { ...feed.query, team: "missing", league: "Missing" },
        page: { ...feed.page, total: 0, items: [] },
      }}
      error={null}
      timezone="UTC"
    />,
  );
  expect(screen.getByText("No linked solo queue games")).toBeVisible();
  expect(screen.getByRole("link", { name: "Sources" })).toHaveAttribute("href", "/sources");
  view.rerender(<ProFeedPage feed={null} error="Invalid filters" timezone="UTC" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid filters");
  view.rerender(
    <ProFeedPage
      feed={{ ...feed, page: { ...feed.page, items: [{ ...row, win: false }] } }}
      error={null}
      timezone="UTC"
    />,
  );
  expect(screen.getByText("Loss")).toBeVisible();
  view.rerender(<ProFeedPage feed={null} error={null} timezone="UTC" />);
  expect(screen.queryByRole("table")).toBeNull();
});
