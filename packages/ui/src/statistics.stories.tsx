import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { PlayerIdentity, TeamIdentity } from "./esports.js";
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
import "./review.stories.css";

const noop = () => undefined;
const series = [
  {
    data: [
      { label: "W1", value: 120 },
      { label: "W2", value: 180 },
      { label: "W3", value: 150 },
      { label: "W4", value: 240 },
      { label: "W5", value: 290 },
    ],
    label: "Gen.G",
    tone: 1 as const,
  },
  {
    data: [
      { label: "W1", value: 80 },
      { label: "W2", value: 145 },
      { label: "W3", value: 190 },
      { label: "W4", value: 170 },
      { label: "W5", value: 230 },
    ],
    label: "T1",
    tone: 2 as const,
  },
];

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Statistics/01 Analysis patterns",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Canvas({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return (
    <main className="np-review">
      <header className="np-review__header">
        <div>
          <span className="np-eyebrow">Statistics</span>
          <h1>{title}</h1>
        </div>
        <p>Accessible descriptive analysis with durable source and sample context.</p>
      </header>
      <section className="np-review__section np-review__section--single">
        <div className="np-review__stage">{children}</div>
      </section>
    </main>
  );
}

export const Filters: Story = {
  name: "StatisticsToolbar",
  render: () => (
    <Canvas title="Statistics toolbar">
      <StatisticsToolbar
        filters={[
          {
            id: "season",
            label: "Season",
            options: [{ label: "2026", value: "2026" }],
            value: "2026",
          },
          {
            id: "event",
            label: "Event",
            options: [{ label: "All events", value: "all" }],
            value: "all",
          },
          {
            id: "patch",
            label: "Patch",
            options: [{ label: "26.14", value: "26.14" }],
            value: "26.14",
          },
          {
            id: "role",
            label: "Role",
            options: [{ label: "All roles", value: "all" }],
            value: "all",
          },
        ]}
        onChange={noop}
        summary="96 matches · Updated 12 minutes ago"
      />
    </Canvas>
  ),
};

export const ChartFrame: Story = {
  name: "AccessibleChart",
  render: () => (
    <Canvas title="Accessible chart frame">
      <AccessibleChart
        description="A chart contract with a visible legend and an equivalent data table."
        series={series}
        title="Gold differential"
      >
        <div className="np-review__stage">Visualization renderer slot</div>
      </AccessibleChart>
    </Canvas>
  ),
};

export const Comparison: Story = {
  name: "ComparisonPanel",
  render: () => (
    <Canvas title="Team comparison">
      <ComparisonPanel
        entityA={<TeamIdentity name="Gen.G" shortName="GEN" />}
        entityB={<TeamIdentity name="T1" shortName="T1" />}
        metrics={[
          { better: "a", label: "Match win rate", valueA: "72.4%", valueB: "68.9%" },
          { better: "b", label: "Gold diff @15", valueA: "+412", valueB: "+468" },
          { better: "equal", label: "Average game time", valueA: "31:42", valueB: "31:42" },
        ]}
        title="2026 season comparison"
      />
    </Canvas>
  ),
};

export const Rankings: Story = {
  name: "RankingTable",
  render: () => (
    <Canvas title="Ranking table">
      <RankingTable
        caption="Mid lane KDA rankings"
        metricLabel="KDA"
        rows={[
          {
            change: 1,
            entity: <PlayerIdentity handle="Chovy" role="Mid" />,
            id: "1",
            note: "Gen.G",
            rank: 1,
            value: "4.8",
          },
          {
            change: -1,
            entity: <PlayerIdentity handle="Faker" role="Mid" />,
            id: "2",
            note: "T1",
            rank: 2,
            value: "4.2",
          },
        ]}
      />
    </Canvas>
  ),
};

export const Line: Story = {
  name: "LineChart",
  render: () => (
    <Canvas title="Line chart">
      <AccessibleChart
        description="Gold difference at 15 by week."
        note={<DataNote sampleSize={42} source="Official match data" updated="12 minutes ago" />}
        series={series}
        title="Early-game advantage"
      >
        <LineChart label="Gold difference at 15 by week for Gen.G and T1" series={series} />
      </AccessibleChart>
    </Canvas>
  ),
};

export const Bars: Story = {
  name: "BarChart",
  render: () => (
    <Canvas title="Bar chart">
      <AccessibleChart
        description="Objective control by team."
        series={[series[0]!]}
        title="Objectives per game"
      >
        <BarChart label="Objectives per game" series={[series[0]!]} />
      </AccessibleChart>
    </Canvas>
  ),
};

export const StackedBars: Story = {
  name: "StackedBarChart",
  render: () => (
    <Canvas title="Stacked bar chart">
      <AccessibleChart
        description="Wins split by side."
        series={series}
        title="Blue and red-side wins"
      >
        <StackedBarChart label="Wins by side and week" series={series} />
      </AccessibleChart>
    </Canvas>
  ),
};

export const Distribution: Story = {
  name: "DistributionChart",
  render: () => (
    <Canvas title="Distribution chart">
      <AccessibleChart
        description="Game duration frequency."
        series={[series[0]!]}
        title="Game length distribution"
      >
        <DistributionChart label="Game length distribution" series={series[0]!} />
      </AccessibleChart>
    </Canvas>
  ),
};

export const Tooltip: Story = {
  name: "ChartTooltip",
  render: () => (
    <Canvas title="Chart tooltip">
      <ChartTooltip
        label="Week 5"
        rows={[
          { label: "Gen.G", tone: 1, value: "+290" },
          { label: "T1", tone: 2, value: "+230" },
        ]}
      />
    </Canvas>
  ),
};
export const SourceNote: Story = {
  name: "DataNote",
  render: () => (
    <Canvas title="Data note">
      <DataNote
        sampleSize={96}
        source="Riot Games official data"
        sourceHref="#"
        updated="2026-07-10 20:04 EDT"
      />
    </Canvas>
  ),
};
export const SampleContext: Story = {
  name: "SampledValue and StatisticsScopeDetails",
  render: () => (
    <Canvas title="Statistics sample context">
      <div style={{ display: "grid", gap: 24 }}>
        <StatisticsScopeDetails
          items={[
            { label: "Event", value: "LCK Summer 2026" },
            { label: "Event dates", value: "Jun 17 — Sep 6, 2026" },
            { label: "Role", value: "Mid" },
          ]}
        />
        <div style={{ display: "flex", gap: 32 }}>
          <SampledValue sampleSize={8} value="68.4%" />
          <SampledValue sampleSize={0} unavailableReason="not-collected" value={null} />
          <SampledValue
            lowSampleLabel="KT Rolster KDA"
            sampleSize={3}
            unavailableReason="no-deaths"
            value={null}
          />
        </div>
      </div>
    </Canvas>
  ),
};
export const Loading: Story = {
  name: "StatisticsState",
  render: () => (
    <Canvas title="Statistics loading">
      <StatisticsState state="loading" />
    </Canvas>
  ),
};
export const Empty: Story = {
  name: "StatisticsState — empty",
  render: () => (
    <Canvas title="Statistics empty">
      <StatisticsState state="empty" />
    </Canvas>
  ),
};
export const InsufficientSample: Story = {
  name: "StatisticsState — insufficient sample",
  render: () => (
    <Canvas title="Insufficient sample">
      <StatisticsState state="insufficient" />
    </Canvas>
  ),
};
export const Stale: Story = {
  name: "StatisticsState — stale",
  render: () => (
    <Canvas title="Stale statistics">
      <StatisticsState onRetry={noop} state="stale" />
    </Canvas>
  ),
};
export const Error: Story = {
  name: "StatisticsState — error",
  render: () => (
    <Canvas title="Statistics error">
      <StatisticsState onRetry={noop} state="error" />
    </Canvas>
  ),
};
export const Partial: Story = {
  name: "StatisticsState — internal coverage with values",
  render: () => (
    <Canvas title="Statistics values">
      <StatisticsState state="partial">
        <DataNote sampleSize={3} source="Last-known-good fixture" />
      </StatisticsState>
    </Canvas>
  ),
};
export const Corrected: Story = {
  name: "StatisticsState — reviewed values",
  render: () => (
    <Canvas title="Statistics values">
      <StatisticsState state="corrected">
        <DataNote sampleSize={8} source="Reviewed fixture" />
      </StatisticsState>
    </Canvas>
  ),
};
