import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { Minimap, worldToPixel } from "./minimap.js";

const blue = {
  id: "BLUE_MID_LANE_OUTER_TURRET",
  label: "Blue mid outer turret",
  side: "blue" as const,
  x: 5846,
  y: 6396,
};

describe("Summoner’s Rift coordinates", () => {
  it("maps the world corners, centre and published turret coordinates with y flipped", () => {
    expect(worldToPixel({ x: -120, y: -120 }, 512)).toEqual({ x: 0, y: 512 });
    expect(worldToPixel({ x: 14870, y: 14980 }, 512)).toEqual({ x: 512, y: 0 });
    expect(worldToPixel({ x: 7375, y: 7430 }, 800, 400)).toEqual({ x: 400, y: 200 });
    const turret = worldToPixel(blue, 512)!;
    expect(turret.x).toBeCloseTo(203.777, 2);
    expect(turret.y).toBeCloseTo(291.062, 2);
  });
  it("rejects unknown, non-finite and out-of-bounds coordinates and invalid image sizes", () => {
    for (const position of [
      { x: null, y: 0 },
      { x: 0, y: null },
      { x: NaN, y: 1 },
      { x: 1, y: Infinity },
      { x: -121, y: 0 },
      { x: 14871, y: 0 },
      { x: 0, y: -121 },
      { x: 0, y: 14981 },
    ])
      expect(worldToPixel(position, 512)).toBeNull();
    for (const size of [0, -1, NaN, Infinity]) {
      expect(worldToPixel(blue, size)).toBeNull();
      expect(worldToPixel(blue, 512, size)).toBeNull();
    }
  });
});

describe("Minimap", () => {
  it("draws local map images and side-colored points, path gaps and heat, with readable data", async () => {
    render(
      <Minimap
        title="Game map"
        points={[blue, { ...blue, id: "missing", x: null }]}
        paths={[
          {
            id: "route",
            label: "Route",
            side: "red",
            positions: [blue, { x: null, y: null }, blue, { x: 8955, y: 8510 }],
          },
        ]}
        heat={[
          { ...blue, id: "heat", label: "Heat", value: 2, sampleCount: 2 },
          { ...blue, id: "unknown", value: null, sampleCount: 0 },
          { ...blue, id: "outside", x: 20000, value: 1, sampleCount: 1 },
          { ...blue, id: "negative", value: -1, sampleCount: 1 },
          { ...blue, id: "no-sample", value: 1, sampleCount: 0 },
        ]}
      />,
    );
    const svg = screen.getByRole("img", { name: "Game map" });
    expect(svg.querySelector("image")).toHaveAttribute("href", "/api/images/maps/11");
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
    expect(svg.querySelector(".np-minimap__point")).toHaveAttribute(
      "fill",
      "var(--color-side-blue)",
    );
    expect(svg.querySelector("path")).toHaveAttribute("stroke", "var(--color-side-red)");
    expect(svg.querySelector("path")?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    expect(svg.querySelector("path")?.getAttribute("d")?.match(/L/g)).toHaveLength(1);
    expect(screen.getByText(/1 points, 1 paths and 1 heat samples/)).toBeVisible();
    await userEvent.setup().click(screen.getByText("View plotted data for Game map"));
    expect(screen.getByText("Blue mid outer turret (blue): 5846, 6396")).toBeVisible();
    expect(screen.getByText(/Route \(red\): 3 positions;.*gap/)).toBeVisible();
    expect(screen.getByText(/Heat \(blue\):.*samples 2/)).toBeVisible();
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      result.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("handles absent, failed and remote image URLs without requesting a provider", () => {
    const { rerender } = render(<Minimap title="Map" imageUrl={null} />);
    expect(screen.getByText(/Map image unavailable/)).toBeVisible();
    expect(screen.getByText(/0 points, 0 paths and 0 heat samples/)).toBeVisible();
    rerender(<Minimap title="Map" imageUrl="https://ddragon.leagueoflegends.com/map.png" />);
    const svg = screen.getByRole("img", { name: "Map" });
    expect(svg.querySelector("image")).toBeNull();
    rerender(<Minimap title="Map" imageUrl={`/api/images/${"a".repeat(64)}`} />);
    fireEvent.error(svg.querySelector("image")!);
    expect(svg.querySelector("image")).toBeNull();
    rerender(
      <Minimap
        title="Map"
        imageUrl={`/api/images/${"b".repeat(64)}`}
        heat={[{ ...blue, value: 0, sampleCount: 1 }]}
        paths={[{ id: "empty", label: "Missing", side: "blue", positions: [{ x: null, y: null }] }]}
      />,
    );
    expect(svg.querySelector("image")).not.toBeNull();
    expect(svg.querySelector("circle")).toHaveAttribute("fill-opacity", "0");
    expect(svg.querySelector("path")).toBeNull();
  });
});
