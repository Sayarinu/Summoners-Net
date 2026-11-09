import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { Table } from "./data-display.js";
import { MatchRow, PlayerIdentity, StreamConsent, TeamIdentity } from "./esports.js";
import type { MatchDisplay } from "./esports.js";
import { Combobox, Input, Select, Switch } from "./forms.js";
import { Breadcrumb, Footer, Navigation, Pagination } from "./navigation.js";
import { Button, StatusIndicator } from "./primitives.js";

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
          <Combobox
            defaultValue="UTC"
            label="Timezone"
            options={[
              { label: "UTC", value: "UTC" },
              { label: "America/Phoenix", value: "America/Phoenix" },
            ]}
          />
          <Switch analyticsId="spoilers">Hide spoilers</Switch>
          <Button loading type="submit">
            Save preferences
          </Button>
        </form>
        <StatusIndicator label="Provider delayed" tone="warning" />
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
        <Navigation
          currentHref="/schedule"
          items={[
            { href: "/schedule", label: "Schedule" },
            { href: "/live", label: "Live", meta: "1" },
            { href: "/teams", label: "Teams" },
          ]}
        />
        <main id="main-content">
          <Breadcrumb items={[{ href: "/", label: "Matches" }, { label: "LCK" }]} />
          <h1>Tier 1 schedule</h1>
          <MatchRow match={match} />
          <Table
            caption="Played lineup"
            columns={[
              {
                header: "Team",
                id: "team",
                render: () => <TeamIdentity name="Gen.G" shortName="GEN" size="compact" />,
              },
              {
                header: "Player",
                id: "player",
                render: () => <PlayerIdentity handle="Chovy" role="Mid" />,
              },
            ]}
            getRowKey={(row) => row.id}
            rows={[{ id: "chovy" }]}
          />
          <Pagination currentPage={2} onPageChange={() => undefined} totalPages={5} />
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
});
