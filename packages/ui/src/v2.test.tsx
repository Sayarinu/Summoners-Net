import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MetaText } from "./primitives.js";
import {
  CalibrationChart,
  ConfidenceInterval,
  CS2PlayerStatsTable,
  CS2TitleIcon,
  EconomyLoadoutStrip,
  EconomyStrip,
  GameTitleSwitcher,
  LeagueTitleIcon,
  LoadoutStrip,
  MapSeriesScore,
  MapVeto,
  ModelSource,
  PredictionDisclaimer,
  PredictionGuardrail,
  PredictionLoading,
  PredictionPanel,
  PredictionProbability,
  PredictionQualitySummary,
  PredictionTitleIcon,
  PredictionUnavailable,
  RoundScoreboard,
  StaleModelNotice,
} from "./v2.js";

const players = [
  {
    armor: 100,
    defuseKit: true,
    handle: "Alpha",
    hasHelmet: true,
    money: 1200,
    primary: "AWP",
    secondary: "P250",
    utility: 3,
  },
  { alive: false, armor: 48, handle: "Bravo", money: 300, utility: 0 },
] as const;

describe("V2 title and CS2 match context", () => {
  it("switches titles with radio keyboard semantics and disables unavailable titles", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <GameTitleSwitcher
        analyticsId="titles"
        onChange={change}
        titles={[
          {
            description: "V1",
            icon: <LeagueTitleIcon />,
            id: "lol",
            label: "League of Legends",
            shortLabel: "League",
          },
          {
            meta: <MetaText>V2</MetaText>,
            icon: <CS2TitleIcon />,
            id: "cs2",
            label: "Counter-Strike 2",
            shortLabel: "CS2",
          },
          { available: false, id: "future", label: "Future title" },
        ]}
        value="lol"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Game title" });
    expect(group).toHaveAttribute("data-analytics-id", "titles");
    expect(screen.getByRole("radio", { name: /League of Legends/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Future title" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Counter-Strike 2/ }));
    expect(change).toHaveBeenCalledWith("cs2");
  });

  it("renders complete ban, pick, remaining, and decider veto actions", () => {
    render(
      <MapVeto
        analyticsId="veto"
        bestOf={3}
        steps={[
          { action: "ban", id: "1", map: "Vertigo", team: "A" },
          { action: "pick", id: "2", map: "Nuke", side: "CT", team: "B" },
          { action: "remaining", id: "3", map: "Dust II" },
          { action: "decider", id: "4", map: "Mirage" },
          { action: "pick", id: "5", map: "Anubis" },
        ]}
      />,
    );
    const section = screen.getByRole("heading", { name: "Map veto" }).closest("section");
    expect(section).toHaveAttribute("data-analytics-id", "veto");
    expect(screen.getByText("A removed")).toBeVisible();
    expect(screen.getByText("B picked")).toBeVisible();
    expect(screen.getAllByText("Series decider")).toHaveLength(2);
    expect(screen.getByText("TBD picked")).toBeVisible();
    expect(screen.getByText("Starts CT")).toBeVisible();
  });

  it("shows complete, live, and scheduled maps with series leadership", () => {
    const { rerender } = render(
      <MapSeriesScore
        analyticsId="series"
        bestOf={3}
        games={[
          { id: "one", map: "Dust II", scoreA: 13, scoreB: 9, state: "complete" },
          { id: "two", map: "Nuke", scoreA: 7, scoreB: 8, state: "live" },
          { id: "three", map: "Mirage", state: "scheduled" },
        ]}
        scoreA={1}
        scoreB={0}
        teamA="A"
        teamB="B"
      />,
    );
    const series = screen.getByLabelText("A versus B map series");
    expect(series).toHaveAttribute("data-analytics-id", "series");
    expect(within(series).getByText("live")).toBeVisible();
    expect(screen.getByLabelText("Score not available")).toBeVisible();
    expect(screen.getByText("13")).toHaveClass("is-winner");

    rerender(<MapSeriesScore bestOf={1} games={[]} scoreA={0} scoreB={1} teamA="A" teamB="B" />);
    expect(screen.getByText("Best of 1")).toBeVisible();
    expect(screen.getByText("1").closest(".np-map-series__team")).toHaveClass("is-leading");
  });

  it("announces round state, sides, economy, timer, and optional details", () => {
    const { rerender } = render(
      <RoundScoreboard
        analyticsId="round"
        phase="bomb-planted"
        round={16}
        teamA={{ equipmentValue: 24000, name: "A", score: 7, side: "CT", timeouts: 3 }}
        teamB={{ equipmentValue: 21000, name: "B", score: 8, side: "T", timeouts: 2 }}
        timer="0:31"
      />,
    );
    const scoreboard = screen.getByLabelText("Round 16 scoreboard");
    expect(scoreboard).toHaveAttribute("data-analytics-id", "round");
    expect(screen.getByRole("status")).toHaveTextContent("0:31");
    expect(screen.getByText("$24,000 equipment")).toBeVisible();
    expect(screen.getByText("3 TO")).toBeVisible();

    rerender(
      <RoundScoreboard
        phase="tactical-timeout"
        round={17}
        teamA={{ name: "A", score: 8, side: "T" }}
        teamB={{ name: "B", score: 8, side: "CT" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("tactical timeout");
    expect(screen.queryByText(/equipment/)).not.toBeInTheDocument();
  });
});

describe("CS2 economy, loadouts, and statistics", () => {
  it("compares team economy states and optional loss bonuses", () => {
    render(
      <EconomyStrip
        analyticsId="economy"
        teams={[
          { equipmentValue: 24000, lossBonus: 1400, money: 5000, name: "A", state: "buy" },
          { equipmentValue: 9000, money: 12000, name: "B", state: "eco" },
        ]}
      />,
    );
    const economy = screen.getByLabelText("Team economy");
    expect(economy).toHaveAttribute("data-analytics-id", "economy");
    expect(screen.getByText("$1,400")).toBeVisible();
    expect(screen.getByText("buy")).toBeVisible();
    expect(screen.getByText("eco")).toBeVisible();
  });

  it("renders alive and eliminated player loadouts with equipment fallbacks", () => {
    render(<LoadoutStrip analyticsId="loadout" players={players} side="CT" team="A" />);
    const table = screen.getByRole("table", { name: "A player economy and equipment" });
    expect(table.closest("section")).toHaveAttribute("data-analytics-id", "loadout");
    expect(screen.getByText("$1,500 available")).toBeVisible();
    expect(screen.getByText("Helmet")).toBeVisible();
    expect(screen.getByText("Kit")).toBeVisible();
    expect(screen.getByText("Bravo").closest("tr")).toHaveClass("is-eliminated");
    expect(within(screen.getByText("Bravo").closest("tr")!).getAllByText("—")).toHaveLength(2);
  });

  it("composes team economy and loadout details", () => {
    render(
      <EconomyLoadoutStrip
        analyticsId="combined"
        players={players}
        side="T"
        team="A"
        teamEconomy={{ equipmentValue: 24000, money: 5000, name: "A", state: "half-buy" }}
      />,
    );
    expect(screen.getByText("Team equipment value").closest(".np-economy-loadout")).toHaveAttribute(
      "data-analytics-id",
      "combined",
    );
    expect(screen.getByText("$24,000")).toBeVisible();
    expect(screen.getByRole("heading", { name: "A loadout" })).toBeVisible();
  });

  it("sorts all player statistics and renders formatted K/D and ADR values", async () => {
    const user = userEvent.setup();
    const sortRows = vi.fn();
    const rows = [
      {
        adr: 101.42,
        assists: 5,
        deaths: 10,
        handle: "Alpha",
        headshots: 38,
        id: "1",
        kast: 82,
        kd: 1.8,
        kills: 18,
        rating: 1.42,
        team: "A",
      },
    ];
    const { rerender } = render(
      <CS2PlayerStatsTable
        analyticsId="stats"
        onSort={sortRows}
        rows={rows}
        sort={{ direction: "descending", key: "rating" }}
      />,
    );
    const table = screen.getByRole("table", { name: "Player map statistics" });
    expect(table.closest("div")).toHaveAttribute("data-analytics-id", "stats");
    expect(screen.getByRole("columnheader", { name: /Rating/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByText("1.80")).toBeVisible();
    expect(screen.getByText("101.4")).toBeVisible();
    for (const name of ["K", "D", "A", "K/D", "ADR", "KAST", "HS", "Rating"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    expect(sortRows).toHaveBeenCalledTimes(8);

    rerender(<CS2PlayerStatsTable caption="Static statistics" rows={rows} />);
    expect(screen.getByRole("table", { name: "Static statistics" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("prediction transparency and safety states", () => {
  const outcomes = [
    { colorIndex: 1 as const, id: "a", label: "A wins", probability: 0.63 },
    { id: "b", label: "B wins", probability: 0.37 },
  ];

  it("clamps and normalizes model probabilities including zero-total data", () => {
    const { rerender } = render(
      <PredictionProbability
        analyticsId="probability"
        outcomes={[
          { id: "high", label: "High", probability: 2 },
          { id: "low", label: "Low", probability: -1 },
        ]}
      />,
    );
    const figure = screen.getByRole("figure", { name: "Model probability" });
    expect(figure).toHaveAttribute("data-analytics-id", "probability");
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    expect(figure.querySelector(".np-prediction-probability__bar span")).toHaveStyle({
      width: "100%",
    });

    rerender(
      <PredictionProbability
        outcomes={[{ id: "zero", label: "No estimate", probability: 0 }]}
        title="No probability"
      />,
    );
    expect(
      screen
        .getByRole("figure", { name: "No probability" })
        .querySelector(".np-prediction-probability__bar span"),
    ).toHaveStyle({ width: "0%" });
  });

  it("clamps confidence bounds and exposes a complete text alternative", () => {
    const { rerender } = render(
      <ConfidenceInterval analyticsId="interval" lower={-1} point={0.7} upper={2} />,
    );
    const chart = screen.getByRole("img", {
      name: "95% confidence interval from 0% to 100%, point estimate 70%",
    });
    expect(chart.closest("figure")).toHaveAttribute("data-analytics-id", "interval");
    rerender(
      <ConfidenceInterval
        confidence={90}
        higherLabel="A"
        lower={0.4}
        lowerLabel="B"
        point={0.2}
        upper={0.6}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "90% confidence interval from 40% to 60%, point estimate 40%",
      }),
    ).toBeVisible();
  });

  it("renders calibration error states and expandable source data", async () => {
    const user = userEvent.setup();
    const bins = [
      { actual: -1, id: "low", predicted: -1, sampleSize: 10 },
      { actual: 0.62, id: "mid", predicted: 0.6, sampleSize: 120 },
      { actual: 2, id: "high", predicted: 2, sampleSize: 300 },
    ];
    const { rerender } = render(
      <CalibrationChart analyticsId="calibration" bins={bins} calibrationError={0.03} />,
    );
    expect(screen.getByRole("figure", { name: /Probability calibration/ })).toHaveAttribute(
      "data-analytics-id",
      "calibration",
    );
    expect(screen.getByText("ECE 3.0%")).toBeVisible();
    await user.click(screen.getByText("View calibration data"));
    expect(screen.getByRole("table")).toHaveTextContent("120");
    rerender(<CalibrationChart bins={bins} calibrationError={0.08} title="Stale calibration" />);
    expect(screen.getByText("ECE 8.0%")).toBeVisible();
    rerender(<CalibrationChart bins={[]} />);
    expect(screen.queryByText(/ECE/)).not.toBeInTheDocument();
  });

  it("attributes model versions, evaluation time, sample, and source links", () => {
    const { rerender } = render(
      <ModelSource
        analyticsId="model"
        evaluatedAt="2026-07-10"
        evaluatedLabel="Today"
        model="Series model"
        sampleSize={920}
        source="Verified data"
        sourceHref="/sources"
        version="v1.2.3"
      />,
    );
    const model = screen.getByLabelText("Prediction model details");
    expect(model).toHaveAttribute("data-analytics-id", "model");
    expect(screen.getByRole("link", { name: /Verified data/ })).toHaveAttribute("href", "/sources");
    expect(screen.getByText("920 series")).toBeVisible();
    rerender(<ModelSource model="Static model" source="Local" version="v0" />);
    expect(screen.queryByText("Last evaluated")).not.toBeInTheDocument();
    expect(screen.queryByText("Evaluation sample")).not.toBeInTheDocument();
  });

  it("always labels predictions informational-only and rejects betting use", () => {
    const { rerender } = render(<PredictionDisclaimer analyticsId="disclaimer" />);
    expect(screen.getByRole("region", { name: "Informational analysis only" })).toBeVisible();
    expect(screen.getByText(/not facts, betting advice, or guarantees/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Read the model methodology" })).toHaveAttribute(
      "href",
      "/methodology/predictions",
    );
    rerender(<PredictionDisclaimer methodologyHref="/custom" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/custom");
  });

  it("composes probability, interval, model source, quality, and disclaimer", () => {
    const { rerender } = render(
      <PredictionPanel
        analyticsId="panel"
        interval={{ lower: 0.55, point: 0.63, upper: 0.7 }}
        model={{ model: "Series model", source: "Verified", version: "v1" }}
        outcomes={outcomes}
        title="A versus B"
      >
        <PredictionQualitySummary brierScore={0.184} calibrationError={0.032} sampleSize={920} />
      </PredictionPanel>,
    );
    const panel = screen.getByRole("heading", { name: "A versus B" }).closest("section");
    expect(panel).toHaveAttribute("data-analytics-id", "panel");
    expect(screen.getByLabelText("Model quality summary")).toHaveTextContent("0.184");
    expect(screen.getByRole("region", { name: "Informational analysis only" })).toBeVisible();
    rerender(
      <PredictionPanel
        model={{ model: "Series model", source: "Verified", version: "v1" }}
        outcomes={outcomes}
        title="No interval"
      />,
    );
    expect(screen.queryByText("95% confidence interval")).not.toBeInTheDocument();
  });

  it("recovers from unavailable predictions and supports a no-action state", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <PredictionUnavailable
        analyticsId="unavailable"
        onRetry={retry}
        reason="Missing roster data"
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-analytics-id", "unavailable");
    expect(status).toHaveTextContent("Missing roster data");
    await user.click(screen.getByRole("button", { name: "Retry Model" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<PredictionUnavailable />);
    expect(screen.getByText(/did not return a trustworthy estimate/)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("announces the prediction loading state", () => {
    const { rerender } = render(<PredictionLoading analyticsId="loading" />);
    expect(screen.getByLabelText("Generating model estimate")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Generating model estimate")).toHaveAttribute(
      "data-analytics-id",
      "loading",
    );
    rerender(<PredictionLoading label="Evaluating map model" />);
    expect(screen.getByLabelText("Evaluating map model")).toBeVisible();
  });

  it("communicates stale model age, threshold, and refresh action", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    const { rerender } = render(
      <StaleModelNotice
        ageLabel="36 hours ago"
        analyticsId="stale"
        lastEvaluatedAt="2026-07-09"
        onRefresh={refresh}
        thresholdLabel="12 hours"
        version="v1"
      />,
    );
    expect(screen.getByText(/Freshness target: 12 hours/)).toHaveAttribute(
      "data-analytics-id",
      "stale",
    );
    await user.click(screen.getByRole("button", { name: "Request New Estimate" }));
    expect(refresh).toHaveBeenCalledOnce();
    rerender(<StaleModelNotice ageLabel="Yesterday" lastEvaluatedAt="2026-07-09" version="v0" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fails closed when any prediction release check is blocked", () => {
    const checks = [
      { id: "license", label: "License", passed: true },
      { id: "fresh", label: "Freshness", passed: false },
    ];
    const { rerender } = render(<PredictionGuardrail analyticsId="guardrail" checks={checks} />);
    const guardrail = screen.getByLabelText("Prediction release checks");
    expect(guardrail).toHaveAttribute("data-analytics-id", "guardrail");
    expect(screen.getByText("Prediction withheld")).toBeVisible();
    expect(screen.getByText("Blocked")).toBeVisible();
    rerender(<PredictionGuardrail checks={checks.map((check) => ({ ...check, passed: true }))} />);
    expect(screen.getByText("Release checks passed")).toBeVisible();
    expect(screen.getAllByText("Passed")).toHaveLength(2);
  });

  it("renders accessible title icons for CS2, League, and predictions", () => {
    render(
      <div>
        <CS2TitleIcon />
        <LeagueTitleIcon />
        <PredictionTitleIcon />
      </div>,
    );
    expect(screen.getByRole("img", { name: "Counter-Strike 2" })).toBeVisible();
    expect(screen.getByRole("img", { name: "League of Legends" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Prediction analysis" })).toBeVisible();
  });
});
