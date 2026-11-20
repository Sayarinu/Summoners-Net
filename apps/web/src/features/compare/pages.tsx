"use client";
import {
  Button,
  ChampionIcon,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  Panel,
  RoleIcon,
  Select,
  TabNav,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type {
  ChampionOverview,
  ChampionStats,
  SampledValue,
  TierList,
} from "@summonersnet/data/contracts";
import { SavedViewsPanel } from "../saved-views/panel";

const roles = ["ALL", "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
const roleLabels = {
  ALL: "All Roles",
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} satisfies Record<string, string>;
const percent = (v: SampledValue) =>
  v.value === null ? "Unknown" : `${(v.value * 100).toFixed(1)}%`;
const value = (v: SampledValue | null) => (v ? percent(v) : "Not stored");
const sample = (v: SampledValue | null) => (v ? String(v.sampleCount) : "0");

function Header({ title, current }: { title: string; current: "champions" | "patches" }) {
  return (
    <PageHeader eyebrow="Compare" title={title}>
      <TabNav
        label="Compare"
        items={[
          { href: "/compare/champions", label: "Champions", current: current === "champions" },
          { href: "/compare/patches", label: "Patches", current: current === "patches" },
        ]}
      />
    </PageHeader>
  );
}

function Filters({
  action,
  a,
  b,
  aLabel,
  bLabel,
  extra,
}: {
  action: string;
  a: string;
  b: string;
  aLabel: string;
  bLabel: string;
  extra?: { source: string; role: string; patch?: string };
}) {
  return (
    <FilterBar
      method="get"
      action={action}
      className="border-y border-line py-3"
      aria-label="Compare"
    >
      <Input name="a" label={aLabel} defaultValue={a} required />
      <Input name="b" label={bLabel} defaultValue={b} required />
      <Select
        label="Source"
        name="source"
        defaultValue={extra?.source ?? "solo"}
        options={[
          { value: "solo", label: "Solo Queue" },
          { value: "pro", label: "Pro Play" },
        ]}
      />
      <Select
        label="Role"
        name="role"
        defaultValue={extra?.role ?? "ALL"}
        options={roles.map((role) => ({
          label: roleLabels[role],
          value: role,
          ...(role === "ALL" ? {} : { icon: <RoleIcon role={role} /> }),
        }))}
      />
      {extra?.patch !== undefined ? (
        <Input name="patch" label="Patch (Optional)" defaultValue={extra.patch} />
      ) : null}
      <Button type="submit" variant="primary">
        Compare
      </Button>
    </FilterBar>
  );
}

/** A statistic's label, how to show it for one champion, and its sample. */
type Metric = [
  string,
  (o: ChampionOverview | null) => string,
  (o: ChampionOverview | null) => string,
];
type ChampionComparison = {
  query: { a: string; b: string; source: string; role: string; patch?: string | undefined };
  a: ChampionOverview | null;
  b: ChampionOverview | null;
};

export function ChampionComparePage({
  comparison,
  error,
  search = "",
}: {
  comparison: ChampionComparison | null;
  error: string | null;
  search?: string;
}) {
  const q = comparison?.query;
  const name = (o: ChampionOverview | null, id: string) => o?.champion.name ?? `${id} (unknown)`;
  const rows = comparison
    ? (
        [
          ["Patch", (o) => o?.patch ?? "None", () => ""],
          ["Games", (o) => (o ? String(o.games) : "Not stored"), (o) => String(o?.games ?? 0)],
          ["Win Rate", (o) => value(o?.winRate ?? null), (o) => sample(o?.winRate ?? null)],
          [
            "Win rate pulled toward the baseline",
            (o) => value(o?.shrunkWinRate ?? null),
            (o) => sample(o?.shrunkWinRate ?? null),
          ],
          ["Pick Rate", (o) => value(o?.pickRate ?? null), (o) => sample(o?.pickRate ?? null)],
          ["Ban Rate", (o) => value(o?.banRate ?? null), (o) => sample(o?.banRate ?? null)],
          ["Tier", (o) => o?.tier ?? "Unknown", (o) => sample(o?.shrunkWinRate ?? null)],
        ] satisfies Metric[]
      ).map(([metric, show, count]) => ({
        metric,
        a: show(comparison.a),
        aSample: count(comparison.a),
        b: show(comparison.b),
        bSample: count(comparison.b),
      }))
    : [];
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Header title="Champion Against Champion" current="champions" />
      <Filters
        action="/compare/champions"
        a={q?.a ?? ""}
        b={q?.b ?? ""}
        aLabel="First Champion ID"
        bLabel="Second Champion ID"
        extra={{ source: q?.source ?? "solo", role: q?.role ?? "ALL", patch: q?.patch ?? "" }}
      />
      {error ? <p role="alert">{error}</p> : null}
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)] items-start gap-4 max-[1150px]:grid-cols-1">
        {comparison ? (
          <Panel title="Comparison" padding="none">
            <Table
              caption={`${name(comparison.a, comparison.query.a)} and ${name(comparison.b, comparison.query.b)}, ${roleLabels[comparison.query.role as keyof typeof roleLabels]}`}
              rows={rows}
              getRowKey={(r) => r.metric}
              columns={[
                { id: "metric", header: "Statistic", render: (r) => r.metric },
                { id: "a", header: name(comparison.a, comparison.query.a), render: (r) => r.a },
                { id: "aSample", header: "Sample", align: "end", render: (r) => r.aSample },
                { id: "b", header: name(comparison.b, comparison.query.b), render: (r) => r.b },
                { id: "bSample", header: "Sample", align: "end", render: (r) => r.bSample },
              ]}
            />
          </Panel>
        ) : !error ? (
          <EmptyState
            title="Choose Two Champions"
            description="Enter two Data Dragon champion ids, such as Ahri and Zed."
          />
        ) : (
          <div />
        )}
        <SavedViewsPanel
          path="/compare/champions"
          query={search}
          defaultName={q ? `${q.a} vs ${q.b}` : ""}
        />
      </div>
    </div>
  );
}

type PatchComparison = {
  query: { a: string; b: string; source: string; role: string; page: number };
  a: TierList | null;
  b: ChampionStats | null;
};

export function PatchComparePage({
  comparison,
  error,
  search = "",
}: {
  comparison: PatchComparison | null;
  error: string | null;
  search?: string;
}) {
  const q = comparison?.query;
  const other = new Map(
    (comparison?.b?.rows ?? []).map((r) => [`${r.championKey}:${r.role}`, r] as const),
  );
  const rows = (comparison?.a?.page.items ?? []).map((r) => ({
    ...r,
    other: other.get(`${r.championKey}:${r.role}`) ?? null,
  }));
  const page = comparison?.a?.page;
  const pageHref = (n: number) => {
    const params = new URLSearchParams(search);
    params.set("page", String(n));
    return `/compare/patches?${params.toString()}`;
  };
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Header title="Patch Against Patch" current="patches" />
      <Filters
        action="/compare/patches"
        a={q?.a ?? ""}
        b={q?.b ?? ""}
        aLabel="First Patch"
        bLabel="Second Patch"
        extra={{ source: q?.source ?? "solo", role: q?.role ?? "ALL" }}
      />
      {error ? <p role="alert">{error}</p> : null}
      {comparison && !comparison.a ? (
        <EmptyState
          title={`No Statistics for Patch ${comparison.query.a}`}
          description="Choose a patch with stored aggregates as the first patch."
        />
      ) : null}
      {comparison?.a ? (
        <>
          {!comparison.b || !comparison.b.rows.length ? (
            <p role="status" className="text-sm text-fg-secondary">
              Patch {comparison.query.b} has no stored statistics for this source and role.
            </p>
          ) : null}
          <Panel title="Comparison" padding="none">
            <Table
              caption={`Patch ${comparison.query.a} and patch ${comparison.query.b}, ${roleLabels[comparison.query.role as keyof typeof roleLabels]}`}
              rows={rows}
              getRowKey={(r) => `${r.championKey}:${r.role}`}
              columns={[
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => (
                    <ChampionIcon
                      id={r.championId ?? String(r.championKey)}
                      name={r.name ?? r.championId ?? `Champion ${r.championKey}`}
                      imageUrl={r.imageUrl}
                      size="small"
                      href={r.championId ? `/champions/${r.championId}` : undefined}
                    />
                  ),
                },
                {
                  id: "aWin",
                  header: `Win Rate ${comparison.query.a}`,
                  render: (r) => `${percent(r.winRate)} (${r.winRate.sampleCount})`,
                },
                {
                  id: "bWin",
                  header: `Win Rate ${comparison.query.b}`,
                  render: (r) =>
                    r.other
                      ? `${percent(r.other.winRate)} (${r.other.winRate.sampleCount})`
                      : "Not stored (0)",
                },
                {
                  id: "aPick",
                  header: `Pick Rate ${comparison.query.a}`,
                  render: (r) => `${percent(r.pickRate)} (${r.pickRate.sampleCount})`,
                },
                {
                  id: "bPick",
                  header: `Pick Rate ${comparison.query.b}`,
                  render: (r) =>
                    r.other
                      ? `${percent(r.other.pickRate)} (${r.other.pickRate.sampleCount})`
                      : "Not stored (0)",
                },
              ]}
            />
            {page && page.total > page.pageSize ? (
              <nav aria-label="Pages" className="flex items-center justify-between gap-4 px-4 py-3">
                {page.page > 1 ? (
                  <TextLink href={pageHref(page.page - 1)}>Previous Page</TextLink>
                ) : null}
                <span className="np-meta text-accent">
                  Page {page.page} of {Math.ceil(page.total / page.pageSize)}
                </span>
                {page.page * page.pageSize < page.total ? (
                  <TextLink href={pageHref(page.page + 1)}>Next Page</TextLink>
                ) : null}
              </nav>
            ) : null}
          </Panel>
        </>
      ) : null}
      {!comparison && !error ? (
        <EmptyState
          title="Choose Two Patches"
          description="Enter two patches with stored statistics, such as 16.21 and 16.22."
        />
      ) : null}
      <SavedViewsPanel
        path="/compare/patches"
        query={search}
        defaultName={q ? `Patch ${q.a} vs ${q.b}` : ""}
      />
    </div>
  );
}
