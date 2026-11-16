import { StatusIndicator, Table } from "@summonersnet/ui";
import type { RiotCrawlStatus } from "@summonersnet/data";
import { dateTime } from "../browse/presentation";
import { RefreshButton } from "./refresh";

const jobLabels: Record<string, string> = {
  "riot-key": "Key check",
  "riot-ladder": "Apex ladders",
  "riot-accounts": "Accounts",
  "riot-match-ids": "Match id crawl",
  "riot-match": "Match details",
  "riot-timeline": "Timelines",
  "riot-retention": "Retention",
};
const methodLabel = (method: string) => method || "All methods (application limit)";
const windowLabel = (seconds: number) =>
  seconds % 60 === 0 && seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;

export function RiotCrawlerSection({
  crawl,
  timezone,
}: {
  crawl: RiotCrawlStatus;
  timezone: string;
}) {
  const when = (iso: string | null) => (iso ? dateTime(iso, timezone) : "Never");
  return (
    <section className="np-stack" aria-labelledby="riot-crawler-heading">
      <h2 id="riot-crawler-heading">Riot crawler</h2>
      <p className="np-body-sm">
        The local worker crawls ranked solo queue from the apex ladders. Queuing a crawl only adds a
        job; this page never contacts Riot.
      </p>
      <RefreshButton kind="riot-match-ids" label="Queue crawl" />
      {crawl.progress.length ? (
        <Table
          caption="Crawl progress by region and patch"
          rows={crawl.progress}
          getRowKey={(p) => `${p.region}:${p.patchKey}`}
          columns={[
            { id: "region", header: "Region", render: (p) => p.region },
            { id: "patch", header: "Patch", render: (p) => p.patchKey },
            { id: "players", header: "Ladder players", render: (p) => p.ladderPlayers },
            { id: "ids", header: "Match ids found", render: (p) => p.matchIds },
            { id: "matches", header: "Matches ingested", render: (p) => p.matches },
            { id: "timelines", header: "Timelines ingested", render: (p) => p.timelines },
          ]}
        />
      ) : (
        <p className="np-meta">No ladder or match data yet.</p>
      )}
      {crawl.jobs.length > 0 && (
        <Table
          caption="Riot jobs"
          rows={crawl.jobs}
          getRowKey={(j) => j.kind}
          columns={[
            { id: "job", header: "Job", render: (j) => jobLabels[j.kind] ?? j.kind },
            { id: "success", header: "Last success", render: (j) => when(j.lastSuccess) },
            { id: "error", header: "Last error", render: (j) => when(j.lastErrorAt) },
            {
              id: "detail",
              header: "Status",
              render: (j) =>
                j.error && (!j.lastSuccess || (j.lastErrorAt ?? "") > j.lastSuccess) ? (
                  <StatusIndicator label={j.error} tone="warning" />
                ) : (
                  <StatusIndicator label="Ready" tone="success" />
                ),
            },
          ]}
        />
      )}
      {crawl.quota.length > 0 ? (
        <Table
          caption="Riot request quota"
          rows={crawl.quota}
          getRowKey={(q) => `${q.region}:${q.method}`}
          columns={[
            { id: "region", header: "Route", render: (q) => q.region },
            { id: "method", header: "Method", render: (q) => methodLabel(q.method) },
            {
              id: "use",
              header: "Use per window",
              render: (q) =>
                q.windows.length
                  ? q.windows
                      .map((w) => `${w.used} / ${w.limit} per ${windowLabel(w.windowSeconds)}`)
                      .join(", ")
                  : "Limit not reported yet",
            },
            {
              id: "paused",
              header: "Paused until",
              render: (q) => (q.pausedUntil ? dateTime(q.pausedUntil, timezone) : "—"),
            },
          ]}
        />
      ) : (
        <p className="np-meta">No Riot requests in the last hour.</p>
      )}
    </section>
  );
}
