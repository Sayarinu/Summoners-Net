import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  championMatchupsQuerySchema,
  matchupMatrixQuerySchema,
  matchupMetrics,
  type ChampionMatchups,
  type MatchupMatrix,
  type MatchupEstimate,
  type MatchupMetric,
} from "@summonersnet/data/contracts";
import { ChampionMatchupsPage, MatchupMatrixPage } from "./pages";
const ahri = { championKey: 103, championId: "Ahri", name: "Ahri", imageUrl: null };
const nunu = { championKey: 20, championId: "Nunu", name: "Nunu & Willump", imageUrl: null };
const unknown = { championKey: 999, championId: null, name: null, imageUrl: null };
const estimate: MatchupEstimate = {
  raw: 0.8,
  shrunk: 0.55,
  sampleCount: 10,
  baseline: 0.5,
  baselineSampleCount: 20,
};
const metricValues = Object.fromEntries(matchupMetrics.map((m) => [m, estimate])) as Record<
  MatchupMetric,
  MatchupEstimate
>;
const matchups: ChampionMatchups = {
  query: championMatchupsQuerySchema.parse({ champion: "Ahri" }),
  champion: ahri,
  patch: "16.22",
  patches: ["16.22"],
  page: {
    page: 1,
    pageSize: 25,
    total: 2,
    items: [
      {
        opponent: nunu,
        games: 10,
        metrics: {
          ...metricValues,
          gold10: { ...estimate, raw: 100, shrunk: 37.5 },
          gold15: { ...estimate, raw: -50, shrunk: -20 },
          cs10: { ...estimate, raw: null, shrunk: null, sampleCount: 9 },
        },
      },
      {
        opponent: unknown,
        games: 1,
        metrics: Object.fromEntries(
          matchupMetrics.map((m) => [m, { ...estimate, raw: null, shrunk: null, sampleCount: 1 }]),
        ) as Record<MatchupMetric, MatchupEstimate>,
      },
    ],
  },
  exclusions: [
    {
      role: "UNKNOWN",
      games: 2,
      participants: 3,
      unknownRole: 3,
      ambiguousRole: 0,
      missingOpponent: 0,
      unmappedChampion: 0,
    },
  ],
};
it("shows shrunk estimates, independent samples and team labels with raw values available", () => {
  const { rerender } = render(<ChampionMatchupsPage matchups={matchups} error={null} />);
  expect(screen.getByRole("heading", { name: "Ahri matchups" })).toBeVisible();
  const table = screen.getByRole("table", { name: "Ahri lane opponents" });
  expect(table).toHaveTextContent("55.0% · n=10");
  expect(table).toHaveTextContent("+37.5 · n=10");
  expect(table).toHaveTextContent("-20.0 · n=10");
  expect(table).toHaveTextContent("Unknown · n=9");
  expect(table).toHaveTextContent("Team first blood");
  expect(table).toHaveTextContent("Champion 999");
  expect(screen.getByRole("link", { name: "Nunu & Willump" })).toHaveAttribute(
    "href",
    "/champions/Nunu/matchups?source=solo&value=shrunk&patch=16.22&role=MIDDLE",
  );
  expect(screen.getByRole("table", { name: "Unpairable roles" })).toHaveTextContent("Unknown role");
  rerender(
    <ChampionMatchupsPage
      matchups={{ ...matchups, query: { ...matchups.query, value: "raw", source: "pro" } }}
      error={null}
    />,
  );
  expect(table).toHaveTextContent("80.0% · n=10");
  expect(table).toHaveTextContent("+100.0 · n=10");
  expect(screen.getByText(/First blood and first tower describe team outcomes/)).toBeVisible();
});
it("explains empty selections and renders validation errors without data", () => {
  const { rerender } = render(
    <ChampionMatchupsPage
      matchups={{
        ...matchups,
        patch: null,
        patches: [],
        page: { ...matchups.page, total: 0, items: [] },
        exclusions: [],
      }}
      error={null}
    />,
  );
  expect(screen.getByText(/No matchup observations/)).toBeVisible();
  rerender(<ChampionMatchupsPage matchups={null} error="Invalid selection" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid selection");
  rerender(<MatchupMatrixPage matrix={null} error="Invalid matrix" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid matrix");
});
it("keeps sparse matrix cells blank with sample tooltips and a readable table", () => {
  const matrix: MatchupMatrix = {
    query: matchupMatrixQuerySchema.parse({ role: "MIDDLE" }),
    patch: "16.22",
    patches: ["16.22"],
    total: 2,
    pageSize: 8,
    rows: [ahri],
    columns: [nunu, unknown],
    cells: [
      { championKey: 103, opponentKey: 20, games: 10, estimate },
      {
        championKey: 103,
        opponentKey: 999,
        games: 9,
        estimate: { ...estimate, raw: null, shrunk: null, sampleCount: 9 },
      },
    ],
  };
  const { rerender } = render(<MatchupMatrixPage matrix={matrix} error={null} />);
  const svg = screen.getByRole("img", { name: "Mid matchups: Win rate (%) · shrunk" });
  expect(svg).toHaveTextContent("Ahri, Nunu & Willump: 55; samples: 10");
  expect(svg.querySelectorAll("rect")[1]).toHaveAttribute("fill-opacity", "0");
  expect(svg).toHaveTextContent("Ahri, Champion 999: Unknown; samples: 9");
  fireEvent.click(screen.getByText("View data for Mid matchups: Win rate (%) · shrunk"));
  expect(screen.getByRole("row", { name: "Ahri Champion 999 Unknown 9" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Ahri matchups" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&value=shrunk&patch=16.22&role=MIDDLE",
  );
  rerender(
    <MatchupMatrixPage
      matrix={{ ...matrix, query: { ...matrix.query, metric: "gold10", value: "raw" } }}
      error={null}
    />,
  );
  expect(screen.getByRole("img", { name: "Mid matchups: Gold Δ at 10 · raw" })).toHaveTextContent(
    "Ahri, Nunu & Willump: 0.8; samples: 10",
  );
  rerender(
    <MatchupMatrixPage
      matrix={{ ...matrix, patch: null, rows: [], columns: [], cells: [] }}
      error={null}
    />,
  );
  expect(screen.getByText("No observations available")).toBeVisible();
});
