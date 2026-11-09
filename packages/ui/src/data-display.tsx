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
