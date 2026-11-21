"use client";
import type { ReactNode } from "react";
import { ExportLink } from "../shell/export-link";
import {
  RoleIcon,
  Button,
  ChampionIcon,
  ChampionIdentity,
  FilterBar,
  HeatGrid,
  MultiSelect,
  PageHeader,
  Panel,
  Select,
  Stat,
  StatGroup,
  TabNav,
  Table,
  TextLink,
} from "@summonersnet/ui";
import {
  matchupMetrics,
  matchupRoles,
  matchupMinimumSample,
  blindabilityMinimumCoverage,
  blindabilityMinimumOpponents,
  blindabilityTailShare,
  counterPickSorts,
  type BlindabilityReason,
  type ChampionBlindability,
  type CounterPickList,
  type CounterPickReason,
  type ChampionMatchups,
  type MatchupMatrix,
  type MatchupMetric,
  type PatchChampion,
} from "@summonersnet/data/contracts";
import { ChampionPages, championHeatmapsHref } from "../champions/champion-pages";
import { goToPage, PageFooter } from "../champions/paging";
import { appendPatches, patchesLabel } from "../champions/presentation";
const roles = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} as const;
type Role = keyof typeof roles;
const metrics: Record<MatchupMetric, string> = {
  winRate: "Win Rate",
  gold10: "Gold Δ at 10",
  gold15: "Gold Δ at 15",
  xp10: "XP Δ at 10",
  xp15: "XP Δ at 15",
  cs10: "CS Δ at 10",
  cs15: "CS Δ at 15",
  firstBlood: "Team First Blood",
  firstTower: "Team First Tower",
};
const sources = { solo: "Solo Queue", pro: "Pro" } as Record<string, string>;
const isRate = (metric: MatchupMetric) => ["winRate", "firstBlood", "firstTower"].includes(metric);
const display = (value: number | null, metric: MatchupMetric) =>
  value === null
    ? "Unknown"
    : isRate(metric)
      ? `${(value * 100).toFixed(1)}%`
      : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const name = (c: PatchChampion) => c.name ?? c.championId ?? `Champion ${c.championKey}`;
/** Two related panels side by side, the first wider, stacking on narrow screens. */
const pairGrid =
  "grid grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)] items-start gap-4 max-[1150px]:grid-cols-1";
const toolbar = "flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-line py-3";
function selection(q: { source: string; value: string }, patch: string | null | readonly string[]) {
  const params = new URLSearchParams({ source: q.source, value: q.value });
  return appendPatches(params, typeof patch === "string" ? [patch] : (patch ?? []));
}
/** The role list takes only source and patch filters. */
function counterPicksHref(role: string, source: string, patch: string | null) {
  const params = new URLSearchParams({ source });
  if (patch) params.set("patch", patch);
  return `/matchups/${role}/counter-picks?${params}`;
}
function Champion({ champion: c, href }: { champion: PatchChampion; href?: string }) {
  return (
    <ChampionIdentity
      id={c.championId ?? String(c.championKey)}
      name={name(c)}
      imageUrl={c.imageUrl}
      size="compact"
      className="min-w-max"
      href={href}
    />
  );
}
function Filters({
  query: q,
  patches,
  patch,
  chosen,
}: {
  query: { source: string; value: string };
  patches: string[];
  patch: string | null;
  /** Patches the reader chose to combine; the patch filter then takes several. */
  chosen?: readonly string[] | undefined;
}) {
  const choices = [...new Set([...(patch ? [patch] : []), ...patches])];
  const patchOptions = choices.map((p) => ({ value: p, label: p }));
  return (
    <>
      <Select
        label="Source"
        name="source"
        defaultValue={q.source}
        options={[
          { value: "solo", label: "Solo Queue" },
          { value: "pro", label: "Pro" },
        ]}
      />
      {chosen ? (
        <MultiSelect
          label="Patches"
          name="patch"
          defaultValue={chosen}
          placeholder="Latest with Enough Games"
          options={patchOptions}
        />
      ) : (
        <Select
          label="Patch"
          name="patch"
          defaultValue={patch ?? "all"}
          options={[{ value: "all", label: "Latest Available" }, ...patchOptions]}
        />
      )}
      <Select
        label="Values"
        name="value"
        defaultValue={q.value}
        options={[
          { value: "shrunk", label: "Shrunk" },
          { value: "raw", label: "Raw" },
        ]}
      />
    </>
  );
}
function Pages({
  label,
  field,
  page,
  total,
  size,
  note,
}: {
  label: string;
  field: string;
  page: number;
  total: number;
  size: number;
  note?: string | undefined;
}) {
  return (
    <PageFooter
      summary={`${label}: page ${page} · ${total} champions${note ? ` · ${note}` : ""}`}
      label={label}
      page={page}
      total={total}
      pageSize={size}
      onPageChange={(p) => goToPage(field, p)}
    />
  );
}
/** The header and role toolbar shared by a role's matchup matrix and counter-pick values. */
function RolePage({
  role,
  view,
  eyebrow,
  matrixHref,
  counterHref,
  roleHref,
  filters,
  children,
}: {
  role: Role;
  view: "matrix" | "counter-picks";
  eyebrow?: string | undefined;
  matrixHref: string;
  counterHref: string;
  roleHref: (role: Role) => string;
  filters?: ReactNode;
  children: ReactNode;
}) {
  const title = `${roles[role]} ${view === "matrix" ? "Matchup Matrix" : "Counter-Pick Values"}`;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Champions", href: "/champions" }, { label: title }]}
        title={title}
        {...(eyebrow ? { eyebrow } : {})}
      >
        <TabNav
          label="Matchup Views"
          items={[
            { href: matrixHref, label: "Matchup Matrix", current: view === "matrix" },
            { href: counterHref, label: "Counter-Pick Values", current: view !== "matrix" },
          ]}
        />
      </PageHeader>
      <div className={toolbar}>
        <TabNav
          label={view === "matrix" ? "Matchup Roles" : "Counter-Pick Roles"}
          variant="segmented"
          items={matchupRoles.map((r) => ({
            href: roleHref(r),
            label: <RoleIcon role={r} />,
            current: r === role,
          }))}
        />
        {filters}
      </div>
      {children}
    </div>
  );
}
const percent = (value: number | null) =>
  value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;
const blindabilityReasons: Record<BlindabilityReason, string> = {
  "no-opponent-picks": "No opponent picks are recorded in this role and patch.",
  "few-opponents": `Fewer than ${blindabilityMinimumOpponents} opponents have at least ${matchupMinimumSample} win-rate observations.`,
  "low-coverage": `Opponents with at least ${matchupMinimumSample} win-rate observations cover less than ${blindabilityMinimumCoverage * 100}% of opponent picks.`,
};
const points = (value: number | null) =>
  value === null ? "Unknown" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
const counterPickReasons: Record<CounterPickReason, string> = {
  "blind-unavailable": "The blind win rate is unknown, so there is nothing to compare with.",
  "never-best-response":
    "This champion is not the best sampled response to any opponent in this role and patch.",
};
const statGrid = "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-5";
/** Blind and best-response counter-pick win rates, with their coverage and samples. */
export function CounterPickSummary({
  value: v,
  listHref,
}: {
  value: ChampionBlindability;
  listHref: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StatGroup label="Counter-Pick Statistics" className={statGrid}>
        <Stat label="Blind Win Rate" value={percent(v.expected)} />
        <Stat label="Counter-Pick Win Rate" value={percent(v.counterWinRate)} />
        <Stat label="Counter-Pick Value" value={points(v.counterDifference)} />
        <Stat
          label="Best Response To"
          value={v.counterOpponents}
          detail={`${v.counterOpponents === 1 ? "opponent" : "opponents"} · ${v.counterPicks} of ${v.rolePicks} opponent picks`}
        />
      </StatGroup>
      {v.counterReason ? (
        <p role="status" className="text-sm text-fg-secondary">
          Counter-pick value unavailable: {counterPickReasons[v.counterReason]}
        </p>
      ) : null}
      <p className="text-sm">
        <TextLink href={listHref}>Compare the Role</TextLink>
      </p>
    </div>
  );
}
function BlindabilityMethod() {
  const tail = blindabilityTailShare * 100;
  return (
    <details className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-fg-secondary">
      <summary className="cursor-pointer text-fg">How Blindability Is Calculated</summary>
      <div className="mt-2 flex max-w-reading flex-col gap-3">
        <p>
          A champion is safe to pick blind when it has few bad matchups that opponents actually
          pick. Each opponent’s win rate is the shrunk matchup estimate shown below. Opponents with
          fewer than {matchupMinimumSample} win-rate observations are left out, and the covered pick
          share says how much of the role’s opponent picks remain. Each opponent is weighted by how
          often it is picked in this role, patch and source (its paired lane games, w).
        </p>
        <pre className="overflow-x-auto rounded-md bg-raised p-3 text-xs">{`expected  E = Σ wᵢ·pᵢ / Σ wᵢ
worst     min pᵢ   (the enemy counter-picks optimally)
variance  Σ wᵢ·(pᵢ − E)² / Σ wᵢ
tail      mean pᵢ over the worst ${tail}% of Σ wᵢ, worst matchups first
score     tail`}</pre>
        <p>
          The score is the lower-tail win rate: what the champion can expect when the enemy picks
          from its worst common matchups. It is unknown when fewer than{" "}
          {blindabilityMinimumOpponents} opponents meet the minimum or they cover less than{" "}
          {blindabilityMinimumCoverage * 100}% of opponent picks. Like the matchups, it describes
          stored samples and is not evidence of causation.
        </p>
      </div>
    </details>
  );
}
function Blindability({ score: b }: { score: ChampionBlindability | null }) {
  const tail = blindabilityTailShare * 100;
  return (
    <Panel title="Blindability">
      <div className="flex flex-col gap-4">
        {!b ? (
          <p className="np-meta">No stored blindability score for this role, source and patch.</p>
        ) : (
          <>
            <StatGroup label="Blindability Statistics" className={statGrid}>
              <Stat label="Blindability Score" value={percent(b.score)} tone="accent" />
              <Stat label="Pick-Weighted Win Rate" value={percent(b.expected)} />
              <Stat
                label="Counter-Pick Worst Case"
                value={percent(b.worstCase)}
                {...(b.worstOpponent ? { detail: `against ${name(b.worstOpponent)}` } : {})}
              />
              <Stat
                label={`Lower-Tail Win Rate (${tail}% of Picks)`}
                value={percent(b.lowerTail)}
              />
              <Stat
                label="Variance"
                value={b.variance === null ? "Unknown" : b.variance.toFixed(4)}
              />
              <Stat
                label="Covered Pick Share"
                value={percent(b.coverage)}
                detail={`${b.coveredPicks} of ${b.rolePicks} opponent picks`}
              />
            </StatGroup>
            {b.reason ? (
              <p role="status" className="text-sm text-fg-secondary">
                Score unavailable: {blindabilityReasons[b.reason]}
              </p>
            ) : null}
            <p className="np-meta">
              {b.coveredOpponents} of {b.sampledOpponents} sampled opponents meet the minimum ·{" "}
              {b.games} lane games
            </p>
          </>
        )}
        <BlindabilityMethod />
      </div>
    </Panel>
  );
}
export function ChampionMatchupsPage({
  matchups: m,
  blindability = null,
  error,
}: {
  matchups: ChampionMatchups | null;
  blindability?: ChampionBlindability | null;
  error: string | null;
}) {
  if (!m)
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader
          breadcrumbs={[{ label: "Champions", href: "/champions" }, { label: "Matchups" }]}
          title="Champion Matchups"
        />
        <p role="alert">{error}</p>
      </div>
    );
  const q = m.query,
    params = selection(q, m.combined);
  params.set("role", q.role);
  const championName = name(m.champion);
  const championHref = `/champions/${encodeURIComponent(q.champion)}`;
  const score = m.patch ? blindability : null;
  const listHref = counterPicksHref(q.role, q.source, m.patch);
  const overviewParams = appendPatches(new URLSearchParams({ source: q.source }), m.combined);
  overviewParams.set("role", q.role);
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Champions", href: "/champions" },
          { label: championName, href: championHref },
          { label: "Lane Matchups" },
        ]}
        eyebrow={[
          sources[q.source],
          roles[q.role],
          patchesLabel(m.combined),
          q.value === "raw" ? "Raw observations" : "Shrunk estimates",
          `${m.page.total} opponents`,
        ].join(" · ")}
        title={`${championName} Matchups`}
        actions={
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <TextLink href={`/matchups/${q.role}?${selection(q, m.patch)}`}>
              {roles[q.role]} Matchup Matrix
            </TextLink>
            <TextLink href={listHref}>{roles[q.role]} Counter-Pick Values</TextLink>
          </span>
        }
      >
        <ChampionPages
          current="matchups"
          overviewHref={`${championHref}?${overviewParams}`}
          matchupsHref={`${championHref}/matchups?${params}`}
          heatmapsHref={championHeatmapsHref(q.champion, q.source, m.patch)}
        />
      </PageHeader>
      <FilterBar
        className="border-y border-line py-3"
        method="get"
        action={`/champions/${q.champion}/matchups`}
      >
        <Filters query={q} patches={m.patches} patch={m.patch} chosen={q.patch ?? []} />
        <Select
          label="Role"
          name="role"
          defaultValue={q.role}
          options={matchupRoles.map((r) => ({
            value: r,
            label: roles[r],
            icon: <RoleIcon role={r} />,
          }))}
        />
        <Select
          label="Sort Opponents By"
          name="sort"
          defaultValue={q.sort}
          options={[
            { value: "games", label: "Games" },
            ...matchupMetrics.map((metric) => ({ value: metric, label: metrics[metric] })),
          ]}
        />
        <Select
          label="Order"
          name="order"
          defaultValue={q.order}
          options={[
            { value: "desc", label: "Descending" },
            { value: "asc", label: "Ascending" },
          ]}
        />
        <input type="hidden" name="pageSize" value={q.pageSize} />
        <Button type="submit">Apply Filters</Button>
      </FilterBar>
      {score && score.score !== null ? (
        <div className={pairGrid}>
          <Blindability score={score} />
          <Panel title="Counter-Pick Value">
            <CounterPickSummary value={score} listHref={listHref} />
          </Panel>
        </div>
      ) : (
        <p role="status" className="text-sm text-fg-secondary">
          Blindability and counter-pick value are unavailable:{" "}
          {score?.reason
            ? `${blindabilityReasons[score.reason]} ${score.coveredOpponents} of ${score.sampledOpponents} sampled opponents meet the minimum.`
            : "no stored score for this role, source and patch."}{" "}
          <TextLink href={listHref}>Compare the Role</TextLink>
        </p>
      )}
      <Panel
        title="Lane Opponents"
        padding="none"
        actions={
          <ExportLink
            table="champion-matchups"
            filters={{
              champion: q.champion,
              source: q.source,
              patch: m.combined.join(","),
              role: q.role,
              sort: q.sort,
              order: q.order,
            }}
          />
        }
      >
        <Table
          caption={`${championName} Lane Opponents`}
          rows={m.page.items}
          getRowKey={(r) => String(r.opponent.championKey)}
          emptyMessage={
            m.hiddenOpponents
              ? `No opponent has ${m.minimumGames} games in this role and patch yet.`
              : "No matchup observations on this page. Try another role, source, patch or page."
          }
          columns={[
            {
              id: "opponent",
              header: "Opponent",
              render: (r) => (
                <Champion
                  champion={r.opponent}
                  {...(r.opponent.championId
                    ? { href: `/champions/${r.opponent.championId}/matchups?${params}` }
                    : {})}
                />
              ),
            },
            { id: "games", header: "Games", align: "end", render: (r) => r.games },
            // Only metrics some listed opponent recorded; the rest would be a column of unknowns.
            ...matchupMetrics
              .filter(
                (metric) =>
                  metric === "winRate" || m.page.items.some((r) => r.metrics[metric].sampleCount),
              )
              .map((metric) => ({
                id: metric,
                header: metrics[metric],
                align: "end" as const,
                render: (r: ChampionMatchups["page"]["items"][number]) => {
                  const value = r.metrics[metric][q.value];
                  return (
                    <span
                      className="whitespace-nowrap"
                      title={`${r.metrics[metric].sampleCount} observations`}
                    >
                      {value === null ? "—" : display(value, metric)}
                    </span>
                  );
                },
              })),
          ]}
        />
        <Pages
          label="Opponent Pages"
          field="page"
          page={q.page}
          total={m.page.total}
          size={q.pageSize}
          note={
            m.hiddenOpponents
              ? `${m.hiddenOpponents} with fewer than ${m.minimumGames} games not listed`
              : undefined
          }
        />
      </Panel>
      {m.exclusions.length > 0 ? (
        <Panel title="Excluded Role Observations" padding="none">
          <p className="px-4 pt-3 text-sm text-fg-muted">
            A game can occur in more than one row; these game counts must not be added together.
          </p>
          <Table
            caption="Unpairable Roles"
            rows={m.exclusions}
            getRowKey={(r) => r.role}
            columns={[
              {
                id: "role",
                header: "Role",
                render: (r) => <RoleIcon role={r.role} />,
              },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              {
                id: "players",
                header: "Participants",
                align: "end",
                render: (r) => r.participants,
              },
              { id: "unknown", header: "Unknown Role", align: "end", render: (r) => r.unknownRole },
              {
                id: "ambiguous",
                header: "Ambiguous Role",
                align: "end",
                render: (r) => r.ambiguousRole,
              },
              {
                id: "missing",
                header: "Missing Opponent",
                align: "end",
                render: (r) => r.missingOpponent,
              },
              {
                id: "unmapped",
                header: "Unmapped Champion",
                align: "end",
                render: (r) => r.unmappedChampion,
              },
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
export function MatchupMatrixPage({
  matrix: m,
  error,
}: {
  matrix: MatchupMatrix | null;
  error: string | null;
}) {
  if (!m)
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader
          breadcrumbs={[{ label: "Champions", href: "/champions" }, { label: "Role Matchups" }]}
          title="Role Matchups"
        />
        <p role="alert">{error}</p>
      </div>
    );
  const q = m.query,
    params = selection(q, m.patch);
  params.set("metric", q.metric);
  const cells = m.rows.flatMap((r) =>
    m.columns.map((c) => {
      const cell = m.cells.find(
        (x) => x.championKey === r.championKey && x.opponentKey === c.championKey,
      )!;
      const value = cell.estimate[q.value];
      return {
        id: `${r.championKey}:${c.championKey}`,
        row: name(r),
        column: name(c),
        value: value === null ? null : Math.round(value * (isRate(q.metric) ? 100 : 1) * 10) / 10,
        sampleCount: cell.estimate.sampleCount,
      };
    }),
  );
  const linked = m.rows.filter((c) => c.championId);
  return (
    <RolePage
      role={q.role}
      view="matrix"
      eyebrow={[
        sources[q.source],
        `Patch ${m.patch ?? "unavailable"}`,
        q.value === "raw" ? "Raw observations" : "Shrunk estimates",
      ].join(" · ")}
      matrixHref={`/matchups/${q.role}?${params}`}
      counterHref={counterPicksHref(q.role, q.source, m.patch)}
      roleHref={(r) => `/matchups/${r}?${params}`}
      filters={
        <FilterBar className="flex-[1_1_440px]" method="get" action={`/matchups/${q.role}`}>
          <Filters query={q} patches={m.patches} patch={m.patch} />
          <Select
            label="Statistic"
            name="metric"
            defaultValue={q.metric}
            options={matchupMetrics.map((metric) => ({ value: metric, label: metrics[metric] }))}
          />
          <Button type="submit">Apply Filters</Button>
        </FilterBar>
      }
    >
      <Panel
        title={metrics[q.metric]}
        padding="none"
        actions={
          <ExportLink
            table="matchup-matrix"
            filters={{ source: q.source, patch: m.patch, role: q.role, metric: q.metric }}
            label="Download Every Pair as CSV"
          />
        }
      >
        <p className="px-4 pt-3 text-sm text-fg-muted">
          Rows are champions; columns are their opponents. Both axes are ordered by games. Blank
          cells are unknown or below the minimum sample. Use the data table below the grid for exact
          values and samples.
        </p>
        <div className="p-4">
          <HeatGrid
            title={`${roles[q.role]} matchups: ${metrics[q.metric]}${isRate(q.metric) ? " (%)" : ""} · ${q.value}`}
            cells={cells}
          />
        </div>
        <Pages
          label="Champion Row Pages"
          field="page"
          page={q.page}
          total={m.total}
          size={m.pageSize}
        />
        <Pages
          label="Opponent Column Pages"
          field="columnPage"
          page={q.columnPage}
          total={m.total}
          size={m.pageSize}
        />
      </Panel>
      {linked.length ? (
        <Panel title="Champion Matchup Tables">
          <ul
            aria-label="Champion Matchup Tables"
            className="grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"
          >
            {linked.map((c) => {
              const p = selection(q, m.patch);
              p.set("role", q.role);
              return (
                <li key={c.championKey}>
                  <TextLink
                    href={`/champions/${c.championId}/matchups?${p}`}
                    aria-label={`${name(c)} matchups`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ChampionIcon
                        id={c.championId!}
                        name={name(c)}
                        imageUrl={c.imageUrl}
                        size="small"
                      />
                      {name(c)}
                    </span>
                  </TextLink>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </RolePage>
  );
}
const counterPickSortLabels: Record<(typeof counterPickSorts)[number], string> = {
  difference: "Counter-Pick Value",
  counter: "Counter-Pick Win Rate",
  blind: "Blind Win Rate",
  score: "Blindability Score",
  games: "Lane Games",
};
export function CounterPickListPage({
  list: l,
  error,
  role,
}: {
  list: CounterPickList | null;
  error: string | null;
  role: Role;
}) {
  return (
    <RolePage
      role={role}
      view="counter-picks"
      eyebrow={
        l
          ? [
              sources[l.query.source],
              `Patch ${l.patch ?? "unavailable"}`,
              `${l.page.total} champions`,
            ].join(" · ")
          : undefined
      }
      matrixHref={`/matchups/${role}${l ? `?${selection({ source: l.query.source, value: "shrunk" }, l.patch)}` : ""}`}
      counterHref={
        l ? counterPicksHref(role, l.query.source, l.patch) : `/matchups/${role}/counter-picks`
      }
      roleHref={(r) => `/matchups/${r}/counter-picks`}
      filters={
        l ? (
          <FilterBar
            className="flex-[1_1_440px]"
            method="get"
            action={`/matchups/${role}/counter-picks`}
          >
            <Select
              label="Source"
              name="source"
              defaultValue={l.query.source}
              options={[
                { value: "solo", label: "Solo Queue" },
                { value: "pro", label: "Pro" },
              ]}
            />
            <Select
              label="Patch"
              name="patch"
              defaultValue={l.patch ?? "all"}
              options={[
                { value: "all", label: "Latest Available" },
                ...[...new Set([...(l.patch ? [l.patch] : []), ...l.patches])].map((p) => ({
                  value: p,
                  label: p,
                })),
              ]}
            />
            <Select
              label="Sort By"
              name="sort"
              defaultValue={l.query.sort}
              options={counterPickSorts.map((s) => ({ value: s, label: counterPickSortLabels[s] }))}
            />
            <Select
              label="Order"
              name="order"
              defaultValue={l.query.order}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
            <input type="hidden" name="pageSize" value={l.query.pageSize} />
            <Button type="submit">Apply Filters</Button>
          </FilterBar>
        ) : null
      }
    >
      {!l ? (
        <p role="alert">{error}</p>
      ) : (
        <Panel
          title="Champions"
          padding="none"
          actions={
            <ExportLink
              table="counter-picks"
              filters={{
                source: l.query.source,
                patch: l.patch,
                role,
                sort: l.query.sort,
                order: l.query.order,
              }}
            />
          }
        >
          <Table
            caption={`${roles[role]} Counter-Pick Values`}
            rows={l.page.items}
            getRowKey={(r) => String(r.champion.championKey)}
            emptyMessage="No stored values on this page. Try another source, patch or page."
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => (
                  <Champion
                    champion={r.champion}
                    {...(r.champion.championId
                      ? {
                          href: `/champions/${r.champion.championId}/matchups?${selection({ source: l.query.source, value: "shrunk" }, l.patch)}&role=${role}`,
                        }
                      : {})}
                  />
                ),
              },
              { id: "games", header: "Lane Games", align: "end", render: (r) => r.games },
              {
                id: "blind",
                header: "Blind Win Rate",
                align: "end",
                render: (r) => percent(r.blind),
              },
              {
                id: "counter",
                header: "Counter-Pick Win Rate",
                align: "end",
                render: (r) => percent(r.counter),
              },
              {
                id: "difference",
                header: "Counter-Pick Value",
                align: "end",
                render: (r) => points(r.difference),
              },
              {
                id: "score",
                header: "Blindability Score",
                align: "end",
                render: (r) => percent(r.score),
              },
              {
                id: "coverage",
                header: "Coverage",
                render: (r) => `${percent(r.coverage)} · ${r.coveredPicks} of ${r.rolePicks} picks`,
              },
              {
                id: "responses",
                header: "Best Response To",
                render: (r) => `${r.counterOpponents} · ${r.counterPicks} picks`,
              },
              {
                id: "reason",
                header: "Unknown Because",
                render: (r) => (
                  <span className="text-fg-muted">
                    {r.reason
                      ? blindabilityReasons[r.reason]
                      : r.counterReason
                        ? counterPickReasons[r.counterReason]
                        : ""}
                  </span>
                ),
              },
            ]}
          />
          <Pages
            label="Champion Pages"
            field="page"
            page={l.query.page}
            total={l.page.total}
            size={l.query.pageSize}
          />
        </Panel>
      )}
    </RolePage>
  );
}
