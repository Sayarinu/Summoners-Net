import { it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { TierList } from "@summonersnet/data/contracts";
import { TierListPage } from "./tier-list";
import { percent } from "./presentation";

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
  minimumGames: 10,
  hiddenChampions: 3,
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
        tier: "A",
        performance: {
          kda: { value: 3.5, sampleCount: 60 },
          damagePerMinute: { value: 702.4, sampleCount: 60 },
          goldDiffAt15: { value: null, sampleCount: 0 },
        },
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
        tier: null,
        performance: {
          kda: { value: null, sampleCount: 0 },
          damagePerMinute: { value: null, sampleCount: 0 },
          goldDiffAt15: { value: null, sampleCount: 0 },
        },
      },
    ],
  },
};
it("shows rates without intervals, counts left-out champions, and never shows unknown as zero", () => {
  const view = render(<TierListPage list={list} error={null} />);
  const table = screen.getByRole("table", { name: "Champion Tier List" });
  const [ahri, unknown] = within(table).getAllByRole("row").slice(1);
  expect(within(ahri!).getByRole("img", { name: "Ahri" })).toBeVisible();
  expect(ahri).toHaveTextContent("A6055.0%50.0%10.0%3.50702");
  expect(table).not.toHaveTextContent("42.0–67.0%");
  expect(screen.queryByRole("columnheader", { name: /Interval|Sample/ })).toBeNull();
  expect(within(unknown!).getByRole("img", { name: "Champion 950" })).toBeVisible();
  expect(unknown).toHaveTextContent("—0Unknown");
  expect(unknown).toHaveTextContent("0.0%");
  expect(
    screen.getByText(/2 champions · Page 1 · 3 with fewer than 10 games not listed/),
  ).toBeVisible();
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
  // Pro play is sliced by league, with no ranked tier.
  const known = (value: number) => ({ value, sampleCount: 12 });
  const missing = { value: null, sampleCount: 0 };
  view.rerender(
    <TierListPage
      list={{
        ...list,
        query: { ...list.query, source: "pro" },
        page: {
          ...list.page,
          items: [
            {
              ...list.page.items[0]!,
              performance: {
                kda: known(4.25),
                damagePerMinute: known(612.4),
                goldDiffAt15: known(310),
              },
            },
            {
              ...list.page.items[1]!,
              performance: { kda: missing, damagePerMinute: missing, goldDiffAt15: missing },
            },
          ],
        },
      }}
      error={null}
    />,
  );
  const [proAhri, proUnknown] = within(screen.getByRole("table", { name: "Champion Tier List" }))
    .getAllByRole("row")
    .slice(1);
  expect(proAhri).toHaveTextContent("4.25612+310");
  expect(proUnknown).toHaveTextContent("UnknownUnknownUnknown");
  expect(trigger("League")).toHaveTextContent("All");
  expect(trigger("Tier")).toBeUndefined();
  // Pro play's tier is its split, with the stage beside it.
  expect(trigger("Split")).toHaveTextContent("CHALLENGER");
  expect(trigger("Stage")).toHaveTextContent("All Stages");
  expect(trigger("Region")).toBeUndefined();
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
it("formats rates", () => {
  expect(percent({ value: null, sampleCount: 0 })).toBe("Unknown");
  expect(percent({ value: 0, sampleCount: 5 })).toBe("0.0%");
});
