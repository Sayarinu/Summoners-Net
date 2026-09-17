import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

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
  IncidentUpdate,
  IncidentUpdateComposer,
  LogViewer,
  MaintenanceNotice,
  OfficialSourceLink,
  OperationsEmptyState,
  OverrideEditor,
  ProviderForm,
  ProviderPriorityList,
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
import { Button } from "./primitives.js";
import "./reliability-operations.css";
import "./review.stories.css";

const noop = () => undefined;
const priorityItems = [
  { id: "official", name: "LoL Esports official", state: "healthy" as const },
  { id: "organizer", name: "Tournament organizer", state: "healthy" as const },
  { id: "fallback", name: "Community fallback", state: "unavailable" as const },
];
const conflictItems = [
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
];
const fieldRows = [
  {
    candidate: "20:30 EDT",
    canonical: "20:00 EDT",
    field: "Start time",
    id: "start",
    resolution: "canonical" as const,
    source: "Organizer",
  },
  {
    candidate: "Doran",
    canonical: "Zeus",
    field: "Blue top",
    id: "top",
    resolution: "candidate" as const,
    source: "Team roster",
  },
];
const runEvents = [
  {
    detail: "Manual run requested by Carter.",
    id: "e1",
    label: "Queued",
    outcome: "running" as const,
    timestamp: "18:58:12",
  },
  {
    detail: "36 matches normalized.",
    id: "e2",
    label: "Normalization complete",
    outcome: "success" as const,
    timestamp: "18:58:17",
  },
];
const uptimeDays: readonly UptimeDay[] = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-06-${String(index + 1).padStart(2, "0")}`,
  label: `${30 - index} days ago`,
  status: index === 17 ? "outage" : index === 18 ? "degraded" : "operational",
}));
const incidentUpdate = {
  author: "Nexus Pulse operations",
  children: "Live telemetry is back within threshold. We are monitoring the next two series.",
  status: "monitoring" as const,
  timestamp: "2026-07-10T18:42:00-04:00",
  timestampLabel: "18:42 EDT",
};

function ReviewStage({
  children,
  width = 900,
}: {
  readonly children: ReactNode;
  readonly width?: number;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <div className="np-review__stage" style={{ maxWidth: width }}>
          {children}
        </div>
      </div>
    </main>
  );
}
const meta = {
  parameters: { layout: "fullscreen" },
  title: "Component Inventory/06 Reliability & Operations",
} satisfies Meta;
export default meta;
interface ReviewStory {
  readonly name: string;
  readonly render: () => ReactNode;
}
// Inventory invariant: the first argument names exactly one public rendered export.
const review = (name: string, node: ReactNode, width?: number): ReviewStory => ({
  name,
  render: () => <ReviewStage {...(width === undefined ? {} : { width })}>{node}</ReviewStage>,
});

export const OfficialSourceLinkReview = review(
  "OfficialSourceLink",
  <OfficialSourceLink href="https://lolesports.com" source="LoL Esports">
    Verify on LoL Esports
  </OfficialSourceLink>,
);
export const SourceAttributionReview = review(
  "SourceAttribution",
  <SourceAttribution
    href="https://lolesports.com"
    official
    recordId="match_7F2A19"
    retrievedAt="2026-07-10T18:42:12-04:00"
    retrievedLabel="Observed 18 seconds ago"
    source="LoL Esports official schedule"
  >
    Normalized against the canonical event and team directory.
  </SourceAttribution>,
);
export const FreshnessStampReview = review(
  "FreshnessStamp",
  <div className="np-review__row">
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
  </div>,
);
export const DataQualityNoticeReview = review(
  "DataQualityNotice",
  <DataQualityNotice
    actions={<Button size="small">Inspect Evidence</Button>}
    issues={[
      { field: "startTime", id: "time", label: "Two official sources report different times." },
    ]}
    state="conflicted"
  />,
);
export const FieldProvenanceReview = review(
  "FieldProvenance",
  <FieldProvenance
    confidence={100}
    field="series.startTime"
    official
    source="LoL Esports"
    sourceHref="https://lolesports.com"
    updatedAt="2026-07-10T18:42:12-04:00"
    updatedLabel="18 seconds ago"
    value="20:00 EDT"
  />,
);
export const ProviderUnavailableReview = review(
  "ProviderUnavailable",
  <ProviderUnavailable
    fallbackLabel="Last verified snapshot from 18:12"
    onRetry={noop}
    provider="Live telemetry"
    scope="Champion picks and live gold totals may be delayed."
  />,
);
export const ConflictingSourceReview = review(
  "ConflictingSource",
  <ConflictingSource
    candidates={[
      { observedAt: "18:41:28", source: "LoL Esports", value: "20:00 EDT" },
      { observedAt: "18:41:31", source: "Organizer feed", value: "20:30 EDT" },
    ]}
    field="start time"
    onReview={noop}
  />,
);
export const AdminAuthReview = review(
  "AdminAuth",
  <AdminAuth onAuthenticate={noop} onSso={noop} />,
);
export const AccessDeniedReview = review(
  "AccessDenied",
  <AccessDenied
    onRequestAccess={noop}
    requiredRole="Reliability administrator"
    resource="provider secrets"
  />,
);
export const ReauthenticationReview = review(
  "Reauthentication",
  <Reauthentication
    onCancel={noop}
    onConfirm={noop}
    reason="Reauthentication is required before replacing a provider secret."
  />,
);
export const SessionExpiredReview = review(
  "SessionExpired",
  <SessionExpired onSignIn={noop} returnPath="Unsaved provider configuration" />,
);
export const ProviderPriorityListReview = review(
  "ProviderPriorityList",
  <ProviderPriorityList items={priorityItems} onMove={noop} />,
);
export const ProviderFormReview = review(
  "ProviderForm",
  <ProviderForm
    initialValues={{
      baseUrl: "https://feed.example/v2",
      name: "Official schedule",
      providerType: "schedule",
    }}
    onCancel={noop}
    onPriorityMove={noop}
    onSubmit={noop}
    priorities={priorityItems}
    secretConfigured
  />,
  1100,
);
export const ConflictQueueReview = review(
  "ConflictQueue",
  <ConflictQueue items={conflictItems} onSelect={noop} selectedId="conflict-1" />,
);
export const FieldDiffReview = review(
  "FieldDiff",
  <FieldDiff onResolutionChange={noop} rows={fieldRows} />,
  1100,
);
export const OverrideEditorReview = review(
  "OverrideEditor",
  <OverrideEditor
    currentValue="Zeus"
    entity="T1 vs Gen.G · Game 1"
    field="blueTeam.top"
    onCancel={noop}
    onSubmit={noop}
  />,
);
export const PublishWorkflowReview = review(
  "PublishWorkflow",
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
  />,
);
export const RunDetailReview = review(
  "RunDetail",
  <RunDetail
    events={runEvents}
    id="run_7F2A"
    onCancel={noop}
    progress={76}
    provider="Official schedule API"
    startedAt="2026-07-10T18:58:12-04:00"
    state="running"
  />,
);
export const LogViewerReview = review(
  "LogViewer",
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
        level: "warn",
        message: "reference unresolved player_id=player_103",
        service: "validator",
        timestamp: "18:58:18.420",
      },
    ]}
    onLevelChange={noop}
    onQueryChange={noop}
    onSelect={noop}
  />,
  1100,
);
export const TraceCorrelationDetailReview = review(
  "TraceCorrelationDetail",
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
        duration: "82ms",
        id: "span_write",
        name: "roster.upsert",
        service: "persistence",
        state: "error",
      },
    ]}
    startedAt="2026-07-10T18:58:12.108-04:00"
    traceId="tr_01J2F7A9D8"
  />,
);
export const AuditFiltersReview = review(
  "AuditFilters",
  <AuditFilters onApply={noop} onReset={noop} />,
);
export const AuditEventDetailReview = review(
  "AuditEventDetail",
  <AuditEventDetail
    action="Published canonical override"
    actor="Carter"
    changes={[{ after: "Doran", before: "Zeus", field: "blueTeam.top" }]}
    correlationId="corr_883B7C21"
    eventId="evt_7F2A19"
    ipAddress="192.0.2.42"
    outcome="success"
    target="match_7F2A"
    timestamp="2026-07-10T18:52:07-04:00"
  />,
);
export const AuditExportReview = review(
  "AuditExport",
  <AuditExport count={284} onExport={noop} rangeLabel="Jul 1–10, 2026" />,
);
export const IncidentEditorReview = review(
  "IncidentEditor",
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
  />,
);
export const IncidentUpdateComposerReview = review(
  "IncidentUpdateComposer",
  <IncidentUpdateComposer onPublish={noop} />,
);
export const SystemStatusHeaderReview = review(
  "SystemStatusHeader",
  <SystemStatusHeader
    checkedAt="2026-07-10T18:59:48-04:00"
    checkedLabel="Checked 12 seconds ago"
    health="partial-outage"
    message="Live telemetry is delayed for some LCK matches."
  />,
  1100,
);
export const ServiceStatusRowReview = review(
  "ServiceStatusRow",
  <ServiceStatusRow
    description="In-game champions and live stats"
    latency="2.8s"
    name="Live telemetry"
    status="degraded"
    uptime="99.82%"
  />,
);
export const UptimeHistoryReview = review(
  "UptimeHistory",
  <UptimeHistory days={uptimeDays} service="Live telemetry" uptime="99.82%" />,
);
export const MaintenanceNoticeReview = review(
  "MaintenanceNotice",
  <MaintenanceNotice
    affected={["Admin operations", "Provider ingestion"]}
    description={<p>Database maintenance will pause provider writes.</p>}
    endsAt="2026-07-14T03:30:00-04:00"
    endsLabel="03:30 EDT"
    startsAt="2026-07-14T03:00:00-04:00"
    startsLabel="Jul 14 at 03:00 EDT"
    title="PostgreSQL minor version upgrade"
  />,
);
export const IncidentUpdateReview = review(
  "IncidentUpdate",
  <IncidentUpdate {...incidentUpdate} />,
);
export const IncidentHistoryReview = review(
  "IncidentHistory",
  <IncidentHistory
    affected={["Live match telemetry", "Draft insights"]}
    id="INC-042"
    status="monitoring"
    title="Live telemetry delayed"
    updates={[incidentUpdate]}
  />,
);
export const OperationsEmptyStateReview = review(
  "OperationsEmptyState",
  <OperationsEmptyState
    description="All reported incidents are resolved."
    title="No active incidents"
  />,
);
export const ReliabilityCodeSampleReview = review(
  "ReliabilityCodeSample",
  <ReliabilityCodeSample label="Provider response excerpt">{`GET /v2/schedule 200\nrequest-id: req_7F2A\nage: 18s`}</ReliabilityCodeSample>,
);
