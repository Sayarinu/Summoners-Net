import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Heatmap } from "@summonersnet/data/contracts";
import { HeatmapPage } from "./page";

const base: Heatmap = {
  subjectKind: "champion",
  subject: "Ahri",
  label: "Ahri",
  kind: "death",
  patch: "16.22",
  patches: [
    { patch: "16.22", games: 12, points: 3 },
    { patch: "16.21", games: 1, points: 1 },
  ],
  games: 12,
  points: 3,
  minimumGames: 10,
  cells: [
    { cellX: 8, cellY: 8, x: 7843, y: 7902, points: 2 },
    { cellX: 0, cellY: 0, x: 348, y: 352, points: 1 },
  ],
};

it("draws a heatmap with its sample, side normalization and navigation", () => {
  const { container } = render(<HeatmapPage heatmap={base} error={null} />);
  expect(screen.getByRole("heading", { name: "Ahri: deaths" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Sample: 12 games and 3 points on patch 16.22.",
  );
  expect(screen.getByText(/Red side is rotated half a turn/)).toBeVisible();
  expect(container.querySelectorAll(".np-minimap circle")).toHaveLength(2);
  const types = screen.getByRole("navigation", { name: "Heatmap Type" });
  expect(within(types).getByRole("link", { name: "Kills" })).toHaveAttribute(
    "href",
    "/heatmaps?subjectKind=champion&subject=Ahri&kind=kill&patch=16.22",
  );
  expect(within(types).getByRole("link", { name: "Deaths" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const patches = screen.getByRole("navigation", { name: "Patch" });
  expect(within(patches).getByRole("link", { name: "16.21 (1 game)" })).toHaveAttribute(
    "href",
    "/heatmaps?subjectKind=champion&subject=Ahri&kind=death&patch=16.21",
  );
  expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
    "href",
    "/heatmaps?subjectKind=role&subject=UTILITY&kind=death&patch=16.22",
  );
});
it("reports the sample but does not draw below the minimum", () => {
  const { container } = render(
    <HeatmapPage
      heatmap={{
        ...base,
        subjectKind: "role",
        subject: "JUNGLE",
        label: null,
        games: 1,
        points: 1,
        cells: [],
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("heading", { name: "Jungle: deaths" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Sample: 1 game and 1 point");
  expect(screen.getByText("Too Few Games to Draw")).toBeVisible();
  expect(container.querySelector(".np-minimap")).toBeNull();
  expect(screen.getByRole("link", { name: "Jungle" })).toHaveAttribute("aria-current", "page");
});
it("explains missing heatmaps, unresolved players and invalid queries", () => {
  const { unmount } = render(
    <HeatmapPage
      heatmap={{
        ...base,
        subjectKind: "player",
        subject: "a".repeat(78),
        label: null,
        kind: "position",
        patch: null,
        patches: [],
        games: 0,
        points: 0,
        cells: [],
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("heading", { name: "Riot ID not resolved: positions" })).toBeVisible();
  expect(screen.getByText("No Heatmap Yet")).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Patch" })).toBeNull();
  unmount();
  render(<HeatmapPage heatmap={null} error="Choose a champion." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a champion.");
});
