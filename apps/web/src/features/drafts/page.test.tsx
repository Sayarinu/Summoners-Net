import { render, screen, fireEvent } from "@testing-library/react";
import axe from "axe-core";
import { expect, it } from "vitest";
import type { DraftAnalytics } from "@summonersnet/data/contracts";
import { DraftsPage } from "./page";
const analytics: DraftAnalytics = {
  games: 3,
  includedGames: 2,
  excludedGames: 1,
  pendingGames: 0,
  exclusions: [{ reason: "Missing draft columns", games: 1 }],
  firstPickWinRate: { value: 0.5, sampleCount: 2 },
  firstPickSides: [
    { side: "blue", winRate: { value: 1, sampleCount: 1 } },
    { side: "red", winRate: { value: 0, sampleCount: 1 } },
  ],
  priorities: {
    page: 1,
    pageSize: 25,
    total: 1,
    items: [
      {
        champion: "Jinx",
        action: "pick",
        phase: 1,
        slot: null,
        games: 2,
        rate: { value: 1, sampleCount: 2 },
      },
    ],
  },
  roles: {
    page: 1,
    pageSize: 25,
    total: 1,
    items: [
      {
        champion: "Jinx",
        role: "bottom",
        games: 2,
        blindRate: { value: 0.5, sampleCount: 2 },
        counterRate: { value: 0.5, sampleCount: 2 },
      },
    ],
  },
};
it("shows samples, coverage, filters and accessible draft tables", async () => {
  const { rerender } = render(
    <DraftsPage
      query={{ patch: "16.4", league: "LCK", priorityPage: 1, rolePage: 1 }}
      analytics={analytics}
      error={null}
    />,
  );
  expect(screen.getByLabelText("Patch")).toHaveValue("16.4");
  expect(screen.getByLabelText("League")).toHaveValue("LCK");
  const coverage = screen.getByLabelText("Draft Coverage", { selector: "dl" });
  expect(coverage).toHaveTextContent("Included Games2");
  expect(coverage).toHaveTextContent("Excluded Games1");
  expect(screen.getByLabelText("First Pick", { selector: "dl" })).toHaveTextContent(
    "First-Pick Win Rate2 games50.0%",
  );
  expect(screen.getByRole("table", { name: "Pick and Ban Priority" })).toBeVisible();
  expect(screen.getByText("Phase Total")).toBeVisible();
  fireEvent.click(screen.getByText("How These Rates Are Measured"));
  expect(await screen.findByText(/Blind means picked before/)).toBeVisible();
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  expect(
    result.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
  rerender(
    <DraftsPage
      query={{ patch: "16.4", priorityPage: 1, rolePage: 1 }}
      analytics={{
        ...analytics,
        firstPickWinRate: { value: null, sampleCount: 0 },
        exclusions: [],
        priorities: {
          ...analytics.priorities,
          items: [{ ...analytics.priorities.items[0]!, slot: 1 }],
        },
      }}
      error={null}
    />,
  );
  expect(screen.getByLabelText("First Pick", { selector: "dl" })).toHaveTextContent(
    "First-Pick Win Rate0 games—",
  );
});
it("explains missing data and invalid filters", () => {
  const { rerender } = render(<DraftsPage query={null} analytics={null} error="Invalid filters" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid filters");
  expect(screen.queryByText("No Draft Data Yet")).not.toBeInTheDocument();
  rerender(<DraftsPage query={null} analytics={null} error={null} />);
  expect(screen.getByText("No Draft Data Yet")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Sources" })).not.toBeInTheDocument();
});
