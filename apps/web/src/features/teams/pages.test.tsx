import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { TeamFinder, TeamProfile } from "./pages";
import { blue, profile, page, match, instant } from "../../../tests/fixtures";

it("links finder cards to the canonical team and offers both filters", () => {
  render(<TeamFinder query={{ q: "Blue" }} data={page([{ ...blue, league: "LCK" }])} />);
  expect(screen.getByRole("link", { name: /Acceptance Blue/ })).toHaveAttribute(
    "href",
    "/teams/acceptance-blue",
  );
  expect(screen.getByRole("searchbox", { name: "Search Teams" })).toHaveValue("Blue");
  expect(screen.getByRole("link", { name: /Acceptance Blue/ })).toHaveTextContent("LCK");
});
it("shows the current lineup while hiding season statistics and each result until revealed", () => {
  const champions = Array.from({ length: 6 }, (_, i) => ({
    name: "Pick " + i,
    games: 3,
    wins: 1,
    resultGames: 2,
  }));
  render(
    <TeamProfile
      profile={{ ...profile, identity: blue, summary: { ...profile.summary, champions } }}
      seasons={[{ year: 2026, league: "LCK" }]}
      query={{ year: 2026 }}
      series={page([match])}
      hideSpoilers
      now={instant}
    />,
  );
  expect(screen.getByRole("heading", { name: "Current Roster" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "Pick 0" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Statistics" }));
  expect(screen.getByRole("img", { name: "Pick 0" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "Pick 5" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show All Champions" }));
  expect(screen.getByRole("img", { name: "Pick 5" })).toBeVisible();
  expect(screen.queryByRole("link", { name: /2 to 1/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.getByRole("link", { name: /2 to 1/ })).toBeVisible();
  expect(screen.getAllByRole("img", { name: "Wins 1, losses 1" })[0]).toHaveTextContent("1 – 1");
  expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
    "href",
    "?year=2026&view=games",
  );
});
