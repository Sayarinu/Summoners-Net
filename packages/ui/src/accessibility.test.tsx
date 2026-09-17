import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { MatchRow, ScheduleGroup, StandingsTable, StreamConsent } from "./esports.js";
import type { MatchDisplay } from "./esports.js";
import { Checkbox, Input, RadioGroup, Select, Switch } from "./forms.js";
import { Footer, Header, Navigation } from "./navigation.js";
import {
  AdminNavigation,
  AdminShell,
  DataFreshnessBanner,
  IncidentSummary,
  IngestionRunRow,
  OperationTimeline,
  ProviderHealth,
} from "./operations.js";
import { Dialog } from "./overlays.js";
import { Button, Callout, StatusIndicator } from "./primitives.js";

const regionOptions = [
  { description: "Korea", label: "LCK", value: "lck" },
  { description: "China", label: "LPL", value: "lpl" },
] as const;

function formatViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.impact ?? "unknown"}: ${violation.id} — ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.map(String).join(" ")}: ${node.failureSummary ?? ""}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

async function expectNoBlockingViolations(): Promise<void> {
  const results = await axe.run(document.body, {
    // jsdom has no layout or canvas implementation, so contrast is verified by
    // Storybook/browser checks rather than producing an unreliable result here.
    rules: { "color-contrast": { enabled: false } },
    resultTypes: ["violations"],
  });
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking, formatViolations(blocking)).toEqual([]);
}

describe("axe accessibility smoke coverage", () => {
  it("has no blocking violations in primitive and form controls", async () => {
    render(
      <main id="main-content">
        <h1 id="control-heading">Component controls</h1>
        <form aria-labelledby="control-heading">
          <Input description="Public-facing team name" label="Team" required />
          <Select
            defaultValue="lck"
            description="Primary competition region"
            label="Region"
            options={regionOptions}
          />
          <Checkbox analyticsId="showmatches">Include showmatches</Checkbox>
          <RadioGroup
            defaultValue="canonical"
            label="Data resolution"
            options={[
              { label: "Canonical", value: "canonical" },
              { description: "Requires review", label: "Manual", value: "manual" },
            ]}
          />
          <Switch analyticsId="spoilers">Hide spoilers</Switch>
          <Button loading type="submit">
            Save preferences
          </Button>
        </form>
        <Callout title="Provider delayed" tone="warning">
          Schedule freshness is outside its target.
        </Callout>
      </main>,
    );

    await expectNoBlockingViolations();
  });

  it("has no blocking violations in navigation and public esports content", async () => {
    const match = {
      bestOf: 3,
      competition: "LCK",
      href: "/matches/gen-t1",
      id: "gen-t1",
      lifecycle: "live" as const,
      scheduledLabel: "Live · Game 2",
      streamAvailable: true,
      teams: [
        { name: "Gen.G", score: 1, shortName: "GEN" },
        { name: "T1", score: 0, shortName: "T1" },
      ] as const,
    } satisfies MatchDisplay;

    render(
      <>
        <Header
          actions={<Button>Account</Button>}
          brand={<a href="/">Nexus Pulse</a>}
          navigation={
            <Navigation
              currentHref="/schedule"
              items={[
                { href: "/schedule", label: "Schedule" },
                { href: "/live", label: "Live", meta: "1" },
                { href: "/teams", label: "Teams" },
              ]}
            />
          }
          status={<StatusIndicator label="Operational" tone="success" />}
        />
        <main id="main-content">
          <h1>Tier 1 schedule</h1>
          <ScheduleGroup count={1} dateLabel="Today" description="Times shown locally">
            <MatchRow match={match} />
          </ScheduleGroup>
          <StandingsTable
            caption="LCK standings"
            rows={[
              {
                id: "gen",
                losses: 0,
                position: 1,
                qualified: true,
                team: { name: "Gen.G", shortName: "GEN" },
                wins: 3,
              },
            ]}
          />
          <StreamConsent
            onAccept={() => undefined}
            onDecline={() => undefined}
            privacyHref="/privacy"
            provider="Twitch"
          />
        </main>
        <Footer links={[{ href: "/privacy", label: "Privacy" }]} status="Operational" />
      </>,
    );

    await expectNoBlockingViolations();
  });

  it("has no blocking violations in an open modal overlay", async () => {
    const user = userEvent.setup();
    render(
      <main id="main-content">
        <h1>Provider review</h1>
        <Dialog
          description="Confirm the selected provider correction before publishing."
          footer={<Button>Publish correction</Button>}
          title="Review correction"
          trigger={<Button>Open review</Button>}
        >
          <Input label="Reason" value="Canonical source verified" readOnly />
        </Dialog>
      </main>,
    );

    await user.click(screen.getByRole("button", { name: "Open review" }));
    expect(await screen.findByRole("dialog", { name: "Review correction" })).toBeVisible();
    await expectNoBlockingViolations();
  });

  it("has no blocking violations in an operations workspace", async () => {
    const navigation = (
      <AdminNavigation
        currentHref="/providers"
        items={[
          { href: "/overview", label: "Overview" },
          { href: "/providers", label: "Providers" },
          { href: "/ingestion", label: "Ingestion" },
        ]}
      />
    );

    render(
      <AdminShell
        actions={<Button>Add provider</Button>}
        navigation={navigation}
        notice={
          <DataFreshnessBanner
            ageLabel="12 seconds ago"
            lastUpdated="2026-07-10T20:00:00-04:00"
            provider="Schedule"
            state="fresh"
          />
        }
        title="Provider health"
      >
        <ProviderHealth
          details={[{ label: "Latency", value: "420ms" }]}
          lastSuccess="12 seconds ago"
          name="Schedule provider"
          state="healthy"
        />
        <IngestionRunRow
          id="run_1024"
          progress={42}
          provider="Schedule"
          startedAt="2026-07-10T20:00:00-04:00"
          state="running"
        />
        <OperationTimeline
          events={[
            {
              description: "Queued by an operator",
              id: "queued",
              label: "Queued",
              state: "info",
              timestamp: "2026-07-10T20:00:00-04:00",
            },
            {
              id: "running",
              label: "Running",
              state: "running",
              timestamp: "2026-07-10T20:00:02-04:00",
            },
          ]}
          title="Run timeline"
        />
        <IncidentSummary
          affected={["Schedule", "Live"]}
          id="INC-102"
          severity="major"
          startedAt="2026-07-10T19:58:00-04:00"
          status="monitoring"
          title="Provider latency"
        >
          Monitoring recovery against the freshness target.
        </IncidentSummary>
      </AdminShell>,
    );

    await expectNoBlockingViolations();
  });
});
