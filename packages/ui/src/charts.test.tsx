import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BarChart, HeatGrid, LineChart, ScatterChart, Sparkline } from "./charts.js";
import type { ChartPoint } from "./charts.js";

const points: readonly ChartPoint[] = [
  { id: "a", label: "First", x: 0, y: 10, sampleCount: 20 },
  { id: "b", label: "Missing", x: 1, y: null, sampleCount: 0 },
  { id: "c", label: "Third", x: 2, y: 0, sampleCount: 15 },
  { id: "d", label: "Fourth", x: 3, y: -10, sampleCount: null },
];

describe("SVG charts", () => {
  it.each([LineChart, Sparkline])(
    "leaves a gap in %s and exposes every sample in a table",
    async (Component) => {
      const user = userEvent.setup();
      render(
        <Component title="Gold" points={points} color="blue" xLabel="Minute" yLabel="Difference" />,
      );
      const svg = screen.getByRole("img", { name: "Gold" });
      expect(svg.querySelectorAll("circle")).toHaveLength(3);
      const path = svg.querySelector(".np-chart__line")?.getAttribute("d");
      expect(path?.match(/M/g)).toHaveLength(2);
      expect(path?.match(/L/g)).toHaveLength(1);
      expect(svg).toHaveTextContent("samples: 20");
      await user.click(screen.getByText("View data for Gold"));
      const table = screen.getByRole("table", { name: "Gold data" });
      expect(within(table).getByRole("row", { name: "Missing 1 Unknown 0" })).toBeVisible();
      expect(within(table).getByRole("row", { name: "Fourth 3 -10 Unknown" })).toBeVisible();
      expect(svg.querySelector("g[style]")).toHaveStyle({ color: "var(--color-side-blue)" });
    },
  );

  it("labels the x-axis with named ticks instead of its numeric range", () => {
    render(
      <LineChart
        title="Trend"
        points={points}
        xLabel="Patch"
        xTicks={points.map((point) => ({ x: point.x, label: `16.${20 + point.x}` }))}
      />,
    );
    const axes = screen.getByRole("img", { name: "Trend" }).querySelector(".np-chart__axes")!;
    const labels = [...axes.querySelectorAll("text")].map((text) => text.textContent);
    expect(labels).toEqual(expect.arrayContaining(["16.20", "16.21", "16.22", "16.23"]));
    expect(labels).not.toContain("0");
  });

  it("draws negative and positive bars on opposite sides of zero without filling unknown values", () => {
    render(<BarChart title="Bars" points={points} color="red" />);
    const svg = screen.getByRole("img", { name: "Bars" });
    const bars = [...svg.querySelectorAll("rect")];
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("height", "113");
    expect(bars[1]).toHaveAttribute("height", "0");
    expect(bars[2]).toHaveAttribute("height", "113");
    expect(Number(bars[0]?.getAttribute("y"))).toBeLessThan(Number(bars[2]?.getAttribute("y")));
    expect(svg.querySelector("g[style]")).toHaveStyle({ color: "var(--color-side-red)" });
  });

  it("plots numeric scatter coordinates and supports a single observation", () => {
    const { rerender } = render(<ScatterChart title="Scatter" points={points} color={8} />);
    const svg = screen.getByRole("img", { name: "Scatter" });
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
    expect(svg.querySelector(".np-chart__line")).toBeNull();
    expect(svg.querySelector("g[style]")).toHaveStyle({ color: "var(--color-chart-8)" });
    rerender(
      <ScatterChart
        title="Scatter"
        points={[{ id: "one", label: "One", x: 5, y: 5, sampleCount: 1 }]}
      />,
    );
    expect(svg.querySelector("circle")).toHaveAttribute("cx", "344");
    expect(svg.querySelector("circle")).toHaveAttribute("cy", "137");
  });

  it.each([LineChart, BarChart, ScatterChart, Sparkline])(
    "handles empty, unknown and non-finite observations in %s",
    (Component) => {
      const { rerender } = render(<Component title="Empty" points={[]} />);
      expect(screen.getByText("No observations available")).toBeVisible();
      rerender(
        <Component
          title="Empty"
          points={[
            { id: "null", label: "Unknown", x: 1, y: null, sampleCount: 0 },
            { id: "bad", label: "Invalid", x: Infinity, y: NaN, sampleCount: null },
          ]}
        />,
      );
      const svg = screen.getByRole("img", { name: "Empty" });
      expect(svg.querySelectorAll("circle, rect")).toHaveLength(0);
      expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
      expect(svg.querySelectorAll("text")).toHaveLength(0);
      expect(screen.getByText("No observations available")).toBeVisible();
    },
  );

  it("staggers crowded column labels and keeps each full name as its tooltip", () => {
    const columns = ["Nautilus", "Thresh", "Rell", "Braum", "Milio", "Lulu", "Nami", "Karma"];
    const rows = ["Jinx", "Kai'Sa", "Ezreal", "Jhin", "Zeri", "Caitlyn", "Lucian", "Xayah"];
    render(
      <HeatGrid
        title="Bot Lanes"
        cells={rows.flatMap((row) =>
          columns.map((column) => ({
            id: `${row}:${column}`,
            row,
            column,
            value: 0.5,
            sampleCount: 12,
          })),
        )}
      />,
    );
    const labels = [...screen.getByRole("img", { name: "Bot Lanes" }).querySelectorAll("text")]
      .filter((text) => columns.includes(text.querySelector("title")?.textContent ?? ""))
      .map((text) => ({
        name: text.querySelector("title")!.textContent,
        y: text.getAttribute("y"),
      }));
    expect(labels.map((l) => l.name)).toEqual(columns);
    // Neighbours sit on alternating lines, so their labels do not overlap.
    expect(labels[0]!.y).not.toBe(labels[1]!.y);
    expect(labels[0]!.y).toBe(labels[2]!.y);
  });
  it("preserves empty grid cells, shows sample counts, and scales intensity", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <HeatGrid
        title="Matchups"
        cells={[
          { id: "a", row: "Top", column: "A", value: 0, sampleCount: 20 },
          { id: "b", row: "Top", column: "B", value: null, sampleCount: 0 },
          { id: "c", row: "Mid", column: "A", value: 100, sampleCount: 40 },
        ]}
      />,
    );
    const svg = screen.getByRole("img", { name: "Matchups" });
    const cells = svg.querySelectorAll("rect");
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute("fill-opacity", "0.2");
    expect(cells[1]).toHaveAttribute("fill-opacity", "0");
    expect(cells[1]).toHaveTextContent("Top, B: Unknown; samples: 0");
    expect(cells[2]).toHaveAttribute("fill-opacity", "1");
    expect(svg).toHaveTextContent("Top, A: 0; samples: 20");
    await user.click(screen.getByText("View data for Matchups"));
    expect(screen.getByRole("row", { name: "Top B Unknown 0" })).toBeVisible();
    rerender(<HeatGrid title="Matchups" cells={[]} />);
    expect(screen.getByText("No observations available")).toBeVisible();
    rerender(
      <HeatGrid
        title="Matchups"
        cells={[{ id: "a", row: "Top", column: "A", value: 1, sampleCount: null }]}
      />,
    );
    const single = svg.querySelector("rect");
    expect(single).toHaveAttribute("fill-opacity", "1");
    // A lone cell stays a square of at most 56 units, centered, not a block across the chart.
    expect(single).toHaveAttribute("width", "54");
    expect(single).toHaveAttribute("height", "54");
    expect(single).toHaveAttribute("x", `${136 + (480 - 56) / 2}`);
    expect(screen.getByText("Intensity: 1")).toBeInTheDocument();
  });

  it("preserves heat-grid tooltips in server-rendered markup", () => {
    const html = renderToStaticMarkup(
      <HeatGrid
        title="Grid"
        cells={[{ id: "a", row: "Top", column: "A", value: 50, sampleCount: 20 }]}
      />,
    );
    expect(html).toContain("<title>Top, A: 50; samples: 20</title>");
  });

  it("has no serious accessibility violations with the data alternative expanded", async () => {
    render(
      <main>
        <h1>Charts</h1>
        <LineChart title="Gold" points={points} />
      </main>,
    );
    await userEvent.setup().click(screen.getByText("View data for Gold"));
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
});

it("draws event markers along the x-axis of line charts, with their labels", () => {
  const { container } = render(
    <LineChart
      title="Win Probability"
      xLabel="Minute"
      points={[
        { id: "0", label: "0", x: 0, y: 0.5, sampleCount: 1 },
        { id: "10", label: "10", x: 10, y: 0.7, sampleCount: 1 },
      ]}
      markers={[
        { id: "k", x: 4, label: "Blue kill", color: "blue" },
        { id: "bad", x: Number.NaN, label: "Ignored" },
      ]}
    />,
  );
  const ticks = container.querySelectorAll(".np-chart__markers path");
  expect(ticks).toHaveLength(1);
  expect(ticks[0]?.querySelector("title")?.textContent).toBe("Blue kill (Minute 4)");
});
