import { Database, Gauge } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
import { Button } from "./primitives.js";

describe("operations shell and health", () => {
  it("filters unauthorized navigation and composes an admin shell", () => {
    const nav = (
      <AdminNavigation
        currentHref="/providers"
        items={[
          { href: "/overview", icon: <Icon icon={Gauge} />, label: "Overview" },
          { href: "/providers", icon: <Icon icon={Database} />, label: "Providers" },
          { allowed: false, href: "/secrets", label: "Secrets" },
        ]}
      />
    );
    render(
      <AdminShell
        actions={<Button>Add</Button>}
        eyebrow="Admin"
        navigation={nav}
        notice="Maintenance"
        title="Providers"
      >
        <p>Content</p>
      </AdminShell>,
    );
    expect(screen.getByRole("navigation", { name: "Administration" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Secrets" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Providers" })).toBeVisible();
    expect(screen.getByRole("main")).toHaveTextContent("Maintenance");
  });

  it("renders freshness states and refresh action", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    const { rerender } = render(
      <DataFreshnessBanner
        ageLabel="12 seconds ago"
        lastUpdated="2026-07-10T18:00:00-04:00"
        onRefresh={refresh}
        provider="Schedule"
        state="fresh"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Data is current" })).toBeVisible();
    rerender(<DataFreshnessBanner ageLabel="Unknown" lastUpdated="2026-07-10" state="unknown" />);
    expect(screen.getByRole("region", { name: "Freshness unknown" })).toBeVisible();
    rerender(
      <DataFreshnessBanner ageLabel="18 minutes ago" lastUpdated="2026-07-10" state="stale" />,
    );
    expect(screen.getByRole("region", { name: "Data freshness degraded" })).toBeVisible();
  });

  it("renders all provider health states and opens details", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    render(
      <div>
        <ProviderHealth
          details={[{ label: "Latency", value: "420ms" }]}
          lastSuccess="12s"
          name="Healthy"
          onOpen={open}
          state="healthy"
        />
        <ProviderHealth name="Degraded" state="degraded" />
        <ProviderHealth name="Outage" state="outage" />
        <ProviderHealth name="Disabled" state="disabled" />
        <ProviderHealth name="Unconfigured" state="unconfigured" />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "View Provider" }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByText("Latency")).toBeVisible();
    expect(screen.getByText("unconfigured")).toBeVisible();
  });
});

describe("operations activity and approvals", () => {
  it("renders ingestion lifecycle and dispatches retry, cancel, and open actions", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const cancel = vi.fn();
    const open = vi.fn();
    const { container } = render(
      <div>
        <IngestionRunRow
          id="running"
          onCancel={cancel}
          onOpen={open}
          progress={42}
          provider="Schedule"
          startedAt="18:00"
          state="running"
        />
        <IngestionRunRow
          duration="12s"
          id="failed"
          onRetry={retry}
          provider="Live"
          startedAt="17:58"
          state="failed"
        />
        <IngestionRunRow id="success" provider="Roster" startedAt="17:50" state="succeeded" />
        <IngestionRunRow id="queue" provider="Events" startedAt="17:49" state="queued" />
        <IngestionRunRow id="cancelled" provider="Stats" startedAt="17:48" state="cancelled" />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("progressbar", { name: "Run progress" })).toBeVisible();
    const runningSummary = container.querySelector(".np-ingestion-run__summary");
    expect(runningSummary).toHaveTextContent("Schedule");
    expect(runningSummary).toHaveTextContent("running");
  });

  it("renders chronological operation events", () => {
    render(
      <OperationTimeline
        events={[
          {
            description: "Queued by operator",
            id: "1",
            label: "Queued",
            state: "info",
            timestamp: "18:00",
          },
          { id: "2", label: "Running", state: "running", timestamp: "18:01" },
          { id: "3", label: "Warning", state: "warning", timestamp: "18:02" },
          { id: "4", label: "Succeeded", state: "success", timestamp: "18:03" },
          { id: "5", label: "Failed", state: "failure", timestamp: "18:04" },
        ]}
        title="Timeline"
      />,
    );
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("supports approval and destructive dialog actions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const destroy = vi.fn();
    render(
      <div>
        <ApprovalDialog
          description="Publish corrections"
          onApprove={approve}
          title="Approve"
          trigger={<Button>Review</Button>}
        >
          2 corrections
        </ApprovalDialog>
        <DestructiveActionDialog
          description="Remove provider"
          onConfirm={destroy}
          title="Delete provider"
          trigger={<Button>Delete</Button>}
        >
          Historical audit remains.
        </DestructiveActionDialog>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(approve).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Confirm Destructive Action" }));
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("renders audit outcomes and incident summaries", () => {
    render(
      <div>
        <AuditEventRow
          action="Updated"
          actor="Carter"
          detail="2 values"
          target="Worlds"
          timestamp="18:00"
        />
        <AuditEventRow
          action="Failed"
          actor="System"
          outcome="failure"
          target="Provider"
          timestamp="18:01"
        />
        <IncidentSummary
          affected={["Live", "Admin"]}
          id="INC-1"
          severity="critical"
          startedAt="2026-07-10"
          status="monitoring"
          title="Provider outage"
        >
          Monitoring recovery.
        </IncidentSummary>
        <IncidentSummary
          id="INC-2"
          severity="minor"
          startedAt="2026-07-09"
          status="resolved"
          title="Minor delay"
        />
      </div>,
    );
    expect(screen.getByText("2 values")).toBeVisible();
    expect(screen.getByText("failure")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Provider outage" })).toBeVisible();
    expect(screen.getByText("Live, Admin")).toBeVisible();
    expect(screen.getByText("resolved")).toBeVisible();
  });
});
