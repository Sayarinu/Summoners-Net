"use client";

import { useState } from "react";

import { worldToPixel, type MapPosition } from "./map-coordinates.js";
export { worldToPixel, summonersRiftBounds, type MapPosition } from "./map-coordinates.js";

export type MinimapSide = "blue" | "red" | "neutral";
/** How a point is drawn: champions as dots, kills as crosses, objectives as squares, wards as diamonds. */
export type MinimapMarker = "champion" | "kill" | "objective" | "ward";

export interface MinimapPoint extends MapPosition {
  readonly id: string;
  readonly label: string;
  readonly side: MinimapSide;
  readonly marker?: MinimapMarker;
  /** Drawn hollow and dashed: a detection the source scored as uncertain. */
  readonly lowConfidence?: boolean;
}

export interface MinimapPath {
  readonly id: string;
  readonly label: string;
  readonly side: "blue" | "red";
  readonly positions: readonly MapPosition[];
}

export interface MinimapHeat extends MinimapPoint {
  readonly value: number | null;
  readonly sampleCount: number;
}

export interface MinimapProps {
  readonly title: string;
  readonly imageUrl?: string | null;
  readonly points?: readonly MinimapPoint[];
  readonly paths?: readonly MinimapPath[];
  readonly heat?: readonly MinimapHeat[];
}

const size = 512;
const sideColor = (side: MinimapSide) =>
  side === "neutral" ? "var(--color-text-secondary)" : `var(--color-side-${side})`;

function Marker({
  marker = "champion",
  x,
  y,
  color,
  low = false,
}: {
  marker?: MinimapMarker | undefined;
  x: number;
  y: number;
  color: string;
  low?: boolean | undefined;
}) {
  const r = 6;
  if (marker === "kill")
    return (
      <path
        d={`M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x + r} ${y - r} L ${x - r} ${y + r}`}
        stroke={color}
        className="np-minimap__event np-minimap__event--kill"
      />
    );
  if (marker === "objective")
    return (
      <rect
        x={x - r}
        y={y - r}
        width={2 * r}
        height={2 * r}
        fill={color}
        className="np-minimap__event np-minimap__event--objective"
      />
    );
  if (marker === "ward")
    return (
      <polygon
        points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
        fill={color}
        className="np-minimap__event np-minimap__event--ward"
      />
    );
  return (
    <circle
      cx={x}
      cy={y}
      r={5}
      fill={color}
      className={low ? "np-minimap__point np-minimap__point--low" : "np-minimap__point"}
    />
  );
}

function pathData(positions: readonly MapPosition[]) {
  let connected = false;
  return positions
    .map((position) => {
      const pixel = worldToPixel(position, size);
      if (!pixel) {
        connected = false;
        return "";
      }
      const segment = `${connected ? "L" : "M"} ${pixel.x} ${pixel.y}`;
      connected = true;
      return segment;
    })
    .join(" ");
}

export function Minimap({
  title,
  imageUrl = "/api/images/maps/11",
  points = [],
  paths = [],
  heat = [],
}: MinimapProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const localImage =
    imageUrl && /^\/api\/images\/(?:[a-f0-9]{64}|maps\/11)$/.test(imageUrl) ? imageUrl : null;
  const visiblePoints = points.flatMap((point) => {
    const pixel = worldToPixel(point, size);
    return pixel ? [{ ...point, pixel }] : [];
  });
  const visiblePaths = paths
    .map((path) => ({
      ...path,
      d: pathData(path.positions),
      count: path.positions.filter((p) => worldToPixel(p, size)).length,
    }))
    .filter((p) => p.d.includes("L"));
  const visibleHeat = heat.flatMap((cell) => {
    const pixel = worldToPixel(cell, size);
    return pixel &&
      cell.value !== null &&
      Number.isFinite(cell.value) &&
      cell.value >= 0 &&
      Number.isInteger(cell.sampleCount) &&
      cell.sampleCount > 0
      ? [{ ...cell, value: cell.value, pixel }]
      : [];
  });
  const maximum = visibleHeat.reduce((max, cell) => Math.max(max, cell.value), 0);
  return (
    <figure className="np-minimap">
      <figcaption>{title}</figcaption>
      <svg role="img" aria-label={title} viewBox={`0 0 ${size} ${size}`}>
        <title>{title}</title>
        {localImage && localImage !== failedUrl ? (
          <image
            href={localImage}
            width={size}
            height={size}
            onError={() => setFailedUrl(localImage)}
          />
        ) : null}
        <g>
          {visibleHeat.map((cell) => (
            <circle
              key={cell.id}
              cx={cell.pixel.x}
              cy={cell.pixel.y}
              r={20}
              fill={sideColor(cell.side)}
              fillOpacity={maximum === 0 ? 0 : (0.7 * cell.value) / maximum}
            >
              <title>{`${cell.label}: ${cell.value}; samples: ${cell.sampleCount}`}</title>
            </circle>
          ))}
        </g>
        <g>
          {visiblePaths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              className="np-minimap__path"
              stroke={sideColor(path.side)}
            >
              <title>{path.label}</title>
            </path>
          ))}
        </g>
        <g>
          {visiblePoints.map((point) => (
            <g key={point.id}>
              <title>{`${point.label} (${point.x}, ${point.y})`}</title>
              <Marker
                marker={point.marker}
                x={point.pixel.x}
                y={point.pixel.y}
                color={sideColor(point.side)}
                low={point.lowConfidence}
              />
            </g>
          ))}
        </g>
      </svg>
      {!localImage || localImage === failedUrl ? (
        <p>Map image unavailable. Plotted coordinates remain visible.</p>
      ) : null}
      <p>
        {visiblePoints.length} points, {visiblePaths.length} paths and {visibleHeat.length} heat
        samples plotted. Missing or out-of-bounds coordinates are omitted; paths break at gaps.
      </p>
      <details>
        <summary>View plotted data for {title}</summary>
        <ul>
          {visiblePoints.map((point) => (
            <li key={`point:${point.id}`}>
              {point.label} ({point.side}): {point.x}, {point.y}
              {point.lowConfidence ? " (low confidence)" : ""}
            </li>
          ))}
          {visiblePaths.map((path) => (
            <li key={`path:${path.id}`}>
              {path.label} ({path.side}): {path.count} positions;{" "}
              {path.positions
                .map((p) => (worldToPixel(p, size) ? `${p.x}, ${p.y}` : "gap"))
                .join(" → ")}
            </li>
          ))}
          {visibleHeat.map((cell) => (
            <li key={`heat:${cell.id}`}>
              {cell.label} ({cell.side}): {cell.x}, {cell.y}; value {cell.value}; samples{" "}
              {cell.sampleCount}
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
