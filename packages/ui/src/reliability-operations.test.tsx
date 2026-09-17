import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

describe("reliability provenance", () => {
  it("links to official sources with safe external-link behavior and analytics", () => {
    render(
      <OfficialSourceLink
        analyticsId="source-link"
        href="https://example.com"
        source="Official API"
      >
        Verify record
      </OfficialSourceLink>,
    );
    const link = screen.getByRole("link", { name: "Open official source: Official API" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("data-analytics-id", "source-link");
  });

  it("renders linked and unlinked source attribution variants", () => {
    const { rerender } = render(
      <SourceAttribution
        analyticsId="source"
        href="https://example.com"
        official
        recordId="record_1"
        retrievedAt="2026-07-10T18:00:00-04:00"
        retrievedLabel="12 seconds ago"
        source="League API"
      >
        Normalized record
      </SourceAttribution>,
    );
    const source = screen.getByLabelText("Data source");
    expect(source).toHaveAttribute("data-analytics-id", "source");
    expect(source).toHaveTextContent("record_1");
    expect(source).toHaveTextContent("Normalized record");
    expect(screen.getByRole("link", { name: /League API/ })).toBeVisible();
    expect(source.querySelectorAll("svg")).toHaveLength(1);

    rerender(
      <SourceAttribution
        retrievedAt="2026-07-10T18:00:00-04:00"
        retrievedLabel="Earlier"
        source="Fallback feed"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Fallback feed")).toBeVisible();
    expect(source.querySelectorAll("svg")).toHaveLength(0);
  });

  it("communicates every freshness state", () => {
    const { rerender } = render(
      <FreshnessStamp label="Now" state="fresh" updatedAt="2026-07-10" />,
    );
    expect(screen.getByText("fresh")).toBeVisible();
    rerender(<FreshnessStamp compact label="4m" state="delayed" updatedAt="2026-07-10" />);
    expect(screen.getByText("delayed")).toBeVisible();
    rerender(<FreshnessStamp label="18m" state="stale" updatedAt="2026-07-10" />);
    expect(screen.getByText("stale")).toBeVisible();
    rerender(<FreshnessStamp label="Unknown" state="unknown" updatedAt="2026-07-10" />);
    expect(screen.getByText("unknown")).toBeVisible();
  });

  it("renders all data-quality states, evidence, and actions", async () => {
    const user = userEvent.setup();
    const inspect = vi.fn();
    const { rerender } = render(
      <DataQualityNotice
        actions={<Button onPress={inspect}>Inspect</Button>}
        issues={[
          { detail: "Different timestamps", field: "startTime", id: "one", label: "Mismatch" },
        ]}
        state="conflicted"
      />,
    );
    expect(screen.getByRole("heading", { name: "Sources disagree" })).toBeVisible();
    expect(screen.getByText("startTime")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(inspect).toHaveBeenCalledOnce();

    rerender(<DataQualityNotice state="verified" />);
    expect(screen.getByRole("heading", { name: "Data verified" })).toBeVisible();
    rerender(<DataQualityNotice state="unavailable" />);
    expect(screen.getByRole("heading", { name: "Data unavailable" })).toBeVisible();
    rerender(<DataQualityNotice state="estimated" />);
    expect(screen.getByRole("heading", { name: "Estimated values" })).toBeVisible();
    rerender(<DataQualityNotice state="partial" title="Limited stats" />);
    expect(screen.getByRole("heading", { name: "Limited stats" })).toBeVisible();
  });

  it("shows field-level provenance, clamps confidence, and records overrides", () => {
    const { rerender } = render(
      <FieldProvenance
        confidence={140}
        field="startTime"
        official
        source="Official API"
        sourceHref="https://example.com"
        updatedAt="2026-07-10"
        updatedLabel="Now"
        value="20:00"
      />,
    );
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByRole("link", { name: /Official API/ })).toBeVisible();

    rerender(
      <FieldProvenance
        confidence={-10}
        field="venue"
        overriddenBy="Operator"
        source="Fallback"
        updatedAt="2026-07-10"
        updatedLabel="Earlier"
        value="Arena"
      />,
    );
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getByText("Overridden")).toBeVisible();
    expect(screen.getByText("Operator")).toBeVisible();

    rerender(
      <FieldProvenance
        field="patch"
        source="Community"
        updatedAt="2026-07-10"
        updatedLabel="Earlier"
        value="26.13"
      />,
    );
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
  });

  it("offers recovery when a provider is unavailable", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <ProviderUnavailable
        analyticsId="provider-state"
        fallbackLabel="Verified snapshot"
        onRetry={retry}
        provider="Live telemetry"
        scope="Live data is delayed."
      />,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-analytics-id", "provider-state");
    expect(screen.getByText("Showing fallback: Verified snapshot")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry Provider" }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(
      <ProviderUnavailable provider="Roster" retrying scope="Roster data is unavailable." />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists conflicting candidates and opens review", async () => {
    const user = userEvent.setup();
    const review = vi.fn();
    render(
      <ConflictingSource
        candidates={[
          { observedAt: "18:00", source: "A", value: "One" },
          { observedAt: "18:01", source: "B", value: "Two" },
        ]}
        field="venue"
        onReview={review}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Conflicting value for venue");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Review Conflict" }));
    expect(review).toHaveBeenCalledOnce();
  });
});

describe("secure operations access and provider setup", () => {
  it("submits admin credentials and supports SSO and error states", async () => {
    const user = userEvent.setup();
    const authenticate = vi.fn();
    const sso = vi.fn();
    render(
      <AdminAuth
        analyticsId="auth"
        error="Invalid credentials"
        onAuthenticate={authenticate}
        onSso={sso}
      />,
    );
    expect(screen.getByRole("main")).toHaveAttribute("data-analytics-id", "auth");
    expect(screen.getByRole("region", { name: "Sign-in failed" })).toBeVisible();
    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(authenticate).toHaveBeenCalledWith({
      email: "operator@example.com",
      password: "secret",
    });
    await user.click(screen.getByRole("button", { name: "Continue With Company SSO" }));
    expect(sso).toHaveBeenCalledOnce();
  });

  it("renders access denied with and without an access request", async () => {
    const user = userEvent.setup();
    const request = vi.fn();
    const { rerender } = render(
      <AccessDenied onRequestAccess={request} requiredRole="Admin" resource="secrets" />,
    );
    expect(screen.getByText("Required role: Admin")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Request Access" }));
    expect(request).toHaveBeenCalledOnce();
    rerender(<AccessDenied resource="audit exports" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reauthenticates, cancels, and displays validation feedback", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    const cancel = vi.fn();
    render(
      <Reauthentication
        error="Password did not match"
        onCancel={cancel}
        onConfirm={confirm}
        reason="Replace a secret."
      />,
    );
    await user.type(screen.getByLabelText("Password"), "confirm-me");
    await user.click(screen.getByRole("button", { name: "Confirm Identity" }));
    expect(confirm).toHaveBeenCalledWith("confirm-me");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Password did not match");
  });

  it("routes an expired session back to sign-in", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn();
    const { rerender } = render(<SessionExpired onSignIn={signIn} returnPath="Provider edit" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Return to Provider edit");
    await user.click(screen.getByRole("button", { name: "Sign In Again" }));
    expect(signIn).toHaveBeenCalledOnce();
    rerender(<SessionExpired onSignIn={signIn} />);
    expect(screen.queryByText(/Return to/)).not.toBeInTheDocument();
  });

  it("moves providers with named keyboard controls and enforces list bounds", async () => {
    const user = userEvent.setup();
    const move = vi.fn();
    render(
      <ProviderPriorityList
        analyticsId="priority"
        items={[
          { id: "a", name: "Official", state: "healthy" },
          { id: "b", name: "Fallback", state: "unavailable" },
          { id: "c", name: "Disabled", state: "disabled" },
        ]}
        onMove={move}
      />,
    );
    expect(screen.getByLabelText("Provider priority")).toHaveAttribute(
      "data-analytics-id",
      "priority",
    );
    expect(screen.getByRole("button", { name: "Move Official up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Disabled down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Fallback up" }));
    expect(move).toHaveBeenCalledWith("b", "up");
    await user.click(screen.getByRole("button", { name: "Move Fallback down" }));
    expect(move).toHaveBeenCalledWith("b", "down");
  });

  it("submits provider configuration while preserving encrypted secrets", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const cancel = vi.fn();
    render(
      <ProviderForm
        initialValues={{ baseUrl: "https://api.example.com", name: "Schedule" }}
        onCancel={cancel}
        onSubmit={submit}
        priorities={[{ id: "a", name: "Official" }]}
        secretConfigured
      />,
    );
    expect(screen.getByText(/Leave blank to retain/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save Provider" }));
    expect(submit).toHaveBeenCalledWith({
      baseUrl: "https://api.example.com",
      name: "Schedule",
      providerType: "schedule",
      secret: "",
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("requires and redacts a new provider secret", () => {
    render(<ProviderForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("API secret")).toBeRequired();
    expect(screen.getByText(/Stored encrypted and redacted/)).toBeVisible();
    expect(screen.getByText("Setup required")).toBeVisible();
  });
});

describe("reconciliation and publication", () => {
  const conflicts = [
    {
      entity: "Match A",
      fieldCount: 2,
      id: "a",
      receivedAt: "18:00",
      severity: "high" as const,
      sources: ["One", "Two"],
    },
    {
      entity: "Match B",
      fieldCount: 1,
      id: "b",
      receivedAt: "18:01",
      severity: "medium" as const,
      sources: ["One", "Three"],
    },
    {
      entity: "Roster",
      fieldCount: 1,
      id: "c",
      receivedAt: "18:02",
      severity: "low" as const,
      sources: ["Team"],
    },
  ];

  it("selects conflicts, exposes severity, and supports static queues", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const { rerender } = render(
      <ConflictQueue analyticsId="queue" items={conflicts} onSelect={select} selectedId="a" />,
    );
    expect(screen.getByLabelText("Conflict queue")).toHaveAttribute("data-analytics-id", "queue");
    expect(screen.getByRole("button", { name: /Match A/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("high severity")).toHaveClass("np-visually-hidden");
    await user.click(screen.getByRole("button", { name: /Match B/ }));
    expect(select).toHaveBeenCalledWith("b");

    rerender(<ConflictQueue items={conflicts} selectedId="a" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Match A").closest("div.np-conflict-queue__row")).toHaveAttribute(
      "aria-current",
      "true",
    );

    rerender(<ConflictQueue items={[]} />);
    expect(screen.getByText("No conflicts require review.")).toBeVisible();
  });

  it("changes field resolutions using native radio semantics", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <FieldDiff
        onResolutionChange={change}
        rows={[
          {
            candidate: "New",
            canonical: "Old",
            field: "Name",
            id: "name",
            resolution: "canonical",
            source: "Feed",
          },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: /Old/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /New/ }));
    expect(change).toHaveBeenCalledWith("name", "candidate");
    await user.click(screen.getByRole("radio", { name: "Custom value" }));
    expect(change).toHaveBeenCalledWith("name", "custom");
  });

  it("submits an audited manual override and supports cancellation", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const cancel = vi.fn();
    render(
      <OverrideEditor
        currentValue="Old"
        entity="Match"
        field="venue"
        onCancel={cancel}
        onSubmit={submit}
      />,
    );
    await user.type(screen.getByLabelText("Replacement value"), "New");
    await user.type(screen.getByLabelText("Reason"), "Confirmed by organizer");
    await user.type(screen.getByLabelText("Expires at"), "2026-07-12T12:30");
    await user.click(screen.getByRole("button", { name: "Save Draft Override" }));
    expect(submit).toHaveBeenCalledWith({
      expiresAt: "2026-07-12T12:30",
      reason: "Confirmed by organizer",
      value: "New",
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("advances draft, preview, and published workflow states", async () => {
    const user = userEvent.setup();
    const preview = vi.fn();
    const back = vi.fn();
    const publish = vi.fn();
    const { rerender } = render(
      <PublishWorkflow current="draft" onPreview={preview} title="Correction" />,
    );
    await user.click(screen.getByRole("button", { name: "Review Preview" }));
    expect(preview).toHaveBeenCalledOnce();
    expect(screen.getByText("Draft").closest("li")).toHaveAttribute("aria-current", "step");

    rerender(
      <PublishWorkflow
        current="preview"
        description="Impact preview"
        onBackToDraft={back}
        onPublish={publish}
        title="Correction"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Back To Draft" }));
    await user.click(screen.getByRole("button", { name: "Publish Changes" }));
    expect(back).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();

    rerender(<PublishWorkflow current="published" title="Correction" />);
    expect(screen.getByText("Published").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("run diagnostics and audit evidence", () => {
  const events = [
    {
      detail: "Started",
      id: "one",
      label: "Fetch",
      outcome: "running" as const,
      timestamp: "18:00",
    },
    { id: "two", label: "Normalize", outcome: "success" as const, timestamp: "18:01" },
    { id: "three", label: "Validate", outcome: "warning" as const, timestamp: "18:02" },
    { id: "four", label: "Write", outcome: "failure" as const, timestamp: "18:03" },
  ];

  it("renders running, failed, and completed run details with actions", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    const retry = vi.fn();
    const { rerender } = render(
      <RunDetail
        events={events}
        id="run_1"
        onCancel={cancel}
        progress={42}
        provider="Schedule"
        startedAt="18:00"
        state="running"
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Run progress" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel Run" }));
    expect(cancel).toHaveBeenCalledOnce();

    rerender(
      <RunDetail
        duration="4s"
        events={events}
        id="run_2"
        onRetry={retry}
        provider="Live"
        startedAt="18:00"
        state="failed"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry Run" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText("4s")).toBeVisible();

    rerender(
      <RunDetail
        duration="2s"
        events={[]}
        id="run_3"
        provider="Roster"
        startedAt="18:00"
        state="succeeded"
      />,
    );
    expect(screen.getByText("succeeded")).toBeVisible();
  });

  it("filters and selects structured logs and renders an empty static stream", async () => {
    const user = userEvent.setup();
    const query = vi.fn();
    const level = vi.fn();
    const select = vi.fn();
    const entries = [
      {
        correlationId: "corr_1",
        id: "debug",
        level: "debug" as const,
        message: "Debug",
        service: "api",
        timestamp: "18:00",
      },
      { id: "info", level: "info" as const, message: "Info", service: "api", timestamp: "18:01" },
      { id: "warn", level: "warn" as const, message: "Warn", service: "api", timestamp: "18:02" },
      {
        id: "error",
        level: "error" as const,
        message: "Error",
        service: "api",
        timestamp: "18:03",
      },
    ];
    const { rerender } = render(
      <LogViewer entries={entries} onLevelChange={level} onQueryChange={query} onSelect={select} />,
    );
    await user.type(screen.getByRole("searchbox", { name: "Search logs" }), "error");
    expect(query).toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("Level"), "error");
    expect(level).toHaveBeenCalledWith("error");
    await user.click(screen.getByRole("button", { name: /Debug/ }));
    expect(select).toHaveBeenCalledWith("debug");

    rerender(<LogViewer entries={[]} level="error" query="none" />);
    expect(screen.getByText("No log entries match these filters.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows trace correlations, copies IDs, and distinguishes span outcomes", async () => {
    const user = userEvent.setup();
    const copy = vi.fn();
    const { rerender } = render(
      <TraceCorrelationDetail
        correlationId="corr_1"
        duration="12ms"
        onCopy={copy}
        spans={[
          { duration: "8ms", id: "ok", name: "Fetch", service: "api", state: "ok" },
          { duration: "4ms", id: "bad", name: "Write", service: "db", state: "error" },
        ]}
        startedAt="18:00"
        traceId="trace_1"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Copy Correlation IDs" }));
    expect(copy).toHaveBeenCalledOnce();
    expect(
      screen.getByText("Write").closest("li")?.querySelector(".np-trace-span--error"),
    ).not.toBeNull();
    rerender(
      <TraceCorrelationDetail
        correlationId="corr_2"
        duration="2ms"
        spans={[]}
        startedAt="18:01"
        traceId="trace_2"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies and resets audit filters", async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    const reset = vi.fn();
    render(<AuditFilters onApply={apply} onReset={reset} />);
    await user.type(screen.getByLabelText("Actor"), "Carter");
    await user.type(screen.getByLabelText("Action"), "Published");
    await user.type(screen.getByLabelText("From"), "2026-07-01T10:00");
    await user.type(screen.getByLabelText("To"), "2026-07-10T18:00");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(apply).toHaveBeenCalledWith({
      action: "Published",
      actor: "Carter",
      from: "2026-07-01T10:00",
      outcome: "",
      to: "2026-07-10T18:00",
    });
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders audit metadata, field changes, and minimal failure details", () => {
    const { rerender } = render(
      <AuditEventDetail
        action="Published"
        actor="Carter"
        changes={[{ after: "New", before: "Old", field: "venue" }]}
        correlationId="corr"
        eventId="evt"
        ipAddress="192.0.2.1"
        outcome="success"
        target="match"
        timestamp="18:00"
      />,
    );
    expect(screen.getByRole("table", { name: "Audit field changes" })).toHaveTextContent("Old");
    expect(screen.getByText("192.0.2.1")).toBeVisible();
    rerender(
      <AuditEventDetail
        action="Failed"
        actor="System"
        eventId="evt2"
        outcome="failure"
        target="provider"
        timestamp="18:01"
      />,
    );
    expect(screen.getByText("failure")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("exports audit evidence in CSV and JSON formats", async () => {
    const user = userEvent.setup();
    const exportEvents = vi.fn();
    render(<AuditExport count={12} onExport={exportEvents} rangeLabel="Today" />);
    await user.click(screen.getByRole("button", { name: "CSV" }));
    await user.click(screen.getByRole("button", { name: "JSON" }));
    expect(exportEvents).toHaveBeenNthCalledWith(1, "csv");
    expect(exportEvents).toHaveBeenNthCalledWith(2, "json");
  });
});

describe("incident authoring and public status", () => {
  it("saves incident details and supports cancellation", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const cancel = vi.fn();
    render(
      <IncidentEditor
        initialValues={{
          affected: "Live",
          severity: "major",
          status: "investigating",
          summary: "Investigating provider latency",
          title: "Telemetry delayed",
        }}
        onCancel={cancel}
        onSave={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save Incident" }));
    expect(save).toHaveBeenCalledWith({
      affected: "Live",
      severity: "major",
      status: "investigating",
      summary: "Investigating provider latency",
      title: "Telemetry delayed",
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("publishes a public incident update", async () => {
    const user = userEvent.setup();
    const publish = vi.fn();
    render(<IncidentUpdateComposer onPublish={publish} />);
    await user.type(screen.getByLabelText("Public update"), "Recovery is being monitored.");
    await user.click(screen.getByRole("button", { name: "Publish Update" }));
    expect(publish).toHaveBeenCalledWith({
      message: "Recovery is being monitored.",
      status: "investigating",
    });
    expect(screen.getByText(/cannot be silently edited/)).toBeVisible();
  });

  it("renders all overall system health states", () => {
    const { rerender } = render(
      <SystemStatusHeader checkedAt="18:00" checkedLabel="Now" health="operational" />,
    );
    expect(screen.getByRole("heading", { name: "All systems operational" })).toBeVisible();
    rerender(<SystemStatusHeader checkedAt="18:00" checkedLabel="Now" health="maintenance" />);
    expect(screen.getByRole("heading", { name: "Scheduled maintenance" })).toBeVisible();
    rerender(
      <SystemStatusHeader
        checkedAt="18:00"
        checkedLabel="Now"
        health="major-outage"
        message="Unavailable"
      />,
    );
    expect(screen.getByRole("heading", { name: "Some systems are affected" })).toBeVisible();
    rerender(<SystemStatusHeader checkedAt="18:00" checkedLabel="Now" health="degraded" />);
    expect(screen.getByText("degraded")).toBeVisible();
    rerender(
      <SystemStatusHeader
        checkedAt="18:00"
        checkedLabel="Now"
        health="partial-outage"
        title="Partial outage"
      />,
    );
    expect(screen.getByRole("heading", { name: "Partial outage" })).toBeVisible();
  });

  it("renders service-level status and optional metrics", () => {
    const { rerender } = render(
      <ServiceStatusRow
        description="Fixtures"
        latency="120ms"
        name="Schedule"
        status="operational"
        uptime="100%"
      />,
    );
    expect(screen.getByText("120ms")).toBeVisible();
    expect(screen.getByText("100%")).toBeVisible();
    rerender(<ServiceStatusRow name="Live" status="partial-outage" />);
    expect(screen.getByText("partial outage")).toBeVisible();
    rerender(<ServiceStatusRow name="Admin" status="major-outage" />);
    expect(screen.getByText("major outage")).toBeVisible();
    rerender(<ServiceStatusRow name="Stream" status="maintenance" />);
    expect(screen.getByText("maintenance")).toBeVisible();
  });

  it("summarizes uptime history accessibly", () => {
    render(
      <UptimeHistory
        analyticsId="uptime"
        days={[
          { date: "2026-07-08", label: "Jul 8", status: "operational" },
          { date: "2026-07-09", label: "Jul 9", status: "degraded" },
          { date: "2026-07-10", label: "Jul 10", status: "outage" },
          { date: "2026-07-11", label: "Jul 11", status: "maintenance" },
          { date: "2026-07-12", label: "Jul 12", status: "unknown" },
        ]}
        service="Live telemetry"
        uptime="99.82%"
      />,
    );
    const figure = screen.getByRole("figure", { name: /Live telemetry/ });
    expect(figure).toHaveAttribute("data-analytics-id", "uptime");
    expect(figure).toHaveTextContent("Jul 10: outage");
  });

  it("renders planned maintenance with machine-readable dates", () => {
    render(
      <MaintenanceNotice
        affected={["Admin", "Ingestion"]}
        description="Writes pause during maintenance."
        endsAt="2026-07-14T03:30:00-04:00"
        endsLabel="03:30"
        startsAt="2026-07-14T03:00:00-04:00"
        startsLabel="03:00"
        title="Database upgrade"
      />,
    );
    expect(screen.getByRole("heading", { name: "Database upgrade" })).toBeVisible();
    expect(screen.getByText("03:00")).toHaveAttribute("datetime", "2026-07-14T03:00:00-04:00");
    expect(screen.getByText("Admin, Ingestion")).toBeVisible();
  });

  it("renders individual incident updates and complete history", () => {
    const { rerender } = render(
      <IncidentUpdate author="Operator" status="resolved" timestamp="18:00" timestampLabel="Now">
        Service recovered.
      </IncidentUpdate>,
    );
    expect(screen.getByText("Posted by Operator")).toBeVisible();
    rerender(
      <IncidentHistory
        affected={["Live"]}
        id="42"
        status="monitoring"
        title="Telemetry delayed"
        updates={[
          {
            children: "Investigating.",
            status: "investigating",
            timestamp: "18:00",
            timestampLabel: "18:00",
          },
          {
            children: "Cause found.",
            status: "identified",
            timestamp: "18:10",
            timestampLabel: "18:10",
          },
          {
            children: "Monitoring.",
            status: "monitoring",
            timestamp: "18:20",
            timestampLabel: "18:20",
          },
          {
            children: "Resolved.",
            status: "resolved",
            timestamp: "18:30",
            timestampLabel: "18:30",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Telemetry delayed" })).toBeVisible();
    expect(screen.getByText("Affected: Live")).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("renders supporting empty and code evidence states", () => {
    render(
      <div>
        <OperationsEmptyState description="Everything is healthy." title="No incidents" />
        <ReliabilityCodeSample label="Response">GET /status 200</ReliabilityCodeSample>
      </div>,
    );
    expect(screen.getByRole("heading", { name: "No incidents" })).toBeVisible();
    expect(screen.getByLabelText("Response")).toHaveTextContent("GET /status 200");
  });
});
