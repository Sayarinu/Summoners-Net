import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { Progress } from "./internal.js";
import { cx, Icon } from "./internal.js";
import { Navigation } from "./navigation.js";
import type { NavigationItem } from "./navigation.js";
import { Dialog } from "./overlays.js";
import { Button, Callout, StatusIndicator } from "./primitives.js";

export interface AdminNavigationProps {
  readonly currentHref: string;
  readonly items: readonly (NavigationItem & { readonly allowed?: boolean })[];
}

export function AdminNavigation({ currentHref, items }: AdminNavigationProps) {
  return (
    <div className="np-admin-navigation">
      <div className="np-admin-navigation__brand">
        <Icon icon={ShieldCheck} size="medium" />
        <span>
          <strong>NEXUS PULSE</strong>
          <small>Operations</small>
        </span>
      </div>
      <Navigation
        currentHref={currentHref}
        items={items.filter((item) => item.allowed !== false)}
        label="Administration"
      />
    </div>
  );
}

export interface AdminShellProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly navigation: ReactNode;
  readonly notice?: ReactNode;
  readonly title: string;
}

export function AdminShell({
  actions,
  children,
  eyebrow = "Operations",
  navigation,
  notice,
  title,
}: AdminShellProps) {
  return (
    <div className="np-admin-shell">
      <aside>{navigation}</aside>
      <main id="main-content">
        {notice}
        <header className="np-admin-shell__header">
          <div>
            <span className="np-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          <div>{actions}</div>
        </header>
        <div className="np-admin-shell__content">{children}</div>
      </main>
    </div>
  );
}

export type FreshnessState = "delayed" | "fresh" | "stale" | "unknown";

export interface DataFreshnessBannerProps {
  readonly ageLabel: string;
  readonly lastUpdated: string;
  readonly onRefresh?: () => void;
  readonly provider?: string;
  readonly state: FreshnessState;
}

export function DataFreshnessBanner({
  ageLabel,
  lastUpdated,
  onRefresh,
  provider,
  state,
}: DataFreshnessBannerProps) {
  const tone = state === "fresh" ? "success" : state === "unknown" ? "neutral" : "warning";
  return (
    <Callout
      actions={
        onRefresh ? (
          <Button
            onPress={onRefresh}
            size="small"
            startIcon={<Icon icon={RefreshCw} size="small" />}
          >
            Refresh
          </Button>
        ) : null
      }
      title={
        state === "fresh"
          ? "Data is current"
          : state === "unknown"
            ? "Freshness unknown"
            : "Data freshness degraded"
      }
      tone={tone}
    >
      <p>
        {provider ? `${provider} · ` : null}
        <time dateTime={lastUpdated}>{ageLabel}</time>
      </p>
    </Callout>
  );
}

export type ProviderState = "degraded" | "disabled" | "healthy" | "outage" | "unconfigured";

export interface ProviderHealthProps {
  readonly details?: readonly { readonly label: string; readonly value: ReactNode }[];
  readonly lastSuccess?: string;
  readonly name: string;
  readonly onOpen?: () => void;
  readonly state: ProviderState;
}

export function ProviderHealth({
  details = [],
  lastSuccess,
  name,
  onOpen,
  state,
}: ProviderHealthProps) {
  const tone =
    state === "healthy"
      ? "success"
      : state === "degraded"
        ? "warning"
        : state === "outage"
          ? "danger"
          : "neutral";
  return (
    <article className={cx("np-provider-health", `np-provider-health--${state}`)}>
      <div className="np-provider-health__lead">
        <Icon icon={ServerCog} size="medium" />
        <div>
          <h3>{name}</h3>
          <StatusIndicator label={state} tone={tone} />
        </div>
      </div>
      <dl>
        {lastSuccess ? (
          <div>
            <dt>Last success</dt>
            <dd>{lastSuccess}</dd>
          </div>
        ) : null}
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
      {onOpen ? (
        <Button onPress={onOpen} size="small" variant="ghost">
          View Provider
        </Button>
      ) : null}
    </article>
  );
}

export type RunState = "cancelled" | "failed" | "queued" | "running" | "succeeded";

export interface IngestionRunRowProps {
  readonly duration?: string;
  readonly id: string;
  readonly onCancel?: () => void;
  readonly onOpen?: () => void;
  readonly onRetry?: () => void;
  readonly progress?: number;
  readonly provider: string;
  readonly startedAt: string;
  readonly state: RunState;
}

export function IngestionRunRow({
  duration,
  id,
  onCancel,
  onOpen,
  onRetry,
  progress,
  provider,
  startedAt,
  state,
}: IngestionRunRowProps) {
  const tone =
    state === "succeeded"
      ? "success"
      : state === "failed"
        ? "danger"
        : state === "running"
          ? "info"
          : "neutral";
  return (
    <article className="np-ingestion-run">
      <div className="np-ingestion-run__icon">
        <Icon
          icon={state === "succeeded" ? CheckCircle2 : state === "failed" ? XCircle : Database}
          size="medium"
        />
      </div>
      <div className="np-ingestion-run__summary">
        <div className="np-ingestion-run__identity">
          <span className="np-mono">{id}</span>
          <strong>{provider}</strong>
        </div>
        <StatusIndicator label={state} tone={tone} />
      </div>
      <div className="np-ingestion-run__time">
        <time dateTime={startedAt}>{startedAt}</time>
        {duration ? <span>{duration}</span> : null}
      </div>
      <div className="np-ingestion-run__progress">
        {state === "running" && progress !== undefined ? (
          <Progress label="Run progress" value={progress} />
        ) : null}
      </div>
      <div className="np-row-actions">
        {state === "failed" && onRetry ? (
          <Button onPress={onRetry} size="compact" variant="secondary">
            Retry
          </Button>
        ) : null}
        {state === "running" && onCancel ? (
          <Button onPress={onCancel} size="compact" variant="ghost">
            Cancel
          </Button>
        ) : null}
        {onOpen ? (
          <Button onPress={onOpen} size="compact" variant="ghost">
            Details
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export interface OperationEvent {
  readonly description?: ReactNode;
  readonly id: string;
  readonly label: string;
  readonly state: "failure" | "info" | "running" | "success" | "warning";
  readonly timestamp: string;
}

export function OperationTimeline({
  events,
  title = "Operation timeline",
}: {
  readonly events: readonly OperationEvent[];
  readonly title?: string;
}) {
  return (
    <section className="np-operation-timeline">
      <header>
        <Icon icon={History} size="medium" />
        <h3>{title}</h3>
      </header>
      <ol>
        {events.map((event) => (
          <li className={`np-operation-event--${event.state}`} key={event.id}>
            <span aria-hidden="true" className="np-operation-timeline__marker" />
            <div>
              <strong>{event.label}</strong>
              {event.description ? <div>{event.description}</div> : null}
            </div>
            <time dateTime={event.timestamp}>{event.timestamp}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface ApprovalDialogProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly onApprove: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly title: string;
  readonly trigger?: ReactNode;
}

export function ApprovalDialog({
  children,
  description,
  onApprove,
  onOpenChange,
  open,
  title,
  trigger,
}: ApprovalDialogProps) {
  return (
    <Dialog
      description={description}
      footer={
        <div className="np-dialog-actions">
          <Button onPress={onApprove} variant="primary">
            Approve
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
      trigger={trigger}
    >
      <div className="np-approval-summary">{children}</div>
    </Dialog>
  );
}

export interface DestructiveActionDialogProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly title: string;
  readonly trigger?: ReactNode;
}

export function DestructiveActionDialog({
  children,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  trigger,
}: DestructiveActionDialogProps) {
  return (
    <Dialog
      description={description}
      footer={
        <div className="np-dialog-actions">
          <Button onPress={onConfirm} variant="danger">
            Confirm Destructive Action
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
      trigger={trigger}
    >
      <div className="np-destructive-summary">
        <Icon icon={AlertOctagon} size="large" />
        {children}
      </div>
    </Dialog>
  );
}

export interface AuditEventRowProps {
  readonly action: string;
  readonly actor: string;
  readonly detail?: ReactNode;
  readonly outcome?: "failure" | "success";
  readonly target: string;
  readonly timestamp: string;
}

export function AuditEventRow({
  action,
  actor,
  detail,
  outcome = "success",
  target,
  timestamp,
}: AuditEventRowProps) {
  return (
    <article className="np-audit-event">
      <div className="np-audit-event__icon">
        <Icon icon={outcome === "success" ? ShieldCheck : AlertTriangle} size="medium" />
      </div>
      <div>
        <strong>{action}</strong>
        <span>
          {actor} · {target}
        </span>
      </div>
      {detail ? <div className="np-audit-event__detail">{detail}</div> : null}
      <StatusIndicator label={outcome} tone={outcome === "success" ? "success" : "danger"} />
      <time dateTime={timestamp}>{timestamp}</time>
    </article>
  );
}

export interface IncidentSummaryProps {
  readonly affected?: readonly string[];
  readonly children?: ReactNode;
  readonly id: string;
  readonly severity: "critical" | "major" | "minor";
  readonly startedAt: string;
  readonly status: "identified" | "investigating" | "monitoring" | "resolved";
  readonly title: string;
}

export function IncidentSummary({
  affected = [],
  children,
  id,
  severity,
  startedAt,
  status,
  title,
}: IncidentSummaryProps) {
  const tone = status === "resolved" ? "success" : severity === "minor" ? "warning" : "danger";
  return (
    <article className={cx("np-incident", `np-incident--${severity}`)}>
      <header>
        <div>
          <span className="np-eyebrow">Incident {id}</span>
          <h3>{title}</h3>
        </div>
        <StatusIndicator label={status} tone={tone} />
      </header>
      <dl>
        <div>
          <dt>Severity</dt>
          <dd>{severity}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={startedAt}>{startedAt}</time>
          </dd>
        </div>
        {affected.length > 0 ? (
          <div>
            <dt>Affected</dt>
            <dd>{affected.join(", ")}</dd>
          </div>
        ) : null}
      </dl>
      {children ? <div className="np-incident__body">{children}</div> : null}
      <footer>
        <Icon icon={Activity} size="small" />
        Updates are shown in chronological order.
      </footer>
    </article>
  );
}
