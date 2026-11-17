import type { ReactNode } from "react";

import { Table } from "./data-display.js";

export type ChartColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "blue" | "red";

export interface ChartPoint {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number | null;
  readonly sampleCount: number | null;
}

/** An event at an x value, drawn as a labelled tick along the x-axis of line charts. */
export interface ChartMarker {
  readonly id: string;
  readonly x: number;
  readonly label: string;
  readonly color?: ChartColor;
}

export interface ChartProps {
  readonly title: string;
  readonly points: readonly ChartPoint[];
  readonly color?: ChartColor;
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly markers?: readonly ChartMarker[];
}

export interface HeatGridCell {
  readonly id: string;
  readonly column: string;
  readonly row: string;
  readonly value: number | null;
  readonly sampleCount: number | null;
}

export interface HeatGridProps {
  readonly title: string;
  readonly cells: readonly HeatGridCell[];
  readonly color?: ChartColor;
}

function known(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function display(value: number | null): string {
  return known(value) ? String(value) : "Unknown";
}

function colorValue(color: ChartColor): string {
  return typeof color === "number" ? `var(--color-chart-${color})` : `var(--color-side-${color})`;
}

function extent(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  return values.reduce<[number, number]>(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity],
  );
}

function scale(value: number, [min, max]: [number, number], start: number, end: number): number {
  return min === max ? (start + end) / 2 : start + ((value - min) / (max - min)) * (end - start);
}

function ChartFrame({
  title,
  compact = false,
  empty,
  children,
  table,
}: {
  readonly title: string;
  readonly compact?: boolean;
  readonly empty: boolean;
  readonly children: ReactNode;
  readonly table: ReactNode;
}) {
  return (
    <figure className={`np-chart${compact ? " np-chart--sparkline" : ""}`}>
      <figcaption>{title}</figcaption>
      <svg aria-label={title} role="img" viewBox={`0 0 640 ${compact ? 100 : 300}`}>
        <title>{title}</title>
        {children}
      </svg>
      {empty ? <p>No observations available</p> : null}
      <details>
        <summary>View data for {title}</summary>
        {table}
      </details>
    </figure>
  );
}

function CartesianChart({
  title,
  points,
  color = 1,
  xLabel = "X",
  yLabel = "Value",
  markers = [],
  kind,
}: ChartProps & { readonly kind: "line" | "bar" | "scatter" | "sparkline" }) {
  const compact = kind === "sparkline";
  const bottom = compact ? 88 : 250;
  const top = compact ? 12 : 24;
  const left = compact ? 12 : 72;
  const right = 616;
  const valid = points.filter((point) => known(point.x) && known(point.y));
  const xDomain = extent(points.map((point) => point.x).filter(Number.isFinite));
  const yValues = valid.map((point) => point.y as number);
  const yDomain = extent(kind === "bar" ? [0, ...yValues] : yValues);
  const x = (point: ChartPoint, index: number) =>
    kind === "bar"
      ? left + ((index + 0.5) / points.length) * (right - left)
      : scale(point.x, xDomain, left, right);
  const y = (value: number) => scale(value, yDomain, bottom, top);
  let connected = false;
  const path = points
    .map((point, index) => {
      if (!known(point.x) || !known(point.y)) {
        connected = false;
        return "";
      }
      const segment = `${connected ? "L" : "M"} ${x(point, index)} ${y(point.y)}`;
      connected = true;
      return segment;
    })
    .join(" ");

  return (
    <ChartFrame
      compact={compact}
      empty={valid.length === 0}
      title={title}
      table={
        <Table
          caption={`${title} data`}
          columns={[
            { header: "Observation", id: "label", render: (point: ChartPoint) => point.label },
            { header: xLabel, id: "x", render: (point) => display(point.x) },
            { header: yLabel, id: "y", render: (point) => display(point.y) },
            { header: "Samples", id: "samples", render: (point) => display(point.sampleCount) },
          ]}
          getRowKey={(point) => point.id}
          rows={points}
        />
      }
    >
      {!compact && valid.length > 0 ? (
        <g className="np-chart__axes">
          <path d={`M ${left} ${top} V ${bottom} H ${right}`} />
          <text x={left - 8} y={top + 4} textAnchor="end">
            {display(yDomain[1])}
          </text>
          <text x={left - 8} y={bottom} textAnchor="end">
            {display(yDomain[0])}
          </text>
          <text x={left} y={286}>
            {xLabel}
          </text>
          <text x={left} y={14}>
            {yLabel}
          </text>
          {kind !== "bar" ? (
            <>
              <text x={left} y={270}>
                {display(xDomain[0])}
              </text>
              <text x={right} y={270} textAnchor="end">
                {display(xDomain[1])}
              </text>
            </>
          ) : (
            <path d={`M ${left} ${y(0)} H ${right}`} />
          )}
        </g>
      ) : null}
      {kind === "line" && valid.length > 0 ? (
        <g className="np-chart__markers">
          {markers
            .filter((marker) => known(marker.x))
            .map((marker) => {
              const markerX = scale(marker.x, xDomain, left, right);
              return (
                <path
                  key={marker.id}
                  d={`M ${markerX} ${bottom} v -10`}
                  stroke={colorValue(marker.color ?? color)}
                  strokeWidth={3}
                >
                  <title>{`${marker.label} (${xLabel} ${marker.x})`}</title>
                </path>
              );
            })}
        </g>
      ) : null}
      <g style={{ color: colorValue(color) }}>
        {kind === "line" || compact ? <path className="np-chart__line" d={path} /> : null}
        {points.map((point, index) => {
          if (!known(point.x) || !known(point.y)) return null;
          const tooltip = `${point.label}: ${xLabel} ${point.x}, ${yLabel} ${point.y}; samples: ${display(point.sampleCount)}`;
          return kind === "bar" ? (
            <g key={point.id}>
              <rect
                fill="currentColor"
                x={x(point, index) - ((right - left) / points.length) * 0.35}
                y={Math.min(y(0), y(point.y))}
                width={((right - left) / points.length) * 0.7}
                height={Math.abs(y(point.y) - y(0))}
              >
                <title>{tooltip}</title>
              </rect>
              <text className="np-chart__label" x={x(point, index)} y={270} textAnchor="middle">
                {point.label}
              </text>
            </g>
          ) : (
            <circle
              key={point.id}
              cx={x(point, index)}
              cy={y(point.y)}
              r={compact ? 3 : 4}
              fill="currentColor"
            >
              <title>{tooltip}</title>
            </circle>
          );
        })}
      </g>
    </ChartFrame>
  );
}

export function LineChart(props: ChartProps) {
  return <CartesianChart {...props} kind="line" />;
}

export function BarChart(props: ChartProps) {
  return <CartesianChart {...props} kind="bar" />;
}

export function ScatterChart(props: ChartProps) {
  return <CartesianChart {...props} kind="scatter" />;
}

export function Sparkline(props: ChartProps) {
  return <CartesianChart {...props} kind="sparkline" />;
}

export function HeatGrid({ title, cells, color = 1 }: HeatGridProps) {
  const columns = [...new Set(cells.map((cell) => cell.column))];
  const rows = [...new Set(cells.map((cell) => cell.row))];
  const values = cells.map((cell) => cell.value).filter(known);
  const domain = extent(values);
  const width = 480 / Math.max(1, columns.length);
  const height = 220 / Math.max(1, rows.length);
  return (
    <ChartFrame
      empty={values.length === 0}
      title={title}
      table={
        <Table
          caption={`${title} data`}
          columns={[
            { header: "Row", id: "row", render: (cell: HeatGridCell) => cell.row },
            { header: "Column", id: "column", render: (cell) => cell.column },
            { header: "Value", id: "value", render: (cell) => display(cell.value) },
            { header: "Samples", id: "samples", render: (cell) => display(cell.sampleCount) },
          ]}
          getRowKey={(cell) => cell.id}
          rows={cells}
        />
      }
    >
      <g className="np-chart__label">
        {columns.map((column, index) => (
          <text key={column} x={136 + (index + 0.5) * width} y={270} textAnchor="middle">
            {column}
          </text>
        ))}
        {rows.map((row, index) => (
          <text key={row} x={128} y={24 + (index + 0.5) * height} textAnchor="end">
            {row}
          </text>
        ))}
        {values.length > 0 ? (
          <text x={136} y={292}>
            Intensity: {display(domain[0])} – {display(domain[1])}
          </text>
        ) : null}
      </g>
      <g style={{ color: colorValue(color) }}>
        {cells.map((cell) => (
          <rect
            key={cell.id}
            x={136 + columns.indexOf(cell.column) * width}
            y={24 + rows.indexOf(cell.row) * height}
            width={Math.max(0, width - 2)}
            height={Math.max(0, height - 2)}
            fill="currentColor"
            fillOpacity={known(cell.value) ? scale(cell.value, domain, 0.2, 1) : 0}
          >
            <title>{`${cell.row}, ${cell.column}: ${display(cell.value)}; samples: ${display(cell.sampleCount)}`}</title>
          </rect>
        ))}
      </g>
    </ChartFrame>
  );
}
