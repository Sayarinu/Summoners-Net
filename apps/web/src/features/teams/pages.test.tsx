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
  expect(screen.queryByText("Pick 0")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal Statistics" }));
  expect(screen.getByText("Pick 0")).toBeVisible();
  expect(screen.queryByText("Pick 5")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show All Champions" }));
  expect(screen.getByText("Pick 5")).toBeVisible();
  expect(screen.queryByText("Win", { exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
  expect(screen.getByText("Win", { exact: true })).toBeVisible();
  expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
    "href",
    "?year=2026&view=games",
  );
});
