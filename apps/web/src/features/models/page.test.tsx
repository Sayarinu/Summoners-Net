import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ModelDiagnostics } from "@summonersnet/data/contracts";
import { ModelsPage } from "./page";

const base = {
  modelVersion: 1,
  featureVersion: 1,
  trainMatches: 800,
  trainRows: 24000,
  evalMatches: 200,
  evalRows: 6000,
  brier: 0.181,
  trainedAt: "2026-03-01T00:00:00.000Z",
  reason: null,
};
const diagnostics: ModelDiagnostics = {
  models: [
    { ...base, id: 4, kind: "draft", status: "active", window: ["16.21", "16.22"] },
    { ...base, id: 3, kind: "pro-checkpoints", status: "active", window: ["2025", "2026"] },
    { ...base, id: 2, kind: "timeline", status: "active", window: ["16.22"] },
    {
      ...base,
      id: 1,
      kind: "timeline",
      status: "rejected",
      window: ["16.21"],
      brier: null,
      reason: "Only 12 training matches.",
    },
  ],
  selected: {
    ...base,
    id: 2,
    kind: "timeline",
    status: "active",
    window: ["16.22"],
    intercept: 0.02,
    weights: [{ feature: "goldDiff", label: "Gold difference (per 5,000)", weight: 1.234 }],
    bins: [
      { lower: 0.7, upper: 0.8, count: 40, predicted: 0.74, observed: 0.7 },
      { lower: 0.8, upper: 0.9, count: 0, predicted: null, observed: null },
    ],
  },
};
it("lists model versions and shows the selected model's calibration and weights", () => {
  render(<ModelsPage diagnostics={diagnostics} error={null} />);
  const versions = screen.getByRole("table", { name: "Model Versions" });
  expect(versions).toHaveTextContent(
    "#3 · v1Pro (4 checkpoints)activeYears 2025, 2026800 games · 24000 statesv10.181",
  );
  expect(versions).toHaveTextContent("Patches 16.22");
  expect(versions).toHaveTextContent(
    "#4 · v1Solo Queue (Pre-Game Draft)activePatches 16.21, 16.22",
  );
  expect(versions).toHaveTextContent("Unknown");
  expect(screen.getByRole("link", { name: "#2 · v1" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText(/Evaluated on 200 held-out games \(6000 states\)/)).toBeVisible();
  expect(
    screen.getAllByText("Reliability: Predicted vs Observed Blue Win Rate (%)")[0],
  ).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Feature Weights" })).toHaveTextContent(
    "Gold difference (per 5,000)1.234",
  );
});
it("explains rejected models, empty libraries and errors", () => {
  const view = render(
    <ModelsPage
      diagnostics={{
        ...diagnostics,
        selected: { ...diagnostics.selected!, reason: "Only 12 training matches." },
      }}
      error="Choose a model from the list."
    />,
  );
  expect(screen.getByText("Only 12 training matches.", { selector: "p" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a model");
  view.rerender(<ModelsPage diagnostics={{ ...diagnostics, selected: null }} error={null} />);
  expect(screen.getByText("No active model; choose a version above.")).toBeVisible();
  view.rerender(<ModelsPage diagnostics={{ models: [], selected: null }} error={null} />);
  expect(screen.getByText("No Models Trained Yet")).toBeVisible();
});
