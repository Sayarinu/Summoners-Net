import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchPage, GamePage, ProfilePage } from "./pages";
import { match, game, profile, blue, instant, page } from "../../../tests/fixtures";
it("prioritizes match identity and consented watching while retaining source game context", () => {
  const view = render(<MatchPage match={match} timezone="UTC" hideSpoilers now={instant} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Acceptance Blue vs Acceptance Red",
  );
  expect(screen.getByText("Source game context")).toBeVisible();
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.queryByText("Hidden")).toBeNull();
  view.rerender(
    <MatchPage
      match={{ ...match, teams: [], games: [] }}
      timezone="UTC"
      hideSpoilers={false}
      now={instant}
    />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(match.name);
});
it("shows played lineups with null statistics and explicit partial eligibility", () => {
  const view = render(<GamePage game={game} timezone="UTC" hideSpoilers />);
  expect(screen.getAllByText("Hidden")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Reveal game statistics" }));
  expect(screen.getByText("5 / 2 / 7")).toBeVisible();
  expect(screen.getByText("— / — / —")).toBeVisible();
  expect(screen.getByText("Unknown")).toBeVisible();
  view.rerender(
    <GamePage
      game={{
        ...game,
        complete: false,
        patch: null,
        matchId: "match",
        participants: [
          { ...game.participants[0]!, won: false },
          { ...game.participants[1]!, player: null },
        ],
      }}
      timezone="UTC"
      hideSpoilers={false}
    />,
  );
  expect(screen.getByText(/Partial record/)).toBeVisible();
  expect(screen.getByText("Loss")).toBeVisible();
});
it("separates roster observations, filtered game pages and full-sample summaries", () => {
  const view = render(<ProfilePage profile={profile} query={{ timezone: "UTC" }} hideSpoilers />);
  expect(screen.getByText("Latest roster observation")).toBeVisible();
  expect(screen.queryByText("100.0%")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal summary statistics" }));
  expect(screen.getByText("100.0%")).toBeVisible();
  expect(screen.getByText("6.00")).toBeVisible();
  expect(screen.getByText("Champion usage")).toBeVisible();
  view.rerender(
    <ProfilePage
      profile={{
        ...profile,
        identity: blue,
        roster: [],
        games: page([]),
        summary: {
          ...profile.summary,
          winRate: null,
          kda: null,
          champions: [],
        },
      }}
      query={{}}
      hideSpoilers={false}
    />,
  );
  expect(screen.getByText("No current roster observation")).toBeVisible();
  expect(screen.getAllByText("—")).toHaveLength(2);
});
