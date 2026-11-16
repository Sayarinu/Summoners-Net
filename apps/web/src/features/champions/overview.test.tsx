import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChampionOverview } from "@summonersnet/data/contracts";
import { ChampionOverviewPage } from "./overview";

const overview: ChampionOverview = {
  query: { champion: "Ahri", source: "solo", role: "MIDDLE" },
  champion: { id: "Ahri", key: 103, name: "Ahri", imageUrl: null },
  patch: "16.22",
  sliceGames: 200,
  games: 40,
  winRate: { value: 0.55, sampleCount: 40, lower: 0.4, upper: 0.69 },
  pickRate: { value: 0.2, sampleCount: 200 },
  banRate: { value: null, sampleCount: 0 },
  shrunkWinRate: { value: 0.52, sampleCount: 40 },
  baseline: 0.5,
  tier: "A",
  trend: [
    { patch: "16.21", games: 0, winRate: { value: null, sampleCount: 0 } },
    { patch: "16.22", games: 40, winRate: { value: 0.55, sampleCount: 40 } },
  ],
  facets: { patches: ["16.22"], regions: ["europe"], tiers: ["CHALLENGER"] },
};
it("shows rates with samples, the interval, the tier and its basis, and the trend", () => {
  render(<ChampionOverviewPage overview={overview} error={null} />);
  expect(screen.getByRole("heading", { name: "Ahri" })).toBeVisible();
  expect(screen.getByText("Solo queue · Mid")).toBeVisible();
  const stats = screen.getByRole("region", { name: "Champion statistics" });
  expect(stats).toHaveTextContent("TierA");
  expect(stats).toHaveTextContent("Win rate · 40 results55.0%");
  expect(stats).toHaveTextContent("40.0–69.0%");
  expect(stats).toHaveTextContent("Ban rate · 0 gamesUnknown");
  expect(stats).toHaveTextContent(
    "average of this selection, the win rate is 52.0%, above average",
  );
  expect(screen.getAllByText("Ahri win rate by patch")[0]).toBeInTheDocument();
});
it("explains an unknown tier, shows an empty state without data, and shows filter errors", () => {
  const view = render(
    <ChampionOverviewPage
      overview={{ ...overview, tier: null, shrunkWinRate: { value: null, sampleCount: 0 } }}
      error={null}
    />,
  );
  expect(screen.getByText(/The tier is unknown until/)).toBeVisible();
  view.rerender(<ChampionOverviewPage overview={{ ...overview, patch: null }} error={null} />);
  expect(screen.getByText("No statistics for this selection")).toBeVisible();
  view.rerender(<ChampionOverviewPage overview={overview} error="Choose filters from the lists" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Choose filters from the lists");
});
