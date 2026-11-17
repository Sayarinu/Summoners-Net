"use client";
import { ExportLink } from "../shell/export-link";
import {
  Button,
  ChampionIcon,
  EmptyState,
  Pagination,
  Select,
  Table,
  TextLink,
} from "@summonersnet/ui";
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
    "small-sample": "Too few games",
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
          <span className="np-overline">Patch comparison</span>
          <h1>Trending champions</h1>
          <p>Pick and win rate changes from the preceding patch, with samples for both.</p>
        </div>
      </header>
      <form action="/trending" method="get" className="ev-filters" key={JSON.stringify(q)}>
        <Select
          label="Source"
          name="source"
          defaultValue={q?.source ?? "solo"}
          options={[
            { value: "solo", label: "Solo queue" },
            { value: "pro", label: "Pro" },
          ]}
        />
        <Select
          label="Patch"
          name="patch"
          defaultValue={q?.patch ?? "all"}
          options={[
            { value: "all", label: "Newest with data" },
            ...patches.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label="Role"
          name="role"
          defaultValue={q?.role ?? "ALL"}
          options={championRoles.map((r) => ({ value: r, label: roleLabels[r] }))}
        />
        <Button type="submit">Apply filters</Button>
      </form>
      <details>
        <summary>How a trend qualifies</summary>
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
          title="No champion aggregates for this selection"
          description={
            <span>
              Refresh metadata and aggregates in <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      ) : (
        <>
          <p>
            {q?.source === "pro" ? "Pro" : "Solo queue"} · {roleLabels[q!.role]} · Patch{" "}
            {trends.patch} vs {trends.previousPatch ?? "no preceding catalog patch"}
          </p>
          <p className="np-meta">
            Current: {trends.currentGames} stored games · Previous: {trends.previousGames} stored
            games. Rates describe the retained samples.
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
            caption="Champion changes between patches"
            rows={trends.page.items}
            getRowKey={(r) => String(r.championKey)}
            emptyMessage="No champion aggregates for this role and page."
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => (
                  <span className="ev-champion">
                    <ChampionIcon
                      id={r.championId ?? String(r.championKey)}
                      name={r.name ?? `Champion ${r.championKey}`}
                      imageUrl={r.imageUrl}
                      size="small"
                    />
                    {r.championId ? (
                      <TextLink
                        href={`/champions/${r.championId}?source=${q!.source}&patch=${trends.patch}&role=${r.role}`}
                      >
                        {r.name ?? r.championId}
                      </TextLink>
                    ) : (
                      (r.name ?? `Champion ${r.championKey}`)
                    )}
                  </span>
                ),
              },
              { id: "role", header: "Role", render: (r) => roleLabels[r.role] },
              {
                id: "pick",
                header: "Pick rate change",
                render: (r) => <Change value={r.pickRate} />,
              },
              { id: "win", header: "Win rate change", render: (r) => <Change value={r.winRate} /> },
            ]}
          />
          <div className="ev-pagination">
            <span className="np-meta">
              {trends.page.total} champions · Page {trends.page.page}
            </span>
            <Pagination
              label="Champion trend pages"
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
