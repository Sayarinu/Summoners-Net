"use client";
import { ExportLink } from "../shell/export-link";
import {
  Button,
  ChampionIdentity,
  DisclosurePanel,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  RoleIcon,
  Select,
  Table,
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
import { ChampionViews } from "./directory";
import { PageFooter } from "./paging";
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
    <div className="flex flex-col gap-0.5">
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
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Trending Champions"
        {...(trends?.patch
          ? {
              eyebrow: `Patch ${trends.patch}${trends.previousPatch ? ` vs ${trends.previousPatch}` : ""} · ${trends.currentGames} vs ${trends.previousGames} stored games`,
            }
          : {})}
      >
        <ChampionViews current="trending" />
      </PageHeader>
      <FilterBar
        action="/trending"
        method="get"
        className="border-y border-line py-3"
        key={JSON.stringify(q)}
      >
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
      </FilterBar>
      <DisclosurePanel title="How a Trend Qualifies">
        <div className="flex max-w-reading flex-col gap-3 text-sm text-fg-secondary">
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
        </div>
      </DisclosurePanel>
      {error ? (
        <p role="alert">{error}</p>
      ) : !trends?.patch ? (
        <EmptyState
          title="No Champion Aggregates for This Selection"
          description="Aggregates appear after the worker's next synchronization."
        />
      ) : (
        <>
          {!trends.previousPatch ? (
            <p role="status">No preceding catalog patch is stored. Changes are unknown.</p>
          ) : trends.previousGames === 0 ? (
            <p role="status">
              No aggregate sample is stored for the preceding patch. Changes are unknown.
            </p>
          ) : null}
          <Panel
            title={`${roleLabels[trends.query.role]} · ${trends.query.source === "solo" ? "Solo Queue" : "Pro"}`}
            padding="none"
            actions={
              <ExportLink
                table="trending"
                filters={{
                  source: trends.query.source,
                  patch: trends.patch,
                  role: trends.query.role,
                }}
              />
            }
          >
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
                    <ChampionIdentity
                      id={r.championId ?? String(r.championKey)}
                      name={r.name ?? `Champion ${r.championKey}`}
                      imageUrl={r.imageUrl}
                      size="compact"
                      className="min-w-max"
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
                {
                  id: "win",
                  header: "Win Rate Change",
                  render: (r) => <Change value={r.winRate} />,
                },
              ]}
            />
            <PageFooter
              summary={`${trends.page.total} champions · Page ${trends.page.page}`}
              label="Champion Trend Pages"
              page={trends.page.page}
              total={trends.page.total}
              pageSize={trends.page.pageSize}
              onPageChange={(page) =>
                router.push(
                  `/trending?${new URLSearchParams({ source: q!.source, patch: trends.patch!, role: q!.role, page: String(page) })}`,
                )
              }
            />
          </Panel>
        </>
      )}
    </div>
  );
}
