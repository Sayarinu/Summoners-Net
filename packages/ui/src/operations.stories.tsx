import {
  Activity,
  Database,
  FileCheck2,
  Gauge,
  Radio,
  Settings,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./internal.js";
import {
  AdminNavigation,
  AdminShell,
  ApprovalDialog,
  AuditEventRow,
  DataFreshnessBanner,
  DestructiveActionDialog,
  IncidentSummary,
  IngestionRunRow,
  OperationTimeline,
  ProviderHealth,
} from "./operations.js";
import { Button, MetaText } from "./primitives.js";
import "./review.stories.css";

const noop = () => undefined;

const adminNavigation = (
  <AdminNavigation
    currentHref="/providers"
    items={[
      { href: "/overview", icon: <Icon icon={Gauge} size="small" />, label: "Overview" },
      { href: "/providers", icon: <Icon icon={Radio} size="small" />, label: "Providers" },
      {
        meta: <MetaText tone="warning">2</MetaText>,
        href: "/ingestion",
        icon: <Icon icon={Database} size="small" />,
        label: "Ingestion",
      },
      { href: "/audit", icon: <Icon icon={FileCheck2} size="small" />, label: "Audit log" },
      {
        allowed: false,
        href: "/secrets",
        icon: <Icon icon={ShieldAlert} size="small" />,
        label: "Secrets",
      },
      { href: "/settings", icon: <Icon icon={Settings} size="small" />, label: "Settings" },
    ]}
  />
);

function OperationsGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Operations / 01</span>
            <h1>Reliability workspace</h1>
          </div>
          <p>
            Compact provider, ingestion, approval, incident, and audit patterns for accountable
            operations.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">AdminShell + AdminNavigation</span>
            <h2>Working surface</h2>
          </header>
          <div className="np-review__frame" style={{ height: 520, overflow: "auto" }}>
            <AdminShell
              actions={<Button variant="primary">Add Provider</Button>}
              navigation={adminNavigation}
              notice={
                <DataFreshnessBanner
                  ageLabel="Updated 18 minutes ago"
                  lastUpdated="2026-07-10T18:42:00-04:00"
                  provider="Canonical schedule"
                  state="stale"
                />
              }
              title="Provider health"
            >
              <ProviderHealth
                details={[
                  { label: "Success rate", value: "99.98%" },
                  { label: "P95 latency", value: "486ms" },
                ]}
                lastSuccess="12 seconds ago"
                name="Schedule API"
                state="healthy"
              />
              <ProviderHealth
                details={[{ label: "Freshness", value: "42s behind" }]}
                lastSuccess="2 minutes ago"
                name="Live telemetry"
                state="degraded"
              />
              <ProviderHealth
                details={[{ label: "Last error", value: "Provider timeout" }]}
                lastSuccess="26 minutes ago"
                name="Roster feed"
                state="outage"
              />
            </AdminShell>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">DataFreshnessBanner</span>
            <h2>Threshold transitions</h2>
          </header>
          <div className="np-review__stack">
            <DataFreshnessBanner
              ageLabel="Updated 12 seconds ago"
              lastUpdated="2026-07-10T18:59:48-04:00"
              provider="Schedule API"
              state="fresh"
            />
            <DataFreshnessBanner
              ageLabel="Updated 4 minutes ago"
              lastUpdated="2026-07-10T18:56:00-04:00"
              onRefresh={noop}
              provider="Live telemetry"
              state="delayed"
            />
            <DataFreshnessBanner
              ageLabel="No successful update recorded"
              lastUpdated="2026-07-10T18:00:00-04:00"
              provider="New provider"
              state="unknown"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">ProviderHealth</span>
            <h2>Configured states</h2>
          </header>
          <div className="np-review__stack">
            <ProviderHealth
              lastSuccess="12 seconds ago"
              name="Schedule API"
              onOpen={noop}
              state="healthy"
            />
            <ProviderHealth
              lastSuccess="4 minutes ago"
              name="Live telemetry"
              onOpen={noop}
              state="degraded"
            />
            <ProviderHealth
              lastSuccess="28 minutes ago"
              name="Roster feed"
              onOpen={noop}
              state="outage"
            />
            <ProviderHealth name="Optional statistics feed" state="disabled" />
            <ProviderHealth name="Prediction service" state="unconfigured" />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IngestionRunRow</span>
            <h2>Run lifecycle</h2>
          </header>
          <div className="np-review__frame">
            <IngestionRunRow
              id="run_7F2A"
              onCancel={noop}
              onOpen={noop}
              progress={68}
              provider="Schedule API"
              startedAt="18:58:12"
              state="running"
            />
            <IngestionRunRow
              duration="42s"
              id="run_7F29"
              onOpen={noop}
              provider="Roster feed"
              startedAt="18:54:04"
              state="succeeded"
            />
            <IngestionRunRow
              duration="12s"
              id="run_7F28"
              onOpen={noop}
              onRetry={noop}
              provider="Live telemetry"
              startedAt="18:51:16"
              state="failed"
            />
            <IngestionRunRow
              id="run_7F27"
              onOpen={noop}
              provider="Standings feed"
              startedAt="18:48:00"
              state="queued"
            />
            <IngestionRunRow
              duration="3s"
              id="run_7F26"
              onOpen={noop}
              provider="Event feed"
              startedAt="18:40:00"
              state="cancelled"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">OperationTimeline</span>
            <h2>Chronological evidence</h2>
          </header>
          <OperationTimeline
            events={[
              {
                description: "Manual reconciliation requested by an authorized operator.",
                id: "e1",
                label: "Run queued",
                state: "info",
                timestamp: "18:58:12",
              },
              {
                description: "Fetched 36 matches across four event stages.",
                id: "e2",
                label: "Provider fetch completed",
                state: "success",
                timestamp: "18:58:18",
              },
              {
                description: "Two schedule conflicts require canonical review.",
                id: "e3",
                label: "Validation warning",
                state: "warning",
                timestamp: "18:58:21",
              },
              {
                description: "Awaiting operator approval before publication.",
                id: "e4",
                label: "Publication paused",
                state: "running",
                timestamp: "18:58:22",
              },
            ]}
          />
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Approval + Destructive dialogs</span>
            <h2>High-impact decisions</h2>
          </header>
          <div className="np-review__row">
            <ApprovalDialog
              description="This will publish two corrected match times to the public schedule."
              onApprove={noop}
              title="Approve schedule correction"
              trigger={<Button variant="primary">Review Approval</Button>}
            >
              <p>2 matches corrected · 1 provider discrepancy retained in the audit trail.</p>
            </ApprovalDialog>
            <DestructiveActionDialog
              description="This provider and its credentials will be revoked. Historical audit data will remain."
              onConfirm={noop}
              title="Remove roster provider"
              trigger={
                <Button startIcon={<Icon icon={Trash2} size="small" />} variant="danger">
                  Remove Provider
                </Button>
              }
            >
              <p>Roster Feed · 4 active competitions · 128 linked players</p>
            </DestructiveActionDialog>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">AuditEventRow</span>
            <h2>Immutable action summary</h2>
          </header>
          <div className="np-review__frame">
            <AuditEventRow
              action="Approved schedule correction"
              actor="Carter Garcia"
              detail="2 public values changed"
              target="Worlds 2026"
              timestamp="18:58:24"
            />
            <AuditEventRow
              action="Provider retry failed"
              actor="System"
              detail="Timeout after 10 seconds"
              outcome="failure"
              target="Live telemetry"
              timestamp="18:51:28"
            />
            <AuditEventRow
              action="Updated provider priority"
              actor="Carter Garcia"
              detail="Secondary → canonical"
              target="Schedule API"
              timestamp="17:42:10"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IncidentSummary</span>
            <h2>Operational incident</h2>
          </header>
          <IncidentSummary
            affected={["Live match pages", "Admin telemetry"]}
            id="INC-024"
            severity="major"
            startedAt="2026-07-10T18:31:00-04:00"
            status="monitoring"
            title="Live telemetry provider delay"
          >
            <p>
              The provider recovered at 18:47. Data freshness is being monitored before the incident
              is resolved.
            </p>
          </IncidentSummary>
        </section>

        <footer className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Signal</span>
            <h2>Operator confidence</h2>
          </header>
          <div className="np-review__row">
            <Icon icon={Activity} />
            <span>
              Every critical action is paired with system state and durable audit evidence.
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

const meta = {
  component: OperationsGallery,
  parameters: { layout: "fullscreen" },
  title: "Operations/01 Reliability workspace",
} satisfies Meta<typeof OperationsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
