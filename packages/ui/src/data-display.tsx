import { RefreshCw } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cx, Icon } from "./internal.js";
import { Button } from "./primitives.js";

export interface SkeletonProps {
  readonly height?: number | string;
  readonly radius?: "full" | "md" | "none" | "sm";
  readonly width?: number | string;
}

export function Skeleton({ height = 16, radius = "sm", width = "100%" }: SkeletonProps) {
  const style = { height, width } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      className={cx("np-skeleton", `np-skeleton--${radius}`)}
      style={style}
    />
  );
}

export interface StatePanelProps {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly compact?: boolean;
  readonly title: string;
  readonly tone?: "danger" | "neutral" | "warning";
}

export function StatePanel({
  action,
  children,
  compact = false,
  title,
  tone = "neutral",
}: StatePanelProps) {
  return (
    <section
      className={cx(
        "np-state-panel",
        `np-state-panel--${tone}`,
        compact && "np-state-panel--compact",
      )}
    >
      <div className="np-state-panel__body">
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
      {action ? <div className="np-state-panel__action">{action}</div> : null}
    </section>
  );
}

export function EmptyState({
  action,
  description,
  title = "Nothing here yet",
}: {
  readonly action?: ReactNode;
  readonly description: ReactNode;
  readonly title?: string;
}) {
  return (
    <StatePanel action={action} title={title}>
      {description}
    </StatePanel>
  );
}

export function ErrorState({
  description,
  onRetry,
  title = "Unable to load",
}: {
  readonly description: ReactNode;
  readonly onRetry?: () => void;
  readonly title?: string;
}) {
  return (
    <StatePanel
      action={
        onRetry ? (
          <Button onPress={onRetry} startIcon={<Icon icon={RefreshCw} size="small" />}>
            Retry
          </Button>
        ) : null
      }
      title={title}
      tone="danger"
    >
      {description}
    </StatePanel>
  );
}

export function StaleState({
  description,
  onRefresh,
  title = "Data may be stale",
}: {
  readonly description: ReactNode;
  readonly onRefresh?: () => void;
  readonly title?: string;
}) {
  return (
    <StatePanel
      action={
        onRefresh ? (
          <Button onPress={onRefresh} startIcon={<Icon icon={RefreshCw} size="small" />}>
            Refresh
          </Button>
        ) : null
      }
      compact
      title={title}
      tone="warning"
    >
      {description}
    </StatePanel>
  );
}

export interface TableColumn<Row> {
  readonly align?: "center" | "end" | "start";
  readonly header: string;
  readonly id: string;
  readonly render: (row: Row) => ReactNode;
  readonly width?: string;
}

export interface TableProps<Row> {
  readonly caption: string;
  readonly className?: string;
  readonly columns: readonly TableColumn<Row>[];
  readonly compact?: boolean;
  readonly emptyMessage?: string;
  readonly getRowKey: (row: Row) => string;
  readonly loading?: boolean;
  readonly rows: readonly Row[];
}

export function Table<Row>({
  caption,
  className,
  columns,
  compact = false,
  emptyMessage = "No rows to display",
  getRowKey,
  loading = false,
  rows,
}: TableProps<Row>) {
  return (
    <div aria-label={caption} className={cx("np-table-wrap", className)} role="region" tabIndex={0}>
      <table className={cx("np-table", compact && "np-table--compact")}>
        <caption className="np-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={cx(column.align && `np-align--${column.align}`)}
                key={column.id}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={loading}>
          {loading
            ? Array.from({ length: 4 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`}>
                  {columns.map((column) => (
                    <td key={column.id}>
                      <Skeleton height={12} width={rowIndex % 2 === 0 ? "72%" : "54%"} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td className={cx(column.align && `np-align--${column.align}`)} key={column.id}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className="np-table__empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export interface StatBlockProps {
  readonly change?: string;
  readonly changeTone?: "danger" | "neutral" | "success";
  readonly detail?: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
}

export function StatBlock({
  change,
  changeTone = "neutral",
  detail,
  label,
  value,
}: StatBlockProps) {
  return (
    <div className="np-stat-block">
      <span className="np-stat-block__label">{label}</span>
      <strong>{value}</strong>
      <div className="np-stat-block__meta">
        {change ? <span className={`np-stat-change--${changeTone}`}>{change}</span> : null}
        {detail}
      </div>
    </div>
  );
}

export interface StatRow {
  readonly label: string;
  readonly value: ReactNode;
}

export function StatTable({
  caption,
  rows,
}: {
  readonly caption: string;
  readonly rows: readonly StatRow[];
}) {
  return (
    <Table
      caption={caption}
      className="np-stat-table"
      columns={[
        { header: "Metric", id: "metric", render: (row) => row.label },
        { align: "end", header: "Value", id: "value", render: (row) => row.value },
      ]}
      compact
      getRowKey={(row) => row.label}
      rows={rows}
    />
  );
}

export interface SparklineProps {
  readonly label: string;
  readonly tone?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly values: readonly number[];
}

export function Sparkline({ label, tone = 1, values }: SparklineProps) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const denominator = Math.max(values.length - 1, 1);
  const points = values
    .map((value, index) => `${(index / denominator) * 100},${36 - ((value - min) / range) * 32}`)
    .join(" ");

  return (
    <svg aria-label={label} className="np-sparkline" role="img" viewBox="0 0 100 40">
      <polyline
        className={`np-chart-stroke--${tone}`}
        fill="none"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface TrendChartShellProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description?: string;
  readonly legend?: ReactNode;
  readonly title: string;
}

export function TrendChartShell({
  actions,
  children,
  description,
  legend,
  title,
}: TrendChartShellProps) {
  return (
    <figure className="np-trend-chart">
      <figcaption>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions}
      </figcaption>
      <div className="np-trend-chart__plot">{children}</div>
      {legend ? <div className="np-trend-chart__legend">{legend}</div> : null}
    </figure>
  );
}
