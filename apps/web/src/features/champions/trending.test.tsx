import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ProportionTrend, TrendingChampions } from "@summonersnet/data/contracts";
import { TrendingPage } from "./trending";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const up: ProportionTrend = {
  current: { value: 0.8, sampleCount: 100 },
  previous: { value: 0.4, sampleCount: 100 },
  delta: 0.4,
  z: 5.7735,
  direction: "rising",
  reason: "significant",
};
const missing: ProportionTrend = {
  current: { value: null, sampleCount: 0 },
  previous: { value: 0.5, sampleCount: 100 },
  delta: null,
  z: null,
  direction: null,
  reason: "missing",
};
const row = {
  championKey: 103,
  championId: "Ahri",
  name: "Ahri",
  imageUrl: null,
  role: "MIDDLE" as const,
  pickRate: up,
  winRate: {
    ...up,
    current: up.previous,
    previous: up.current,
    delta: -0.4,
    z: -5.7735,
    direction: "falling" as const,
  },
};
const trends: TrendingChampions = {
  query: { source: "solo", role: "MIDDLE", page: 1 },
  patch: "16.22",
  previousPatch: "16.21",
  currentGames: 1000,
  previousGames: 1000,
  patches: ["16.22", "16.21"],
  page: {
    page: 1,
    pageSize: 50,
    total: 51,
    items: [
      row,
      {
        ...row,
        championKey: 999,
        championId: null,
        name: null,
        pickRate: missing,
        winRate: { ...up, direction: null, reason: "small-sample" },
      },
    ],
  },
};
it("shows both samples, signed changes and qualified directions, preserving filters on pagination", async () => {
  render(<TrendingPage trends={trends} error={null} />);
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Current: 80.0% · n=100");
  expect(rows[1]).toHaveTextContent("Previous: 40.0% · n=100");
  expect(rows[1]).toHaveTextContent("+40.0 pp · Rising");
  expect(rows[1]).toHaveTextContent("-40.0 pp · Falling");
  expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute(
    "href",
    "/champions/Ahri?source=solo&patch=16.22&role=MIDDLE",
  );
  expect(within(rows[2]!).getByRole("img", { name: "Champion 999" })).toBeVisible();
  expect(rows[2]).toHaveTextContent("Unknown change · Comparison unavailable");
  expect(rows[2]).toHaveTextContent("Too Few Games");
  fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
  expect(push).toHaveBeenLastCalledWith("/trending?source=solo&patch=16.22&role=MIDDLE&page=2");
  fireEvent.click(screen.getByText("How a Trend Qualifies"));
  expect(await screen.findByText(/Both patches need at least 50/)).toBeVisible();
});
it("explains missing preceding patches, sparse outcomes, neutral deltas and empty selections", () => {
  const view = render(
    <TrendingPage trends={{ ...trends, previousPatch: null, previousGames: 0 }} error={null} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("No preceding catalog patch");
  view.rerender(
    <TrendingPage
      trends={{
        ...trends,
        query: { source: "pro", patch: "16.22", role: "ALL", page: 1 },
        previousGames: 0,
        page: {
          ...trends.page,
          items: [
            {
              ...row,
              name: null,
              pickRate: { ...up, delta: 0, direction: null, reason: "not-significant" },
              winRate: { ...up, direction: null, reason: "sparse-outcomes" },
            },
          ],
        },
      }}
      error={null}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("No aggregate sample");
  expect(screen.getByText("0.0 pp · No significant signal")).toBeVisible();
  expect(screen.getByText(/Too few successes or failures/)).toBeVisible();
  expect(screen.getByRole("button", { name: /Pro.*Source/ })).toBeVisible();
  view.rerender(<TrendingPage trends={null} error={null} />);
  expect(screen.getByText("No Champion Aggregates for This Selection")).toBeVisible();
  view.rerender(<TrendingPage trends={null} error="Invalid selection" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid selection");
});
