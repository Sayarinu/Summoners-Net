"use client";
import { Button, EmptyState, Input, Table, TextLink } from "@summonersnet/ui";
import type {
  ChampionOverview,
  ChampionStats,
  SampledValue,
  TierList,
} from "@summonersnet/data/contracts";
import { SavedViewsPanel } from "../saved-views/panel";

const roles = ["ALL", "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
const roleLabels: Record<string, string> = {
  ALL: "All roles",
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};
const percent = (v: SampledValue) =>
  v.value === null ? "Unknown" : `${(v.value * 100).toFixed(1)}%`;
const value = (v: SampledValue | null) => (v ? percent(v) : "Not stored");
const sample = (v: SampledValue | null) => (v ? String(v.sampleCount) : "0");

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
    <form method="get" action={action} className="ev-filters" aria-label="Compare">
      <Input name="a" label={aLabel} defaultValue={a} required />
      <Input name="b" label={bLabel} defaultValue={b} required />
      <label className="np-field">
        <span>Source</span>
        <select name="source" defaultValue={extra?.source ?? "solo"}>
          <option value="solo">Solo queue</option>
          <option value="pro">Pro play</option>
        </select>
      </label>
      <label className="np-field">
        <span>Role</span>
        <select name="role" defaultValue={extra?.role ?? "ALL"}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </label>
      {extra?.patch !== undefined ? (
        <Input name="patch" label="Patch (optional)" defaultValue={extra.patch} />
      ) : null}
      <Button type="submit" variant="primary">
        Compare
      </Button>
    </form>
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
          ["Win rate", (o) => value(o?.winRate ?? null), (o) => sample(o?.winRate ?? null)],
          [
            "Win rate pulled toward the baseline",
            (o) => value(o?.shrunkWinRate ?? null),
            (o) => sample(o?.shrunkWinRate ?? null),
          ],
          ["Pick rate", (o) => value(o?.pickRate ?? null), (o) => sample(o?.pickRate ?? null)],
          ["Ban rate", (o) => value(o?.banRate ?? null), (o) => sample(o?.banRate ?? null)],
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
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Compare</span>
          <h1>Champion against champion</h1>
          <p>
            Two champions on the same source, role and patch, from stored aggregates. Each value
            shows the sample it comes from.{" "}
            <TextLink href="/compare/patches">Compare patches</TextLink>
          </p>
        </div>
      </header>
      <Filters
        action="/compare/champions"
        a={q?.a ?? ""}
        b={q?.b ?? ""}
        aLabel="First champion id"
        bLabel="Second champion id"
        extra={{ source: q?.source ?? "solo", role: q?.role ?? "ALL", patch: q?.patch ?? "" }}
      />
      {error ? <p role="alert">{error}</p> : null}
      {comparison ? (
        <Table
          caption={`${name(comparison.a, comparison.query.a)} and ${name(comparison.b, comparison.query.b)}, ${roleLabels[comparison.query.role]}`}
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
      ) : !error ? (
        <EmptyState
          title="Choose two champions"
          description="Enter two Data Dragon champion ids, such as Ahri and Zed."
        />
      ) : null}
      <SavedViewsPanel
        path="/compare/champions"
        query={search}
        defaultName={q ? `${q.a} vs ${q.b}` : ""}
      />
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
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Compare</span>
          <h1>Patch against patch</h1>
          <p>
            Champions ordered by games on the first patch, with the same champions&apos; statistics
            on the second. Each value shows its sample.{" "}
            <TextLink href="/compare/champions">Compare champions</TextLink>
          </p>
        </div>
      </header>
      <Filters
        action="/compare/patches"
        a={q?.a ?? ""}
        b={q?.b ?? ""}
        aLabel="First patch"
        bLabel="Second patch"
        extra={{ source: q?.source ?? "solo", role: q?.role ?? "ALL" }}
      />
      {error ? <p role="alert">{error}</p> : null}
      {comparison && !comparison.a ? (
        <EmptyState
          title={`No statistics for patch ${comparison.query.a}`}
          description="Choose a patch with stored aggregates as the first patch."
        />
      ) : null}
      {comparison?.a ? (
        <>
          {!comparison.b || !comparison.b.rows.length ? (
            <p role="status">
              Patch {comparison.query.b} has no stored statistics for this source and role.
            </p>
          ) : null}
          <Table
            caption={`Patch ${comparison.query.a} and patch ${comparison.query.b}, ${roleLabels[comparison.query.role]}`}
            rows={rows}
            getRowKey={(r) => `${r.championKey}:${r.role}`}
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) =>
                  r.championId ? (
                    <TextLink href={`/champions/${r.championId}`}>
                      {r.name ?? r.championId}
                    </TextLink>
                  ) : (
                    `Champion ${r.championKey}`
                  ),
              },
              {
                id: "aWin",
                header: `Win rate ${comparison.query.a}`,
                render: (r) => `${percent(r.winRate)} (${r.winRate.sampleCount})`,
              },
              {
                id: "bWin",
                header: `Win rate ${comparison.query.b}`,
                render: (r) =>
                  r.other
                    ? `${percent(r.other.winRate)} (${r.other.winRate.sampleCount})`
                    : "Not stored (0)",
              },
              {
                id: "aPick",
                header: `Pick rate ${comparison.query.a}`,
                render: (r) => `${percent(r.pickRate)} (${r.pickRate.sampleCount})`,
              },
              {
                id: "bPick",
                header: `Pick rate ${comparison.query.b}`,
                render: (r) =>
                  r.other
                    ? `${percent(r.other.pickRate)} (${r.other.pickRate.sampleCount})`
                    : "Not stored (0)",
              },
            ]}
          />
          {page && page.total > page.pageSize ? (
            <nav aria-label="Pages" className="ev-filters">
              {page.page > 1 ? (
                <TextLink href={pageHref(page.page - 1)}>Previous page</TextLink>
              ) : null}
              <span className="np-meta">
                Page {page.page} of {Math.ceil(page.total / page.pageSize)}
              </span>
              {page.page * page.pageSize < page.total ? (
                <TextLink href={pageHref(page.page + 1)}>Next page</TextLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : null}
      {!comparison && !error ? (
        <EmptyState
          title="Choose two patches"
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
