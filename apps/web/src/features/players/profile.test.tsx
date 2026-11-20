import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PlayerProfile } from "./profile";
import { blue, game, page, performance, profile } from "../../../tests/fixtures";

it("hides season statistics, champions and each game result until revealed", () => {
  const champions = Array.from({ length: 6 }, (_, i) => ({
    name: "Pick " + i,
    games: 3,
    wins: 1,
    resultGames: 2,
  }));
  render(
    <PlayerProfile
      profile={{ ...profile, summary: { ...profile.summary, champions } }}
      performance={performance}
      seasons={[{ year: 2026, league: "LCK" }]}
      query={{ year: 2026, timezone: "UTC" }}
      hideSpoilers
    />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Player Blue mid");
  expect(screen.getAllByRole("link", { name: /Acceptance Blue/ })[0]).toHaveAttribute(
    "href",
    "/teams/acceptance-blue",
  );
  expect(screen.getByRole("searchbox", { name: "Filter Matches" })).toBeVisible();
  expect(screen.getByText("Season")).toBeVisible();
  expect(screen.queryByText("100.0%")).toBeNull();
  expect(screen.queryByRole("img", { name: "Pick 0" })).toBeNull();
  expect(screen.queryByText("5 / 2 / 7")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Reveal result for game 1/ }));
  expect(screen.getByText("5 / 2 / 7")).toBeVisible();
  expect(screen.getByText("Win")).toBeVisible();
  expect(screen.queryByText("100.0%")).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Reveal Statistics" })[0]!);
  expect(screen.queryByRole("button", { name: "Reveal Statistics" })).toBeNull();
  expect(screen.getByText("100.0%")).toBeVisible();
  expect(screen.getByRole("img", { name: "Pick 0" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "Pick 5" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show All Champions" }));
  expect(screen.getByRole("img", { name: "Pick 5" })).toBeVisible();
});

it("formats every statistic and keeps missing values and partial samples explicit", () => {
  render(
    <PlayerProfile
      profile={profile}
      performance={performance}
      seasons={[]}
      query={{}}
      hideSpoilers={false}
    />,
  );
  // Each figure is a term and its value; a partial sample is noted under the term.
  const stat = (label: string) => {
    const term = screen.getAllByRole("term").find((dt) => dt.firstChild?.textContent === label);
    if (!term) throw new Error(`No statistic labelled ${label}`);
    return { value: term.nextElementSibling, sample: term.querySelector("small") };
  };
  expect(stat("Game Record").value).toHaveTextContent("1 – 01 unknown result");
  expect(stat("KDA").value).toHaveTextContent("6.00");
  expect(stat("KDA").sample).toHaveTextContent("1 game");
  expect(stat("Kill Participation").value).toHaveTextContent("75.0%");
  expect(stat("Average Kills").value).toHaveTextContent("5.0");
  expect(stat("Pentakills").value).toHaveTextContent("1");
  expect(stat("CS per Minute").value).toHaveTextContent("8.5");
  expect(stat("Gold per Minute").value).toHaveTextContent("412");
  expect(stat("Gold Share").value).toHaveTextContent("23.1%");
  expect(stat("Damage per Minute").value).toHaveTextContent("613");
  expect(stat("Vision Score per Minute").value).toHaveTextContent("1.23");
  expect(stat("Gold Diff at 15").value).toHaveTextContent("-123");
  expect(stat("Gold Diff at 15").sample).toHaveTextContent("1 game");
  expect(stat("CS Diff at 15").value).toHaveTextContent("+8");
  expect(stat("CS Diff at 15").sample).toBeNull();
  expect(stat("XP Diff at 15").value).toHaveTextContent("—");
  expect(stat("XP Diff at 15").sample).toHaveTextContent("0 games");
  expect(stat("First Blood Victim").value).toHaveTextContent("0.0%");
  const row = screen.getByRole("link", { name: /Game 1: Acceptance Blue versus Acceptance Red/ });
  expect(row).toHaveAttribute("href", `/games/${encodeURIComponent(game.id)}`);
  expect(within(row.closest("article")!).getByText("LCK · Game 1")).toBeVisible();
});

it("explains empty selections and players without a current team", () => {
  render(
    <PlayerProfile
      profile={{
        ...profile,
        roster: [],
        games: page([]),
        summary: { ...profile.summary, eligibleGames: 0, champions: [] },
      }}
      performance={{ ...performance, games: 0 }}
      seasons={[{ year: 2025, league: "LEC" }]}
      query={{}}
      hideSpoilers={false}
    />,
  );
  expect(screen.queryByRole("link", { name: new RegExp(blue.name) })).toBeNull();
  expect(screen.getByText("LEC", { selector: ".np-meta" })).toBeVisible();
  expect(screen.getAllByText("No eligible games in this selection.")).toHaveLength(3);
  expect(screen.getByText("No games match these filters.")).toBeVisible();
  expect(screen.queryByText("Champion Pool")).toBeNull();
});
