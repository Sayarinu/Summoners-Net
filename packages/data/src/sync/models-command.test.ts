import { describe, expect, it } from "vitest";
import type { ModelDiagnostics } from "../domain/model-diagnostics.js";
import { formatModelDiagnostics } from "./models-command.js";

const summary = {
  modelVersion: 3,
  featureVersion: 2,
  trainMatches: 7808,
  trainRows: 236914,
  evalMatches: 1952,
  evalRows: 59000,
  brier: 0.169,
  logLoss: 0.505,
  trainedAt: "2026-11-20T23:00:00.000Z",
  reason: null,
};
const diagnostics: ModelDiagnostics = {
  models: [
    {
      ...summary,
      id: 9,
      kind: "pro-checkpoints",
      status: "active",
      window: ["2025", "2026"],
      minutes: { first: 0, last: 46 },
    },
    {
      ...summary,
      id: 8,
      kind: "timeline",
      status: "rejected",
      window: ["16.22"],
      brier: null,
      logLoss: null,
      minutes: null,
      reason: "Only 0 training matches; at least 500 are needed.",
    },
  ],
  selected: {
    ...summary,
    id: 9,
    kind: "pro-checkpoints",
    status: "active",
    window: ["2025", "2026"],
    minutes: { first: 0, last: 46 },
    intercept: 0.012,
    weights: [{ feature: "goldDiff", label: "Gold difference (per 5,000)", weight: 1.234 }],
    bins: [
      { lower: 0.7, upper: 0.8, count: 40, predicted: 0.74, observed: 0.7 },
      { lower: 0.8, upper: 0.9, count: 0, predicted: null, observed: null },
    ],
    phases: [
      {
        phase: "early",
        label: "Early (Before 15:00)",
        games: 1948,
        states: 27000,
        brier: 0.212,
        logLoss: 0.612,
        bins: [],
      },
    ],
  },
};

describe("formatModelDiagnostics", () => {
  it("lists versions and the selected model's evaluation, phases, calibration and weights", () => {
    const text = formatModelDiagnostics(diagnostics);
    expect(text).toContain(
      "#9 v3 Pro (Game Checkpoints) · active · years 2025, 2026 · 7808 games / 236914 states · Brier 0.169",
    );
    expect(text).toContain("#8 v3 Solo Queue (Timelines) · rejected · patches 16.22");
    expect(text).toContain("Brier unknown");
    expect(text).toContain("Log loss: 0.505");
    expect(text).toContain("Minutes scored: 0:00–46:00");
    expect(text).toContain("Early (Before 15:00): 1948 games, 27000 states, Brier 0.212");
    expect(text).toContain("70–80%: 40 states, predicted 74.0%, observed 70.0%");
    // Empty calibration bins are left out.
    expect(text).not.toContain("80–90%");
    expect(text).toContain("Gold difference (per 5,000): 1.234");
    expect(text).toContain("Intercept: 0.012");
  });

  it("explains a rejected selection, no active model and an empty library", () => {
    const rejected = formatModelDiagnostics({
      ...diagnostics,
      selected: { ...diagnostics.selected!, status: "rejected", reason: "Too few games." },
    });
    expect(rejected).toContain("Not published: Too few games.");
    expect(formatModelDiagnostics({ ...diagnostics, selected: null })).toContain("No active model");
    expect(formatModelDiagnostics({ models: [], selected: null })).toMatch(/No models trained yet/);
  });
});
