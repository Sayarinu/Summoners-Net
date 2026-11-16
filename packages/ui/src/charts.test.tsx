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
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveAttribute("fill-opacity", "0.2");
    expect(cells[1]).toHaveAttribute("fill-opacity", "1");
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
    expect(svg.querySelector("rect")).toHaveAttribute("fill-opacity", "0.6");
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
