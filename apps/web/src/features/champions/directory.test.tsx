import { expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChampionsPage } from "./directory";
import { PatchesPage } from "../patches/directory";
import { LeaderboardsPage } from "../leaderboards/hub";

it("shows catalog champions as cards, filters them by name and links every role matchup page", () => {
  const view = render(
    <ChampionsPage
      directory={{
        patch: "16.22",
        champions: [
          { championKey: 103, championId: "Ahri", name: "Ahri", imageUrl: null },
          { championKey: 20, championId: "Nunu", name: "Nunu & Willump", imageUrl: null },
        ],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Champions", level: 1 })).toBeVisible();
  expect(screen.getByRole("link", { name: "Nunu & Willump" })).toHaveAttribute(
    "href",
    "/champions/Nunu",
  );
  expect(screen.getByRole("link", { name: "Draft Assistant" })).toHaveAttribute(
    "href",
    "/drafts/assistant",
  );
  expect(screen.getByRole("link", { name: "Support Counter-Pick Values" })).toHaveAttribute(
    "href",
    "/matchups/UTILITY/counter-picks",
  );
  expect(screen.getByRole("link", { name: "Mid Matchup Matrix" })).toHaveAttribute(
    "href",
    "/matchups/MIDDLE",
  );
  const views = screen.getByRole("navigation", { name: "Champion Views" });
  expect(within(views).getByRole("link", { current: "page" })).toHaveTextContent("Champions");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search Champions" }), {
    target: { value: "nunu" },
  });
  const grid = screen.getByRole("list", { name: "Champions in the Catalog" });
  expect(within(grid).getAllByRole("link")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search Champions" }), {
    target: { value: "zed" },
  });
  expect(screen.getByText("No Champions Match This Search")).toBeVisible();
  view.rerender(<ChampionsPage directory={{ patch: null, champions: [] }} />);
  expect(screen.getByText("No Champion Catalog Yet")).toBeVisible();
});

it("lists patches with their sources and the leaderboards", () => {
  const view = render(
    <PatchesPage
      directory={{
        patches: [
          { patch: "16.22", solo: true, pro: true },
          { patch: "16.21", solo: false, pro: true },
        ],
      }}
    />,
  );
  expect(screen.getByRole("link", { name: "Patch 16.22" })).toHaveAttribute(
    "href",
    "/patches/16.22",
  );
  expect(screen.getByRole("list", { name: "Patches with Champion Statistics" })).toHaveTextContent(
    "Patch 16.21Pro",
  );
  view.rerender(<PatchesPage directory={{ patches: [] }} />);
  expect(screen.getByText("No Patch Statistics Yet")).toBeVisible();
  view.rerender(<LeaderboardsPage />);
  expect(screen.getByRole("link", { name: "Win Probability Added" })).toHaveAttribute(
    "href",
    "/leaderboards/wpa",
  );
  expect(screen.getByRole("link", { name: "EUW1" })).toHaveAttribute("href", "/leaderboards/euw1");
});
