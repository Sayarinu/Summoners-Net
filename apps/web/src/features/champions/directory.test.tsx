import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChampionsPage } from "./directory";
import { PatchesPage } from "../patches/directory";
import { LeaderboardsPage } from "../leaderboards/hub";

it("lists catalog champions and links every champion and matchup page", () => {
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
  expect(screen.getByRole("heading", { name: "Champions" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Nunu & Willump" })).toHaveAttribute(
    "href",
    "/champions/Nunu",
  );
  expect(screen.getByRole("link", { name: "Ahri lane matchups" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups",
  );
  expect(screen.getByRole("link", { name: "Draft Assistant" })).toHaveAttribute(
    "href",
    "/drafts/assistant",
  );
  expect(screen.getAllByRole("link", { name: "Counter-Pick Values" })[4]).toHaveAttribute(
    "href",
    "/matchups/UTILITY/counter-picks",
  );
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
  expect(screen.getByRole("table", { name: "Patches with Champion Statistics" })).toHaveTextContent(
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
