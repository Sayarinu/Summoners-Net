import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AccessibleChart,
  BarChart,
  ChartTooltip,
  ComparisonPanel,
  DataNote,
  DistributionChart,
  LineChart,
  RankingTable,
  SampledValue,
  StackedBarChart,
  StatisticsScopeDetails,
  StatisticsState,
  StatisticsToolbar,
} from "./statistics.js";

const series = [
  {
    data: [
      { label: "W1", value: -20 },
      { label: "W2", value: 40 },
      { label: "W3", value: 70 },
    ],
    label: "Gen.G",
    tone: 1 as const,
  },
  {
    data: [
      { label: "W1", value: 10 },
      { label: "W2", value: 35 },
    ],
    label: "T1",
    tone: 2 as const,
  },
];

describe("statistics components", () => {
  it("renders toolbar filters and an analytics hook", () => {
    render(
      <StatisticsToolbar
        analyticsId="statistics-filters"
        filters={[
          {
            id: "season",
            label: "Season",
            options: [{ label: "2026", value: "2026" }],
            value: "2026",
          },
        ]}
        summary="96 games"
      />,
    );
    expect(document.querySelector('[data-analytics-id="statistics-filters"]')).toBeInTheDocument();
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("96 games")).toBeInTheDocument();
  });

  it("renders comparison winners and equal metrics", () => {
    render(
      <ComparisonPanel
        entityA="Gen.G"
        entityB="T1"
        metrics={[
          { better: "a", label: "Win rate", valueA: "72%", valueB: "68%" },
          { better: "b", label: "KDA", valueA: "4.1", valueB: "4.2" },
          { better: "equal", label: "Games", valueA: "20", valueB: "20" },
        ]}
        title="Team comparison"
      />,
    );
    expect(screen.getByRole("region", { name: "Team comparison" })).toBeInTheDocument();
    expect(document.querySelectorAll(".is-better")).toHaveLength(2);
  });

  it("renders rankings with upward, downward, and unchanged rows", () => {
    render(
      <RankingTable
        caption="Rankings"
        metricLabel="KDA"
        rows={[
          { change: 1, entity: "Chovy", id: "1", rank: 1, value: "4.8" },
          { change: -2, entity: "Faker", id: "2", rank: 2, value: "4.2" },
          { entity: "Knight", id: "3", note: "BLG", rank: 3, value: "4.0" },
        ]}
      />,
    );
    expect(screen.getByRole("table", { name: "Rankings" })).toBeInTheDocument();
    expect(screen.getByText("+1")).toHaveClass("is-up");
    expect(screen.getByText("-2")).toHaveClass("is-down");
    expect(screen.getByText("BLG")).toBeInTheDocument();
  });

  it("renders every chart type with accessible SVG labels and data tables", () => {
    const { rerender } = render(
      <AccessibleChart description="Weekly comparison" series={series} title="Weekly form">
        <LineChart label="Weekly form line chart" series={series} />
      </AccessibleChart>,
    );
    expect(screen.getByRole("img", { name: "Weekly form line chart" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    rerender(<BarChart label="Weekly bars" series={series} />);
    expect(screen.getByRole("img", { name: "Weekly bars" })).toBeInTheDocument();
    rerender(<StackedBarChart label="Weekly stacks" series={series} />);
    expect(screen.getByRole("img", { name: "Weekly stacks" })).toBeInTheDocument();
    rerender(<DistributionChart label="Distribution" series={series[0]!} />);
    expect(screen.getByRole("img", { name: "Distribution" })).toBeInTheDocument();
  });

  it("supports sparse and empty chart series", () => {
    const { rerender } = render(
      <LineChart
        label="Sparse"
        series={[{ data: [{ label: "Only", value: 4 }], label: "Only" }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Sparse" })).toBeInTheDocument();
    rerender(<BarChart label="Empty bars" series={[]} />);
    expect(screen.getByRole("img", { name: "Empty bars" })).toBeInTheDocument();
    rerender(<StackedBarChart label="Empty stacks" series={[]} />);
    expect(screen.getByRole("img", { name: "Empty stacks" })).toBeInTheDocument();
  });

  it("renders chart tooltips and source/sample notes", () => {
    render(
      <>
        <ChartTooltip label="Week 5" rows={[{ label: "Gen.G", value: "+290" }]} />
        <DataNote
          sampleSize={9600}
          source="Official data"
          sourceHref="#source"
          updated="12 minutes ago"
        />
        <DataNote />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Week 5");
    expect(screen.getByText("Sample: 9,600 games")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Official data" })).toHaveAttribute("href", "#source");
    expect(screen.getByText("Sample size unavailable")).toBeInTheDocument();
  });

  it("keeps routine samples quiet and explains only low-sample marks on focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SampledValue sampleSize={6} value="64.2%" />
        <SampledValue sampleSize={0} unavailableReason="not-collected" value={null} />
        <SampledValue sampleSize={3} unavailableReason="no-deaths" value={null} />
        <StatisticsScopeDetails
          items={[
            { label: "Event", value: "LCK Summer 2026" },
            { label: "Role", value: "Mid" },
          ]}
        />
      </>,
    );
    expect(screen.getByText("64.2%")).toBeVisible();
    expect(screen.getByText("Not available")).toBeVisible();
    expect(screen.getByText("No deaths")).toBeVisible();
    expect(screen.queryByText("6 eligible games")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This value: low sample, 3 games" })).toBeVisible();
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "This value is based on 3 games, below the 5-game threshold.",
    );
    expect(screen.getByRole("region", { name: "Statistics scope" })).toHaveTextContent(
      "LCK Summer 2026",
    );
    expect(screen.queryByText(/small sample/i)).not.toBeInTheDocument();
  });

  it.each(["empty", "error", "insufficient", "stale"] as const)(
    "renders the %s statistics state",
    (state) => {
      render(<StatisticsState onRetry={vi.fn()} state={state} />);
      expect(screen.getByRole("heading")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    },
  );

  it("renders loading and ready states", () => {
    const { rerender } = render(<StatisticsState state="loading" />);
    expect(screen.getByLabelText("Loading statistics")).toHaveAttribute("role", "status");
    rerender(
      <StatisticsState state="ready">
        <span>Ready statistics</span>
      </StatisticsState>,
    );
    expect(screen.getByText("Ready statistics")).toBeInTheDocument();
  });

  it.each(["partial", "corrected", "stale"] as const)(
    "keeps last-known-good children visible in the %s state",
    (state) => {
      render(
        <StatisticsState state={state}>
          <span>Last-known-good values</span>
        </StatisticsState>,
      );
      expect(screen.getByText("Last-known-good values")).toBeVisible();
      if (state !== "stale") expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    },
  );
});
