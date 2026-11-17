import { it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { TierList } from "@summonersnet/data/contracts";
import { TierListPage } from "./tier-list";
import { interval, percent } from "./presentation";

afterEach(() => vi.unstubAllGlobals());
const list: TierList = {
  query: {
    source: "solo",
    role: "ALL",
    sort: "winRate",
    order: "desc",
    page: 1,
    tier: "CHALLENGER",
  },
  patch: "16.22",
  sliceGames: 120,
  facets: { patches: ["16.22", "16.21"], regions: ["europe"], tiers: ["CHALLENGER", "MASTER"] },
  page: {
    page: 1,
    pageSize: 50,
    total: 2,
    items: [
      {
        championKey: 103,
        championId: "Ahri",
        name: "Ahri",
        imageUrl: null,
        role: "ALL",
        games: 60,
        wins: 33,
        winRate: { value: 0.55, sampleCount: 60, lower: 0.42, upper: 0.67 },
        pickRate: { value: 0.5, sampleCount: 120 },
        banRate: { value: 0.1, sampleCount: 120 },
        sample: "shown",
      },
      {
        championKey: 950,
        championId: null,
        name: null,
        imageUrl: null,
        role: "ALL",
        games: 0,
        wins: 0,
        winRate: { value: null, sampleCount: 0, lower: null, upper: null },
        pickRate: { value: 0, sampleCount: 120 },
        banRate: { value: null, sampleCount: 0 },
        sample: "hidden",
      },
    ],
  },
};
it("shows rates, intervals and samples, with unknown values never shown as zero", () => {
  render(<TierListPage list={list} error={null} />);
  const table = screen.getByRole("table", { name: "Champion Tier List" });
  const [ahri, unknown] = within(table).getAllByRole("row").slice(1);
  expect(within(ahri!).getByRole("img", { name: "Ahri" })).toBeVisible();
  expect(ahri).toHaveTextContent("6055.0%42.0–67.0%50.0%10.0%60 results");
  expect(within(unknown!).getByRole("img", { name: "Champion 950" })).toBeVisible();
  expect(unknown).toHaveTextContent("0Unknown");
  expect(unknown).toHaveTextContent("0.0%");
  expect(unknown).toHaveTextContent("Too Few Games");
  const trigger = (label: string) =>
    screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.getAttribute("aria-labelledby")?.length &&
          b.textContent &&
          b.closest(".np-select")?.textContent?.startsWith(label),
      );
  expect(trigger("Tier")).toHaveTextContent("CHALLENGER");
  expect(trigger("Sort By")).toHaveTextContent("Win Rate");
  expect(trigger("Region")).toHaveTextContent("All");
  expect(screen.getByText(/Patch 16.22 · 120 games/)).toBeVisible();
});
it("shows an empty state without data and an error for an invalid query", () => {
  const view = render(
    <TierListPage
      list={{ ...list, patch: null, facets: { patches: [], regions: [], tiers: [] } }}
      error={null}
    />,
  );
  expect(screen.getByText("No Champion Statistics Yet")).toBeVisible();
  view.rerender(<TierListPage list={null} error="Choose filters from the lists" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose filters from the lists");
});
it("formats rates and intervals", () => {
  expect(percent({ value: null, sampleCount: 0 })).toBe("Unknown");
  expect(percent({ value: 0, sampleCount: 5 })).toBe("0.0%");
  expect(interval({ lower: null, upper: 0.2 })).toBe("Unknown");
});
