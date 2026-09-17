"use client";
import { useState } from "react";
import { Button, Input, Table, TextLink, StatusIndicator } from "@esportsviewer/ui";
import type { SyncStatus, Queries } from "@esportsviewer/data";
import { dateTime } from "../browse/presentation";
import { RefreshButton } from "./refresh";
export function SourcesPage({
  status,
  timezone,
  year,
  entities,
}: {
  status: SyncStatus;
  timezone: string;
  year: number;
  entities?: Awaited<ReturnType<Queries["entityStatus"]>>;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function upload(form: HTMLFormElement) {
    setPending(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) throw new Error();
      setMessage("Import queued. Start the local worker to process it, then reload this page.");
    } catch {
      setMessage(
        "Import could not be queued. Choose an annual CSV up to 256 MiB and a year from 2014 onward.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Your local library</span>
          <h1>Sources & imports</h1>
          <p className="np-body-sm">
            Refreshes join the shared queue. Keep <code>pnpm sync</code> running to process them.
          </p>
        </div>
        <Button onPress={() => window.location.reload()}>Reload status</Button>
      </header>
      <Table
        caption="Source freshness"
        rows={status.sources}
        getRowKey={(s) => s.source}
        columns={[
          { id: "source", header: "Source", render: (s) => s.source },
          {
            id: "success",
            header: "Last success",
            render: (s) => (s.lastSuccess ? dateTime(s.lastSuccess, timezone) : "Never"),
          },
          {
            id: "attempt",
            header: "Last attempt",
            render: (s) => (s.lastAttempt ? dateTime(s.lastAttempt, timezone) : "Never"),
          },
          {
            id: "records",
            header: "Last job records",
            render: (s) => s.records,
          },
          { id: "error", header: "Status", render: (s) => s.error ?? "Ready" },
          {
            id: "refresh",
            header: "Refresh",
            render: (s) => (
              <RefreshButton
                kind={
                  s.source === "pandascore"
                    ? "matches"
                    : s.source === "ddragon"
                      ? "metadata"
                      : "history"
                }
                {...(s.source === "oracle" ? { year } : {})}
              />
            ),
          },
        ]}
      />
      <p className="np-meta">
        PandaScore: {status.pandaRequests} / 600 requests in the rolling hour.{" "}
        {status.cooldownUntil
          ? `Cooldown until ${dateTime(status.cooldownUntil, timezone)}.`
          : "No provider cooldown."}
      </p>
      <section className="np-stack">
        <h2>Identity & image coverage</h2>
        <p className="np-body-sm">
          Source records are linked using corroborating lineups or repeated fixtures. Ambiguous
          identities remain separate. Images are saved locally from PandaScore and may reflect
          current branding.
        </p>
        {entities && (
          <Table
            caption="Resolved library"
            rows={entities.counts}
            getRowKey={(r) => r.kind}
            columns={[
              { id: "kind", header: "Kind", render: (r) => r.kind },
              { id: "total", header: "Profiles", render: (r) => r.identities },
              { id: "linked", header: "Linked sources", render: (r) => r.linked },
              { id: "images", header: "With images", render: (r) => r.images },
            ]}
          />
        )}
        <p className="np-meta">
          {entities?.last
            ? `Last resolved ${dateTime(entities.last.at, timezone)} · ${entities.last.ambiguous} ambiguous candidates kept separate.`
            : "No identity resolution has run yet."}
          {entities?.images.failed
            ? ` ${entities.images.failed} image downloads unavailable; saved images retained.`
            : ""}
        </p>
        <RefreshButton kind="entities" />
      </section>
      <section className="np-stack">
        <h2>Import an annual game file</h2>
        <p className="np-body-sm">
          Choose the original Oracle’s Elixir annual CSV. Summary exports are not game records. A
          failed file leaves saved games intact.
        </p>
        <form
          className="ev-import"
          onSubmit={(e) => {
            e.preventDefault();
            void upload(e.currentTarget);
          }}
        >
          <Input
            label="Year"
            type="number"
            name="year"
            min={2014}
            max={2100}
            defaultValue={year}
            required
          />
          <Input label="Annual CSV" type="file" name="file" accept=".csv,text/csv" required />
          <Button type="submit" variant="primary" loading={pending} disabled={pending}>
            Queue local import
          </Button>
        </form>
        <p role="status">{message}</p>
        <p className="np-body-sm">
          Older years can also be queued with <code>pnpm backfill YEAR</code>. If Google Drive
          returns a download quota page, use a local CSV from the{" "}
          <TextLink
            href="https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH"
            target="_blank"
            rel="noreferrer"
          >
            official archive
          </TextLink>
          .
        </p>
      </section>
      <Table
        caption="Imported historical coverage"
        rows={status.history}
        getRowKey={(h) => String(h.year)}
        columns={[
          {
            id: "year",
            header: "Year",
            render: (h) => <TextLink href={`/history?year=${h.year}`}>{h.year}</TextLink>,
          },
          { id: "games", header: "Games", render: (h) => h.games },
          {
            id: "eligible",
            header: "Eligible games",
            render: (h) => h.eligible,
          },
          {
            id: "latest",
            header: "Latest game",
            render: (h) => dateTime(h.latestGameAt, timezone),
          },
        ]}
      />
      <Table
        caption="Recent synchronization jobs"
        rows={status.jobs}
        getRowKey={(j) => j.id}
        columns={[
          { id: "id", header: "Job", render: (j) => j.id },
          { id: "kind", header: "Refresh", render: (j) => j.kind },
          {
            id: "state",
            header: "State",
            render: (j) => (
              <StatusIndicator
                label={j.state}
                tone={j.state === "failed" ? "warning" : "neutral"}
              />
            ),
          },
          {
            id: "requested",
            header: "Queued",
            render: (j) => dateTime(j.requestedAt, timezone),
          },
          { id: "error", header: "Detail", render: (j) => j.error ?? "—" },
        ]}
      />
      <section className="np-stack ev-prose">
        <h2>Coverage & source boundaries</h2>
        <p className="np-body-sm">
          Korea, China, Europe, North America, LCP, Worlds, MSI, First Stand and EWC. Historical
          regional names are grouped for browsing. PCS, VCS, LJL and Oceania predecessors are
          included through 2024; their later second-tier competitions are excluded. LTA includes the
          northern conference and shared finals, not the southern conference.
        </p>
        <p className="np-body-sm">
          PandaScore supplies match context, available results, roster observations and broadcast
          links. Oracle’s Elixir supplies game records and played lineups. Riot Data Dragon supplies
          versioned champion and item metadata. Records are kept under their original source IDs;
          identical names do not establish identity or a series association.
        </p>
        <p className="np-body-sm">
          History is available only for imported years. Missing statistics stay unknown, and partial
          games do not contribute to summaries. Current roster observations do not establish
          contract dates. Schedules and results refresh every ten minutes; running matches every two
          minutes; rosters, metadata and current-year history daily.
        </p>
        <p className="np-body-sm">
          Twitch and YouTube players load only after consent and may set cookies and receive your IP
          address. External links remain available. Preferences are stored in a local browser
          cookie.
        </p>
      </section>
    </div>
  );
}
