"use client";
import { RoleIcon } from "@summonersnet/ui";
import { ExportLink } from "../shell/export-link";
import { Button, ChampionIcon, EmptyState, Pagination, Select, Table } from "@summonersnet/ui";
import {
  championRoles,
  trendMinimumSample,
  trendMinimumOutcomes,
  trendCriticalZ,
  type ProportionTrend,
  type TrendingChampions,
} from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { percent, roleLabels } from "./presentation";
function Change({ value }: { value: ProportionTrend }) {
  const rate = (r: ProportionTrend["current"]) => `${percent(r)} · n=${r.sampleCount}`;
  const reason = {
    missing: "Comparison unavailable",
    "small-sample": "Too Few Games",
    "sparse-outcomes": "Too few successes or failures",
    "not-significant": "No significant signal",
    significant: value.direction === "rising" ? "Rising" : "Falling",
  }[value.reason];
  return (
    <div className="np-stack">
      <span>Current: {rate(value.current)}</span>
      <span>Previous: {rate(value.previous)}</span>
      <span>
        {value.delta === null
          ? "Unknown change"
          : `${value.delta > 0 ? "+" : ""}${(value.delta * 100).toFixed(1)} pp`}{" "}
        · {reason}
      </span>
    </div>
  );
}
export function TrendingPage({
  trends,
  error,
}: {
  trends: TrendingChampions | null;
  error: string | null;
}) {
  const router = useRouter();
  const q = trends?.query;
  const patches = [...new Set([...(trends?.patches ?? []), ...(q?.patch ? [q.patch] : [])])];
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Trending Champions</h1>
        </div>
      </header>
      <form action="/trending" method="get" className="ev-filters" key={JSON.stringify(q)}>
        <Select
          label="Source"
          name="source"
          defaultValue={q?.source ?? "solo"}
          options={[
            { value: "solo", label: "Solo Queue" },
            { value: "pro", label: "Pro" },
          ]}
        />
        <Select
          label="Patch"
          name="patch"
          defaultValue={q?.patch ?? "all"}
          options={[
            { value: "all", label: "Newest with Data" },
            ...patches.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label="Role"
          name="role"
          defaultValue={q?.role ?? "ALL"}
          options={championRoles.map((r) => ({
            value: r,
            label: roleLabels[r],
            icon: <RoleIcon role={r} />,
          }))}
        />
        <Button type="submit">Apply Filters</Button>
      </form>
      <details>
        <summary>How a Trend Qualifies</summary>
        <p>
          Both patches need at least {trendMinimumSample} observations and {trendMinimumOutcomes}{" "}
          successes and failures each. A pooled two-proportion test must exceed |z| ={" "}
          {trendCriticalZ} (nominal two-sided 5%). Pick samples count match opportunities; win
          samples count known champion results. This exploratory test treats observations as
          independent and does not adjust for multiple comparisons.
        </p>
        <p>
          Solo queue uses ranked solo games only. Missing champions, results or patch samples stay
          unknown. A missing previous patch sample is never replaced by an older patch.
        </p>
      </details>
      {error ? (
        <p role="alert">{error}</p>
      ) : !trends?.patch ? (
        <EmptyState
          title="No Champion Aggregates for This Selection"
          description="Aggregates appear after the worker's next synchronization."
        />
      ) : (
        <>
          <p>
            Patch {trends.patch}
            {trends.previousPatch ? ` vs ${trends.previousPatch}` : ""}
          </p>
          <p className="np-meta">
            Current: {trends.currentGames} stored games · Previous: {trends.previousGames} stored
            games
          </p>
          {!trends.previousPatch ? (
            <p role="status">No preceding catalog patch is stored. Changes are unknown.</p>
          ) : trends.previousGames === 0 ? (
            <p role="status">
              No aggregate sample is stored for the preceding patch. Changes are unknown.
            </p>
          ) : null}
          <ExportLink
            table="trending"
            filters={{ source: trends.query.source, patch: trends.patch, role: trends.query.role }}
          />
          <Table
            caption="Champion Changes Between Patches"
            rows={trends.page.items}
            getRowKey={(r) => String(r.championKey)}
            emptyMessage="No champion aggregates for this role and page."
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => (
                  <ChampionIcon
                    id={r.championId ?? String(r.championKey)}
                    name={r.name ?? `Champion ${r.championKey}`}
                    imageUrl={r.imageUrl}
                    size="small"
                    href={
                      r.championId
                        ? `/champions/${r.championId}?source=${q!.source}&patch=${trends.patch}&role=${r.role}`
                        : undefined
                    }
                  />
                ),
              },
              { id: "role", header: "Role", render: (r) => <RoleIcon role={r.role} /> },
              {
                id: "pick",
                header: "Pick Rate Change",
                render: (r) => <Change value={r.pickRate} />,
              },
              { id: "win", header: "Win Rate Change", render: (r) => <Change value={r.winRate} /> },
            ]}
          />
          <div className="ev-pagination">
            <span className="np-meta">
              {trends.page.total} champions · Page {trends.page.page}
            </span>
            <Pagination
              label="Champion Trend Pages"
              currentPage={trends.page.page}
              totalPages={Math.max(1, Math.ceil(trends.page.total / trends.page.pageSize))}
              onPageChange={(page) =>
                router.push(
                  `/trending?${new URLSearchParams({ source: q!.source, patch: trends.patch!, role: q!.role, page: String(page) })}`,
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
