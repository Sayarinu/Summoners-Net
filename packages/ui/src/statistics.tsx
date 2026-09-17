"use client";

import {
  AlertTriangle,
  BarChart3,
  Database,
  Info,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton, StatePanel, Table } from "./data-display.js";
import type { TableColumn } from "./data-display.js";
import { Select } from "./forms.js";
import { analyticsData, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { Tooltip } from "./overlays.js";
import { Button, TextLink } from "./primitives.js";

export interface StatisticFilterOption {
  readonly label: string;
  readonly value: string;
}

export interface StatisticsToolbarProps extends AnalyticsProps {
  readonly filters: readonly {
    readonly id: string;
    readonly label: string;
    readonly options: readonly StatisticFilterOption[];
    readonly value: string;
  }[];
  readonly onChange?: (id: string, value: string) => void;
  readonly summary?: ReactNode;
}

export function StatisticsToolbar({
  analyticsId,
  filters,
  onChange,
  summary,
}: StatisticsToolbarProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Statistics filters"
      className="np-statistics-toolbar"
    >
      <div className="np-statistics-toolbar__filters">
        {filters.map((filter) => (
          <Select
            key={filter.id}
            label={filter.label}
            {...(onChange ? { onValueChange: (value) => onChange(filter.id, value) } : {})}
            options={filter.options}
            value={filter.value}
          />
        ))}
      </div>
      {summary ? <div className="np-statistics-toolbar__summary">{summary}</div> : null}
    </section>
  );
}

export interface ComparisonMetric {
  readonly better?: "a" | "b" | "equal";
  readonly label: string;
  readonly valueA: string;
  readonly valueB: string;
}

export interface ComparisonPanelProps extends AnalyticsProps {
  readonly entityA: ReactNode;
  readonly entityB: ReactNode;
  readonly metrics: readonly ComparisonMetric[];
  readonly title: string;
}

export function ComparisonPanel({
  analyticsId,
  entityA,
  entityB,
  metrics,
  title,
}: ComparisonPanelProps) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={title} className="np-comparison-panel">
      <header>
        <Icon icon={Scale} />
        <h2>{title}</h2>
      </header>
      <div className="np-comparison-panel__entities">
        <div>{entityA}</div>
        <span aria-hidden="true">VS</span>
        <div>{entityB}</div>
      </div>
      <table>
        <caption className="np-visually-hidden">{title} metric comparison</caption>
        <thead>
          <tr>
            <th scope="col">Entity A</th>
            <th scope="col">Metric</th>
            <th scope="col">Entity B</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label}>
              <td className={cx(metric.better === "a" && "is-better")}>{metric.valueA}</td>
              <th scope="row">{metric.label}</th>
              <td className={cx(metric.better === "b" && "is-better")}>{metric.valueB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export interface RankingRow {
  readonly change?: number;
  readonly entity: ReactNode;
  readonly id: string;
  readonly note?: string;
  readonly rank: number;
  readonly value: string;
}

export function RankingTable({
  analyticsId,
  caption,
  metricLabel,
  rows,
}: AnalyticsProps & {
  readonly caption: string;
  readonly metricLabel: string;
  readonly rows: readonly RankingRow[];
}) {
  const columns: readonly TableColumn<RankingRow>[] = [
    {
      header: "Rank",
      id: "rank",
      render: (row) => <strong className="np-mono">{row.rank}</strong>,
      width: "72px",
    },
    {
      header: "Entity",
      id: "entity",
      render: (row) => (
        <div className="np-ranking-entity">
          {row.entity}
          {row.note ? <small>{row.note}</small> : null}
        </div>
      ),
    },
    {
      align: "end",
      header: "Change",
      id: "change",
      render: (row) =>
        row.change === undefined ? (
          "—"
        ) : (
          <span
            className={cx(
              "np-ranking-change",
              row.change > 0 && "is-up",
              row.change < 0 && "is-down",
            )}
          >
            {row.change > 0 ? `+${row.change}` : row.change}
          </span>
        ),
      width: "92px",
    },
    {
      align: "end",
      header: metricLabel,
      id: "value",
      render: (row) => <strong className="np-mono">{row.value}</strong>,
      width: "120px",
    },
  ];
  return (
    <div {...analyticsData(analyticsId)}>
      <Table caption={caption} columns={columns} getRowKey={(row) => row.id} rows={rows} />
    </div>
  );
}

export interface ChartDatum {
  readonly label: string;
  readonly value: number;
}

export interface ChartSeries {
  readonly data: readonly ChartDatum[];
  readonly label: string;
  readonly tone?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export interface AccessibleChartProps extends AnalyticsProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly note?: ReactNode;
  readonly series: readonly ChartSeries[];
  readonly title: string;
}

export function AccessibleChart({
  analyticsId,
  children,
  description,
  note,
  series,
  title,
}: AccessibleChartProps) {
  const labels = Array.from(
    new Set(series.flatMap((item) => item.data.map((datum) => datum.label))),
  );
  return (
    <figure {...analyticsData(analyticsId)} className="np-accessible-chart">
      <figcaption>
        <div>
          <span className="np-eyebrow">Chart</span>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {note}
      </figcaption>
      <div className="np-accessible-chart__plot">{children}</div>
      <div className="np-accessible-chart__legend">
        {series.map((item, index) => (
          <span key={item.label}>
            <span className={`np-chart-swatch np-chart-swatch--${item.tone ?? (index % 8) + 1}`} />
            {item.label}
          </span>
        ))}
      </div>
      <details>
        <summary>View chart data</summary>
        <div aria-label={`${title} data`} className="np-table-wrap" role="region" tabIndex={0}>
          <table className="np-table">
            <thead>
              <tr>
                <th scope="col">Period</th>
                {series.map((item) => (
                  <th scope="col" key={item.label}>
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {series.map((item) => (
                    <td key={item.label}>
                      {item.data.find((datum) => datum.label === label)?.value ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function chartRange(series: readonly ChartSeries[]) {
  const values = series.flatMap((item) => item.data.map((datum) => datum.value));
  return { max: Math.max(1, ...values), min: Math.min(0, ...values) };
}

function chartPoint(value: number, index: number, count: number, min: number, max: number) {
  const x = count <= 1 ? 320 : 48 + (index / (count - 1)) * 544;
  const y = 200 - ((value - min) / Math.max(1, max - min)) * 160;
  return { x, y };
}

export function LineChart({
  label,
  series,
}: {
  readonly label: string;
  readonly series: readonly ChartSeries[];
}) {
  const range = chartRange(series);
  return (
    <svg aria-label={label} className="np-chart np-line-chart" role="img" viewBox="0 0 640 240">
      <title>{label}</title>
      {[40, 80, 120, 160, 200].map((y) => (
        <line className="np-chart__grid" key={y} x1="48" x2="592" y1={y} y2={y} />
      ))}
      {series.map((item, seriesIndex) => {
        const points = item.data.map((datum, index) =>
          chartPoint(datum.value, index, item.data.length, range.min, range.max),
        );
        return (
          <g key={item.label}>
            <polyline
              className={`np-chart__line np-chart-stroke--${item.tone ?? (seriesIndex % 8) + 1}`}
              fill="none"
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            />
            {points.map((point, index) => (
              <circle
                className={`np-chart-fill--${item.tone ?? (seriesIndex % 8) + 1}`}
                cx={point.x}
                cy={point.y}
                key={item.data[index]?.label}
                r="3"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function BarChart({
  label,
  series,
}: {
  readonly label: string;
  readonly series: readonly ChartSeries[];
}) {
  const values = series[0]?.data ?? [];
  const max = Math.max(1, ...values.map((datum) => datum.value));
  const slot = 544 / Math.max(1, values.length);
  return (
    <svg aria-label={label} className="np-chart np-bar-chart" role="img" viewBox="0 0 640 240">
      <title>{label}</title>
      {values.map((datum, index) => {
        const height = (datum.value / max) * 160;
        return (
          <g key={datum.label}>
            <rect
              className={`np-chart-fill--${series[0]?.tone ?? 1}`}
              height={height}
              width={Math.max(16, slot - 20)}
              x={48 + index * slot + 10}
              y={200 - height}
            />
            <text
              className="np-chart__axis-label"
              textAnchor="middle"
              x={48 + index * slot + slot / 2}
              y="222"
            >
              {datum.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StackedBarChart({
  label,
  series,
}: {
  readonly label: string;
  readonly series: readonly ChartSeries[];
}) {
  const labels = series[0]?.data.map((datum) => datum.label) ?? [];
  const totals = labels.map((itemLabel) =>
    series.reduce(
      (sum, item) => sum + (item.data.find((datum) => datum.label === itemLabel)?.value ?? 0),
      0,
    ),
  );
  const max = Math.max(1, ...totals);
  const slot = 544 / Math.max(1, labels.length);
  return (
    <svg
      aria-label={label}
      className="np-chart np-stacked-bar-chart"
      role="img"
      viewBox="0 0 640 240"
    >
      <title>{label}</title>
      {labels.map((itemLabel, labelIndex) => {
        let offset = 0;
        return (
          <g key={itemLabel}>
            {series.map((item, seriesIndex) => {
              const value = item.data.find((datum) => datum.label === itemLabel)?.value ?? 0;
              const height = (value / max) * 160;
              const y = 200 - offset - height;
              offset += height;
              return (
                <rect
                  className={`np-chart-fill--${item.tone ?? (seriesIndex % 8) + 1}`}
                  height={height}
                  key={item.label}
                  width={Math.max(16, slot - 20)}
                  x={48 + labelIndex * slot + 10}
                  y={y}
                />
              );
            })}
            <text
              className="np-chart__axis-label"
              textAnchor="middle"
              x={48 + labelIndex * slot + slot / 2}
              y="222"
            >
              {itemLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DistributionChart({
  label,
  series,
}: {
  readonly label: string;
  readonly series: ChartSeries;
}) {
  const max = Math.max(1, ...series.data.map((datum) => datum.value));
  const points = series.data.map((datum, index) =>
    chartPoint(datum.value, index, series.data.length, 0, max),
  );
  const polygon = [`48,200`, ...points.map((point) => `${point.x},${point.y}`), `592,200`].join(
    " ",
  );
  return (
    <svg
      aria-label={label}
      className="np-chart np-distribution-chart"
      role="img"
      viewBox="0 0 640 240"
    >
      <title>{label}</title>
      <polygon className={`np-chart-area--${series.tone ?? 1}`} points={polygon} />
      <polyline
        className={`np-chart__line np-chart-stroke--${series.tone ?? 1}`}
        fill="none"
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
    </svg>
  );
}

export interface ChartTooltipProps {
  readonly label: string;
  readonly rows: readonly {
    readonly label: string;
    readonly tone?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    readonly value: string;
  }[];
}

export function ChartTooltip({ label, rows }: ChartTooltipProps) {
  return (
    <div className="np-chart-tooltip" role="status">
      <strong>{label}</strong>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>
              <span className={`np-chart-swatch np-chart-swatch--${row.tone ?? 1}`} />
              {row.label}
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export interface DataNoteProps extends AnalyticsProps {
  readonly sampleSize?: number;
  readonly source?: string;
  readonly sourceHref?: string;
  readonly updated?: string;
}

export function DataNote({ analyticsId, sampleSize, source, sourceHref, updated }: DataNoteProps) {
  return (
    <aside {...analyticsData(analyticsId)} className="np-data-note">
      <Icon icon={Info} size="small" />
      <span>
        {sampleSize !== undefined
          ? `Sample: ${sampleSize.toLocaleString()} games`
          : "Sample size unavailable"}
      </span>
      {source ? (
        sourceHref ? (
          <TextLink href={sourceHref}>{source}</TextLink>
        ) : (
          <span>Source: {source}</span>
        )
      ) : null}
      {updated ? <time>{updated}</time> : null}
    </aside>
  );
}

export interface SampledValueProps {
  readonly lowSampleLabel?: string;
  readonly sampleSize: number;
  readonly unavailableReason?: "no-deaths" | "no-decided-games" | "not-collected";
  readonly value: ReactNode | null;
}

export interface LowSampleMarkerProps {
  readonly label?: string;
  readonly sampleSize: number;
  readonly threshold?: number;
}

export function LowSampleMarker({
  label = "This value",
  sampleSize,
  threshold = 5,
}: LowSampleMarkerProps) {
  if (sampleSize <= 0 || sampleSize >= threshold) return null;
  const games = `${sampleSize.toLocaleString()} ${sampleSize === 1 ? "game" : "games"}`;
  return (
    <Tooltip content={`${label} is based on ${games}, below the ${threshold}-game threshold.`}>
      <Button
        aria-label={`${label}: low sample, ${games}`}
        className="np-low-sample-marker"
        size="compact"
        type="button"
        variant="ghost"
      >
        <span aria-hidden="true" className="np-low-sample-marker__dot" />
      </Button>
    </Tooltip>
  );
}

export function SampledValue({
  lowSampleLabel,
  sampleSize,
  unavailableReason,
  value,
}: SampledValueProps) {
  const fallback = {
    "no-deaths": "No deaths",
    "no-decided-games": "No decided games",
    "not-collected": "Not available",
  }[unavailableReason ?? "not-collected"];
  const displayValue = value ?? fallback;
  const lowSample = sampleSize > 0 && sampleSize < 5;
  const games = `${sampleSize.toLocaleString()} ${sampleSize === 1 ? "game" : "games"}`;
  if (lowSample) {
    const label = lowSampleLabel ?? "This value";
    return (
      <span className="np-sampled-value">
        <Tooltip content={`${label} is based on ${games}, below the 5-game threshold.`}>
          <Button
            aria-label={`${label}: low sample, ${games}`}
            className="np-low-sample-value"
            size="compact"
            type="button"
            variant="ghost"
          >
            <strong>{displayValue}</strong>
          </Button>
        </Tooltip>
      </span>
    );
  }
  return (
    <span className="np-sampled-value">
      <strong>{displayValue}</strong>
    </span>
  );
}

export interface StatisticsScopeItem {
  readonly label: string;
  readonly value: ReactNode;
}

export function StatisticsScopeDetails({
  analyticsId,
  items,
}: AnalyticsProps & { readonly items: readonly StatisticsScopeItem[] }) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Statistics scope"
      className="np-statistics-scope"
    >
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export interface StatisticsStateProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly onRetry?: () => void;
  readonly state:
    "corrected" | "empty" | "error" | "insufficient" | "loading" | "partial" | "ready" | "stale";
}

export function StatisticsState({ analyticsId, children, onRetry, state }: StatisticsStateProps) {
  if (state === "ready" || state === "partial" || state === "corrected")
    return <div {...analyticsData(analyticsId)}>{children}</div>;
  if (state === "loading")
    return (
      <div
        {...analyticsData(analyticsId)}
        aria-label="Loading statistics"
        className="np-statistics-loading"
        role="status"
      >
        <Skeleton height={32} />
        <Skeleton height={220} />
      </div>
    );
  const copy = {
    empty: [Database, "No statistics", "No records match the selected filters."],
    error: [
      AlertTriangle,
      "Statistics unavailable",
      "The statistics query could not be completed.",
    ],
    insufficient: [
      BarChart3,
      "Insufficient sample",
      "The selected cohort is too small to present a reliable summary.",
    ],
    stale: [
      TrendingUp,
      "Statistics may be stale",
      "The most recent source update is outside the freshness target.",
    ],
  } as const;
  const [, title, description] = copy[state];
  const persistent = state === "stale";
  const panel = (
    <StatePanel
      action={
        onRetry ? (
          <Button onPress={onRetry} startIcon={<Icon icon={RefreshCw} size="small" />}>
            Retry
          </Button>
        ) : undefined
      }
      compact={persistent}
      title={title}
      tone={state === "error" ? "danger" : state === "empty" ? "neutral" : "warning"}
    >
      {description}
    </StatePanel>
  );
  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx(persistent && "np-statistics-state--persistent")}
    >
      {panel}
      {persistent ? children : null}
    </div>
  );
}
