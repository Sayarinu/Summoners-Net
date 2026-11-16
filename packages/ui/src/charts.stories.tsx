import type { Meta, StoryObj } from "@storybook/react-vite";

import { BarChart, HeatGrid, LineChart, ScatterChart, Sparkline } from "./charts.js";
import type { ChartPoint } from "./charts.js";

const points: readonly ChartPoint[] = [
  { id: "a", label: "One", x: 1, y: 12, sampleCount: 30 },
  { id: "b", label: "Two", x: 2, y: 20, sampleCount: 42 },
  { id: "c", label: "Three", x: 3, y: 15, sampleCount: 28 },
  { id: "d", label: "Four", x: 4, y: 24, sampleCount: 50 },
];
const sparse = points.map((point, index) =>
  index === 1 ? { ...point, y: null, sampleCount: 0 } : point,
);

function ChartsGallery({ state }: { readonly state: "populated" | "empty" | "sparse" }) {
  const data = state === "empty" ? [] : state === "sparse" ? sparse : points;
  return (
    <main className="np-stack">
      <h1>SVG chart primitives — {state} fixtures</h1>
      <LineChart title="Line" points={data} xLabel="Minute" yLabel="Gold difference" color="blue" />
      <BarChart title="Bar" points={data} color="red" />
      <ScatterChart title="Scatter" points={data} color={3} />
      <Sparkline title="Sparkline" points={data} color={4} />
      <HeatGrid
        title="Heat grid"
        cells={data.map((point, index) => ({
          id: point.id,
          column: index % 2 ? "B" : "A",
          row: index < 2 ? "First" : "Second",
          value: point.y,
          sampleCount: point.sampleCount,
        }))}
        color={5}
      />
    </main>
  );
}

const meta = {
  component: ChartsGallery,
  title: "Components/Charts",
  args: { state: "populated" },
} satisfies Meta<typeof ChartsGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Sparse: Story = { args: { state: "sparse" } };
