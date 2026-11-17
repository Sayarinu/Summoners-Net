import { expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  championMatchupsQuerySchema,
  counterPickListQuerySchema,
  matchupMatrixQuerySchema,
  matchupMetrics,
  type ChampionBlindability,
  type ChampionMatchups,
  type CounterPickList,
  type MatchupMatrix,
  type MatchupEstimate,
  type MatchupMetric,
} from "@summonersnet/data/contracts";
import { ChampionMatchupsPage, CounterPickListPage, MatchupMatrixPage } from "./pages";
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
  expect(table).toHaveTextContent("Team First Blood");
  expect(within(table).getByRole("img", { name: "Champion 999" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Nunu & Willump" })).toHaveAttribute(
    "href",
    "/champions/Nunu/matchups?source=solo&value=shrunk&patch=16.22&role=MIDDLE",
  );
  expect(
    within(screen.getByRole("table", { name: "Unpairable Roles" })).getByRole("img", {
      name: "Unknown Role",
    }),
  ).toBeVisible();
  rerender(
    <ChampionMatchupsPage
      matchups={{ ...matchups, query: { ...matchups.query, value: "raw", source: "pro" } }}
      error={null}
    />,
  );
  expect(table).toHaveTextContent("80.0% · n=10");
  expect(table).toHaveTextContent("+100.0 · n=10");
});
const scored: ChampionBlindability = {
  games: 158,
  sampledOpponents: 4,
  coveredOpponents: 3,
  coveredPicks: 100,
  rolePicks: 160,
  coverage: 0.625,
  expected: 0.515,
  worstCase: 0.45,
  worstOpponent: nunu,
  variance: 0.001525,
  lowerTail: 0.45,
  score: 0.45,
  reason: null,
  counterWinRate: 0.55,
  counterOpponents: 1,
  counterPicks: 50,
  counterReason: null,
  counterDifference: 0.035,
  builtAt: "2026-11-16T12:00:00.000Z",
};
it("shows the blindability score, its coverage and the method with the formula", () => {
  const { rerender } = render(
    <ChampionMatchupsPage matchups={matchups} blindability={scored} error={null} />,
  );
  const stats = screen.getByLabelText("Blindability Statistics");
  expect(stats).toHaveTextContent("Blindability score45.0%");
  expect(stats).toHaveTextContent("Pick-weighted win rate51.5%");
  expect(stats).toHaveTextContent("Counter-pick worst case45.0% · against Nunu & Willump");
  expect(stats).toHaveTextContent("Lower-tail win rate (20% of picks)45.0%");
  expect(stats).toHaveTextContent("Variance0.0015");
  expect(stats).toHaveTextContent("Covered pick share62.5% · 100 of 160 opponent picks");
  expect(screen.getByText(/3 of 4 sampled opponents meet the minimum/)).toBeVisible();
  expect(screen.getByText("How Blindability Is Calculated")).toBeVisible();
  expect(screen.getByText(/E = Σ wᵢ·pᵢ \/ Σ wᵢ/)).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  const counter = screen.getByLabelText("Counter-Pick Statistics");
  expect(counter).toHaveTextContent("Blind win rate51.5%");
  expect(counter).toHaveTextContent("Counter-pick win rate55.0%");
  expect(counter).toHaveTextContent("Counter-pick value+3.5 pts");
  expect(counter).toHaveTextContent("Best response to1 opponent · 50 of 160 opponent picks");
  expect(screen.getByRole("link", { name: "Compare the Role" })).toHaveAttribute(
    "href",
    "/matchups/MIDDLE/counter-picks?source=solo&patch=16.22",
  );
  rerender(
    <ChampionMatchupsPage
      matchups={matchups}
      blindability={{
        ...scored,
        rolePicks: 220,
        coverage: 100 / 220,
        expected: null,
        worstCase: null,
        worstOpponent: null,
        variance: null,
        lowerTail: null,
        score: null,
        reason: "low-coverage",
        counterWinRate: null,
        counterDifference: null,
        counterReason: "blind-unavailable",
      }}
      error={null}
    />,
  );
  expect(screen.getByLabelText("Blindability Statistics")).toHaveTextContent(
    "Blindability scoreUnknown",
  );
  expect(screen.getByText(/Counter-pick value unavailable/)).toHaveTextContent(
    "nothing to compare with",
  );
  expect(screen.getByText(/^Score unavailable/)).toHaveTextContent(
    "Score unavailable: Opponents with at least 10 win-rate observations cover less than 50% of opponent picks.",
  );
  rerender(<ChampionMatchupsPage matchups={matchups} blindability={null} error={null} />);
  expect(screen.getByText(/No stored blindability score/)).toBeVisible();
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
  const svg = screen.getByRole("img", { name: "Mid matchups: Win Rate (%) · shrunk" });
  expect(svg).toHaveTextContent("Ahri, Nunu & Willump: 55; samples: 10");
  expect(svg.querySelectorAll("rect")[1]).toHaveAttribute("fill-opacity", "0");
  expect(svg).toHaveTextContent("Ahri, Champion 999: Unknown; samples: 9");
  fireEvent.click(screen.getByText("View data for Mid matchups: Win Rate (%) · shrunk"));
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
it("lists a role's counter-pick values with unknown reasons and validation errors", () => {
  const list: CounterPickList = {
    query: counterPickListQuerySchema.parse({ role: "MIDDLE" }),
    patch: "16.22",
    patches: ["16.22"],
    page: {
      page: 1,
      pageSize: 25,
      total: 2,
      items: [
        {
          champion: ahri,
          games: 32,
          coveredPicks: 30,
          rolePicks: 32,
          coverage: 30 / 32,
          blind: 0.48,
          counter: 0.55,
          difference: 0.07,
          score: 0.45,
          counterOpponents: 2,
          counterPicks: 20,
          reason: null,
          counterReason: null,
        },
        {
          champion: unknown,
          games: 2,
          coveredPicks: 0,
          rolePicks: 60,
          coverage: 0,
          blind: null,
          counter: null,
          difference: null,
          score: null,
          counterOpponents: 0,
          counterPicks: 0,
          reason: "few-opponents",
          counterReason: "blind-unavailable",
        },
      ],
    },
  };
  const { rerender } = render(<CounterPickListPage list={list} error={null} role="MIDDLE" />);
  expect(screen.getByRole("heading", { name: "Mid counter-pick values" })).toBeVisible();
  const table = screen.getByRole("table", { name: "Mid counter-pick values" });
  expect(table).toHaveTextContent("+7.0 pts");
  expect(table).toHaveTextContent("93.8% · 30 of 32 picks");
  expect(table).toHaveTextContent("Fewer than 3 opponents");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&value=shrunk&patch=16.22&role=MIDDLE",
  );
  rerender(<CounterPickListPage list={null} error="Choose a sort" role="TOP" />);
  expect(screen.getByRole("heading", { name: "Top counter-pick values" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a sort");
});
