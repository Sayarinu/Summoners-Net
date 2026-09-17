import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./primitives.js";
import {
  AccessDenied,
  AdminAuth,
  AuditEventDetail,
  AuditExport,
  AuditFilters,
  ConflictQueue,
  ConflictingSource,
  DataQualityNotice,
  FieldDiff,
  FieldProvenance,
  FreshnessStamp,
  IncidentEditor,
  IncidentHistory,
  IncidentUpdateComposer,
  LogViewer,
  MaintenanceNotice,
  OfficialSourceLink,
  OperationsEmptyState,
  OverrideEditor,
  ProviderForm,
  ProviderUnavailable,
  PublishWorkflow,
  Reauthentication,
  ReliabilityCodeSample,
  RunDetail,
  ServiceStatusRow,
  SessionExpired,
  SourceAttribution,
  SystemStatusHeader,
  TraceCorrelationDetail,
  UptimeHistory,
} from "./reliability-operations.js";
import type { UptimeDay } from "./reliability-operations.js";
import "./reliability-operations.css";
import "./review.stories.css";

const noop = () => undefined;

const uptimeDays: readonly UptimeDay[] = Array.from({ length: 60 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 4, 12 + index)).toISOString().slice(0, 10),
  label: `${60 - index} days ago`,
  status:
    index === 17
      ? "outage"
      : index === 18 || index === 42
        ? "degraded"
        : index === 36
          ? "maintenance"
          : "operational",
}));

function GalleryHeader({
  index,
  summary,
  title,
}: {
  readonly index: string;
  readonly summary: string;
  readonly title: string;
}) {
  return (
    <header className="np-review__masthead">
      <div>
        <span className="np-eyebrow">Reliability &amp; operations / {index}</span>
        <h1>{title}</h1>
      </div>
      <p>{summary}</p>
    </header>
  );
}

function ProvenanceGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="01"
          summary="Every important value can explain where it came from, when it was observed, and whether it is safe to trust."
          title="Evidence, not assertions"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SourceAttribution</span>
            <h2>Record evidence</h2>
          </header>
          <div className="np-review__stack">
            <SourceAttribution
              href="https://lolesports.com"
              official
              recordId="match_7F2A19"
              retrievedAt="2026-07-10T18:42:12-04:00"
              retrievedLabel="Observed 18 seconds ago"
              source="LoL Esports official schedule"
            >
              Normalized against the canonical event and team directory.
            </SourceAttribution>
            <SourceAttribution
              recordId="fallback:SOOP-INV-22"
              retrievedAt="2026-07-10T18:28:00-04:00"
              retrievedLabel="Observed 14 minutes ago"
              source="Tournament organizer feed"
            />
            <div className="np-review__row">
              <OfficialSourceLink href="https://lolesports.com" source="LoL Esports">
                Verify on LoL Esports
              </OfficialSourceLink>
              <FreshnessStamp
                label="Updated 18 seconds ago"
                state="fresh"
                updatedAt="2026-07-10T18:42:12-04:00"
              />
              <FreshnessStamp
                compact
                label="Updated 18 minutes ago"
                state="stale"
                updatedAt="2026-07-10T18:24:00-04:00"
              />
            </div>
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">DataQualityNotice</span>
            <h2>Trust states</h2>
          </header>
          <div className="np-review__stack">
            <DataQualityNotice state="verified" />
            <DataQualityNotice
              issues={[
                {
                  field: "startTime",
                  id: "time",
                  label: "Two official sources report different times.",
                },
                {
                  detail: "Roster feed has not confirmed the substitution.",
                  field: "blueTeam.top",
                  id: "player",
                  label: "Starting player is disputed.",
                },
              ]}
              actions={<Button size="small">Inspect Evidence</Button>}
              state="conflicted"
            />
            <DataQualityNotice
              issues={[
                {
                  detail: "Series score is confirmed; individual game durations are pending.",
                  id: "partial",
                  label: "3 of 5 games available",
                },
              ]}
              state="partial"
            />
            <DataQualityNotice state="estimated" />
            <DataQualityNotice state="unavailable" />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">FieldProvenance</span>
            <h2>Field history</h2>
          </header>
          <div>
            <FieldProvenance
              confidence={100}
              field="series.startTime"
              official
              source="LoL Esports"
              sourceHref="https://lolesports.com"
              updatedAt="2026-07-10T18:42:12-04:00"
              updatedLabel="18 seconds ago"
              value="20:00 EDT"
            />
            <FieldProvenance
              confidence={82}
              field="roster.top"
              source="Tournament organizer"
              updatedAt="2026-07-10T18:28:00-04:00"
              updatedLabel="14 minutes ago"
              value="Doran"
            />
            <FieldProvenance
              field="venue"
              overriddenBy="Carter · 18:36"
              source="League feed"
              updatedAt="2026-07-10T18:10:00-04:00"
              updatedLabel="32 minutes ago"
              value="LoL Park"
            />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Reliability states</span>
            <h2>Failure and conflict</h2>
          </header>
          <div className="np-review__stack">
            <ProviderUnavailable
              fallbackLabel="Last verified snapshot from 18:12"
              onRetry={noop}
              provider="Live telemetry"
              scope="Champion picks and live gold totals may be delayed. The match schedule remains available."
            />
            <ConflictingSource
              candidates={[
                { observedAt: "18:41:28", source: "LoL Esports", value: "20:00 EDT" },
                { observedAt: "18:41:31", source: "Organizer feed", value: "20:30 EDT" },
              ]}
              field="start time"
              onReview={noop}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function AccessAndProviderGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="02"
          summary="Secure states are specific about authorization, session continuity, secret handling, and the consequences of each action."
          title="Controlled access"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">AdminAuth</span>
            <h2>Operator sign-in</h2>
          </header>
          <div className="np-review__frame">
            <AdminAuth onAuthenticate={noop} onSso={noop} />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Access states</span>
            <h2>Permission boundaries</h2>
          </header>
          <div className="np-review__stack">
            <AccessDenied
              onRequestAccess={noop}
              requiredRole="Reliability administrator"
              resource="provider secrets"
            />
            <SessionExpired onSignIn={noop} returnPath="Unsaved provider configuration" />
            <Reauthentication
              onCancel={noop}
              onConfirm={noop}
              reason="Reauthentication is required before replacing a provider secret."
            />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">ProviderForm</span>
            <h2>Configuration and priority</h2>
          </header>
          <ProviderForm
            initialValues={{
              baseUrl: "https://feed.example/v2",
              name: "Official schedule",
              providerType: "schedule",
            }}
            onCancel={noop}
            onPriorityMove={noop}
            onSubmit={noop}
            priorities={[
              { id: "official", name: "LoL Esports official", state: "healthy" },
              { id: "organizer", name: "Tournament organizer", state: "healthy" },
              { id: "fallback", name: "Community fallback", state: "unavailable" },
            ]}
            secretConfigured
          />
        </section>
      </div>
    </main>
  );
}

const conflicts = [
  {
    entity: "T1 vs Gen.G · Game 1",
    fieldCount: 3,
    id: "conflict-1",
    receivedAt: "18:41:31",
    severity: "high" as const,
    sources: ["LoL Esports", "Organizer"],
  },
  {
    entity: "SOOP Invitational · Final",
    fieldCount: 1,
    id: "conflict-2",
    receivedAt: "18:38:10",
    severity: "medium" as const,
    sources: ["Organizer", "Stream"],
  },
  {
    entity: "Hanwha Life roster",
    fieldCount: 2,
    id: "conflict-3",
    receivedAt: "18:20:02",
    severity: "low" as const,
    sources: ["Team", "League"],
  },
];

function ReconciliationGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="03"
          summary="Ambiguous data moves through a deliberate queue, comparison, override, preview, and publication sequence."
          title="Reconcile with confidence"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">ConflictQueue</span>
            <h2>Prioritized review</h2>
          </header>
          <ConflictQueue items={conflicts} onSelect={noop} selectedId="conflict-1" />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">FieldDiff</span>
            <h2>Value selection</h2>
          </header>
          <FieldDiff
            onResolutionChange={noop}
            rows={[
              {
                candidate: "20:30 EDT",
                canonical: "20:00 EDT",
                field: "Start time",
                id: "start",
                resolution: "canonical",
                source: "Organizer",
              },
              {
                candidate: "Doran",
                canonical: "Zeus",
                field: "Blue top",
                id: "top",
                resolution: "candidate",
                source: "Team roster",
              },
              {
                candidate: "Patch 26.13",
                canonical: "Patch 26.12",
                field: "Patch",
                id: "patch",
                resolution: "custom",
                source: "Broadcast",
              },
            ]}
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">OverrideEditor</span>
            <h2>Audited correction</h2>
          </header>
          <OverrideEditor
            currentValue="Zeus"
            entity="T1 vs Gen.G · Game 1"
            field="blueTeam.top"
            onCancel={noop}
            onSubmit={noop}
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">PublishWorkflow</span>
            <h2>Draft to production</h2>
          </header>
          <div className="np-review__stack">
            <PublishWorkflow current="draft" onPreview={noop} title="2 canonical corrections" />
            <PublishWorkflow
              current="preview"
              description={
                <div>
                  <strong>Public impact</strong>
                  <p>The live match page, team page, and API response will update.</p>
                </div>
              }
              onBackToDraft={noop}
              onPublish={noop}
              title="2 canonical corrections"
            />
            <PublishWorkflow
              current="published"
              description="Published by Carter at 18:52:07. Audit event EVT-7F2A recorded."
              title="2 canonical corrections"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

const runEvents = [
  {
    detail: "Manual run requested by Carter.",
    id: "e1",
    label: "Queued",
    outcome: "running" as const,
    timestamp: "18:58:12",
  },
  {
    detail: "200 OK · 284 KB",
    id: "e2",
    label: "Provider response received",
    outcome: "success" as const,
    timestamp: "18:58:14",
  },
  {
    detail: "36 matches normalized.",
    id: "e3",
    label: "Normalization complete",
    outcome: "success" as const,
    timestamp: "18:58:17",
  },
  {
    detail: "Roster reference player_103 was not found.",
    id: "e4",
    label: "Validation warning",
    outcome: "warning" as const,
    timestamp: "18:58:18",
  },
];

function ObservabilityGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="04"
          summary="Run state, logs, distributed traces, and immutable audit details stay dense, searchable, and correlated."
          title="Evidence for every run"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">RunDetail</span>
            <h2>Ingestion lifecycle</h2>
          </header>
          <RunDetail
            events={runEvents}
            id="run_7F2A"
            onCancel={noop}
            progress={76}
            provider="Official schedule API"
            startedAt="2026-07-10T18:58:12-04:00"
            state="running"
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">LogViewer</span>
            <h2>Structured log stream</h2>
          </header>
          <LogViewer
            entries={[
              {
                correlationId: "corr_883B",
                id: "l1",
                level: "info",
                message: "provider.fetch completed status=200 bytes=284112",
                service: "ingestion",
                timestamp: "18:58:14.228",
              },
              {
                correlationId: "corr_883B",
                id: "l2",
                level: "debug",
                message: "normalizer.schedule records=36 schema=v2",
                service: "normalizer",
                timestamp: "18:58:15.002",
              },
              {
                correlationId: "corr_883B",
                id: "l3",
                level: "warn",
                message: "reference unresolved player_id=player_103",
                service: "validator",
                timestamp: "18:58:18.420",
              },
              {
                correlationId: "corr_883B",
                id: "l4",
                level: "error",
                message: "write rejected table=roster reason=foreign_key",
                service: "persistence",
                timestamp: "18:58:18.722",
              },
            ]}
            onLevelChange={noop}
            onQueryChange={noop}
            onSelect={noop}
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">TraceCorrelationDetail</span>
            <h2>Cross-service context</h2>
          </header>
          <TraceCorrelationDetail
            correlationId="corr_883B7C21"
            duration="6.42s"
            onCopy={noop}
            spans={[
              {
                duration: "6.42s",
                id: "span_root",
                name: "POST /ingestion/runs",
                service: "operations-api",
                state: "ok",
              },
              {
                duration: "2.18s",
                id: "span_fetch",
                name: "GET /schedule",
                service: "provider-client",
                state: "ok",
              },
              {
                duration: "1.04s",
                id: "span_norm",
                name: "normalize.schedule",
                service: "normalizer",
                state: "ok",
              },
              {
                duration: "82ms",
                id: "span_write",
                name: "roster.upsert",
                service: "persistence",
                state: "error",
              },
            ]}
            startedAt="2026-07-10T18:58:12.108-04:00"
            traceId="tr_01J2F7A9D8"
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">AuditFilters + detail</span>
            <h2>Immutable actions</h2>
          </header>
          <div className="np-review__stack">
            <AuditFilters onApply={noop} onReset={noop} />
            <AuditEventDetail
              action="Published canonical override"
              actor="Carter"
              changes={[
                { after: "Doran", before: "Zeus", field: "blueTeam.top" },
                { after: "20:30 EDT", before: "20:00 EDT", field: "startTime" },
              ]}
              correlationId="corr_883B7C21"
              eventId="evt_7F2A19"
              ipAddress="192.0.2.42"
              outcome="success"
              target="match_7F2A"
              timestamp="2026-07-10T18:52:07-04:00"
            />
            <AuditExport count={284} onExport={noop} rangeLabel="Jul 1–10, 2026" />
          </div>
        </section>
      </div>
    </main>
  );
}

function IncidentOperationsGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="05"
          summary="Operators can establish incident scope, update the public narrative, and preserve a clear chronological record."
          title="Communicate under pressure"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IncidentEditor</span>
            <h2>Scope and severity</h2>
          </header>
          <IncidentEditor
            initialValues={{
              affected: "Live match telemetry, Draft insights",
              severity: "major",
              status: "monitoring",
              summary: "Telemetry is recovering after an upstream timeout increase.",
              title: "Live telemetry delayed",
            }}
            onCancel={noop}
            onSave={noop}
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IncidentUpdateComposer</span>
            <h2>Public update</h2>
          </header>
          <IncidentUpdateComposer onPublish={noop} />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">IncidentHistory</span>
            <h2>Chronological record</h2>
          </header>
          <IncidentHistory
            affected={["Live match telemetry", "Draft insights"]}
            id="INC-042"
            status="monitoring"
            title="Live telemetry delayed"
            updates={[
              {
                author: "Nexus Pulse operations",
                children:
                  "We are investigating delayed live telemetry for LCK matches. Schedule and stream playback are unaffected.",
                status: "investigating",
                timestamp: "2026-07-10T18:08:00-04:00",
                timestampLabel: "18:08 EDT",
              },
              {
                author: "Carter",
                children:
                  "The upstream provider is rate-limiting live frames. Traffic has been shifted to the verified fallback.",
                status: "identified",
                timestamp: "2026-07-10T18:19:00-04:00",
                timestampLabel: "18:19 EDT",
              },
              {
                author: "Carter",
                children:
                  "Frame latency is back within threshold. We are monitoring the next two series before resolving.",
                status: "monitoring",
                timestamp: "2026-07-10T18:42:00-04:00",
                timestampLabel: "18:42 EDT",
              },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

function PublicStatusGallery() {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <GalleryHeader
          index="06"
          summary="A restrained status surface communicates current health first, then service-level evidence, history, and incident context."
          title="Operational clarity"
        />
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">SystemStatusHeader</span>
            <h2>Overall state</h2>
          </header>
          <div className="np-review__stack">
            <SystemStatusHeader
              checkedAt="2026-07-10T18:59:48-04:00"
              checkedLabel="Checked 12 seconds ago"
              health="operational"
            />
            <SystemStatusHeader
              checkedAt="2026-07-10T18:59:48-04:00"
              checkedLabel="Checked 12 seconds ago"
              health="partial-outage"
              message="Live telemetry is delayed for some LCK matches. Schedules, streams, and team data remain available."
            />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">ServiceStatusRow</span>
            <h2>Service health</h2>
          </header>
          <div className="np-review__frame">
            <ServiceStatusRow
              description="Fixtures, results, and event stages"
              latency="184ms"
              name="Schedules"
              status="operational"
              uptime="99.99%"
            />
            <ServiceStatusRow
              description="In-game champions and live stats"
              latency="2.8s"
              name="Live telemetry"
              status="degraded"
              uptime="99.82%"
            />
            <ServiceStatusRow
              description="Team, player, and roster directory"
              latency="221ms"
              name="Team directory"
              status="operational"
              uptime="100%"
            />
            <ServiceStatusRow
              description="Embedded Twitch and YouTube players"
              name="Stream embeds"
              status="maintenance"
              uptime="99.94%"
            />
            <ServiceStatusRow
              description="Operator data controls"
              name="Admin operations"
              status="major-outage"
              uptime="99.71%"
            />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">UptimeHistory</span>
            <h2>Recent reliability</h2>
          </header>
          <div>
            <UptimeHistory days={uptimeDays} service="Schedules" uptime="99.99%" />
            <UptimeHistory
              days={uptimeDays.map((day, index) =>
                index === 54 ? { ...day, status: "outage" } : day,
              )}
              service="Live telemetry"
              uptime="99.82%"
            />
            <UptimeHistory
              days={uptimeDays.map((day) => ({ ...day, status: "operational" }))}
              service="Team directory"
              uptime="100%"
            />
          </div>
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">MaintenanceNotice</span>
            <h2>Planned work</h2>
          </header>
          <MaintenanceNotice
            affected={["Admin operations", "Provider ingestion"]}
            description={
              <p>
                Database maintenance will pause provider writes. Public data will remain readable
                from the last verified snapshot.
              </p>
            }
            endsAt="2026-07-14T03:30:00-04:00"
            endsLabel="03:30 EDT"
            startsAt="2026-07-14T03:00:00-04:00"
            startsLabel="Jul 14 at 03:00 EDT"
            title="PostgreSQL minor version upgrade"
          />
        </section>
        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Supporting states</span>
            <h2>Empty and technical detail</h2>
          </header>
          <div className="np-review__stack">
            <OperationsEmptyState
              title="No active incidents"
              description="All reported incidents are resolved. Historical records remain available."
            />
            <ReliabilityCodeSample label="Provider response excerpt">{`GET /v2/schedule 200\nrequest-id: req_7F2A\nage: 18s`}</ReliabilityCodeSample>
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  title: "Reliability & Operations/Component Galleries",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProvenanceAndQuality: Story = { render: () => <ProvenanceGallery /> };
export const AccessAndProviders: Story = { render: () => <AccessAndProviderGallery /> };
export const ReconciliationAndPublication: Story = { render: () => <ReconciliationGallery /> };
export const ObservabilityAndAudit: Story = { render: () => <ObservabilityGallery /> };
export const IncidentOperations: Story = { render: () => <IncidentOperationsGallery /> };
export const PublicSystemStatus: Story = { render: () => <PublicStatusGallery /> };
