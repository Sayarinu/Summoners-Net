import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  counterPickListQuerySchema,
  matchupMatrixQuerySchema,
  type CounterPickList,
  type MatchupMatrix,
  type MatchupEstimate,
} from "@summonersnet/data/contracts";
import { CounterPickListPage, MatchupMatrixPage } from "./pages";
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
it("renders the matrix's validation error without data", () => {
  render(<MatchupMatrixPage matrix={null} error="Invalid matrix" />);
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
  expect(screen.getByRole("heading", { name: "Mid Counter-Pick Values" })).toBeVisible();
  const table = screen.getByRole("table", { name: "Mid Counter-Pick Values" });
  expect(table).toHaveTextContent("+7.0 pts");
  expect(table).toHaveTextContent("93.8% · 30 of 32 picks");
  expect(table).toHaveTextContent("Fewer than 3 opponents");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups?source=solo&value=shrunk&patch=16.22&role=MIDDLE",
  );
  rerender(<CounterPickListPage list={null} error="Choose a sort" role="TOP" />);
  expect(screen.getByRole("heading", { name: "Top Counter-Pick Values" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a sort");
});
