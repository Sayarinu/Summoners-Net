"use client";
import {
  Button,
  ChampionIcon,
  HeatGrid,
  Pagination,
  Select,
  Table,
  TextLink,
} from "@summonersnet/ui";
import {
  matchupMetrics,
  matchupRoles,
  matchupMinimumSample,
  matchupPriorGames,
  type ChampionMatchups,
  type MatchupMatrix,
  type MatchupMetric,
  type PatchChampion,
} from "@summonersnet/data/contracts";
const roles = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} as const;
const metrics: Record<MatchupMetric, string> = {
  winRate: "Win rate",
  gold10: "Gold Δ at 10",
  gold15: "Gold Δ at 15",
  xp10: "XP Δ at 10",
  xp15: "XP Δ at 15",
  cs10: "CS Δ at 10",
  cs15: "CS Δ at 15",
  firstBlood: "Team first blood",
  firstTower: "Team first tower",
};
const isRate = (metric: MatchupMetric) => ["winRate", "firstBlood", "firstTower"].includes(metric);
const display = (value: number | null, metric: MatchupMetric) =>
  value === null
    ? "Unknown"
    : isRate(metric)
      ? `${(value * 100).toFixed(1)}%`
      : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const name = (c: PatchChampion) => c.name ?? c.championId ?? `Champion ${c.championKey}`;
function selection(q: { source: string; value: string }, patch: string | null) {
  const params = new URLSearchParams({ source: q.source, value: q.value });
  if (patch) params.set("patch", patch);
  return params;
}
function Champion({ champion: c, href }: { champion: PatchChampion; href?: string }) {
  return (
    <span className="ev-champion">
      <ChampionIcon
        id={c.championId ?? String(c.championKey)}
        name={name(c)}
        imageUrl={c.imageUrl}
        size="small"
      />
      {href ? <TextLink href={href}>{name(c)}</TextLink> : name(c)}
    </span>
  );
}
function Policy() {
  return (
    <p className="np-body-sm">
      Values need at least {matchupMinimumSample} observations for that statistic. Shrunk estimates
      use {matchupPriorGames} prior observations at the champion’s same-role, same-patch baseline
      across all opponents. Raw values are available in the Values selector. First blood and first
      tower describe team outcomes.
    </p>
  );
}
function Filters({
  query: q,
  patches,
  patch,
}: {
  query: { source: string; value: string };
  patches: string[];
  patch: string | null;
}) {
  const choices = [...new Set([...(patch ? [patch] : []), ...patches])];
  return (
    <>
      <Select
        label="Source"
        name="source"
        defaultValue={q.source}
        options={[
          { value: "solo", label: "Solo queue" },
          { value: "pro", label: "Pro" },
        ]}
      />
      <Select
        label="Patch"
        name="patch"
        defaultValue={patch ?? "all"}
        options={[
          { value: "all", label: "Latest available" },
          ...choices.map((p) => ({ value: p, label: p })),
        ]}
      />
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
}: {
  label: string;
  field: string;
  page: number;
  total: number;
  size: number;
}) {
  return (
    <div className="ev-pagination">
      <span className="np-meta">
        {label}: page {page} · {total} champions
      </span>
      <Pagination
        label={label}
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / size))}
        onPageChange={(p) => {
          const url = new URL(window.location.href);
          url.searchParams.set(field, String(p));
          window.location.assign(url.toString());
        }}
      />
    </div>
  );
}
export function ChampionMatchupsPage({
  matchups: m,
  error,
}: {
  matchups: ChampionMatchups | null;
  error: string | null;
}) {
  if (!m)
    return (
      <div className="np-stack">
        <h1>Champion matchups</h1>
        <p role="alert">{error}</p>
      </div>
    );
  const q = m.query,
    params = selection(q, m.patch);
  params.set("role", q.role);
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">
            {q.source === "solo" ? "Solo queue" : "Pro"} · {roles[q.role]}
          </span>
          <h1>{name(m.champion)} matchups</h1>
        </div>
      </header>
      <nav aria-label="Matchup views">
        <TextLink
          href={`/champions/${q.champion}?source=${q.source}${m.patch ? `&patch=${m.patch}` : ""}&role=${q.role}`}
        >
          Champion overview
        </TextLink>
        {" · "}
        <TextLink href={`/matchups/${q.role}?${selection(q, m.patch)}`}>
          Role matchup matrix
        </TextLink>
      </nav>
      <form className="ev-filters" method="get" action={`/champions/${q.champion}/matchups`}>
        <Filters query={q} patches={m.patches} patch={m.patch} />
        <Select
          label="Role"
          name="role"
          defaultValue={q.role}
          options={matchupRoles.map((r) => ({ value: r, label: roles[r] }))}
        />
        <Select
          label="Sort opponents by"
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
        <Button type="submit">Apply filters</Button>
      </form>
      <Policy />
      <p className="np-meta">
        Patch {m.patch ?? "unavailable"} ·{" "}
        {q.value === "raw" ? "Raw observations" : "Shrunk estimates"} · {m.page.total} opponents
      </p>
      <Table
        caption={`${name(m.champion)} lane opponents`}
        rows={m.page.items}
        getRowKey={(r) => String(r.opponent.championKey)}
        emptyMessage="No matchup observations on this page. Try another role, source, patch or page."
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
          { id: "games", header: "Games", render: (r) => r.games },
          ...matchupMetrics.map((metric) => ({
            id: metric,
            header: metrics[metric],
            render: (r: ChampionMatchups["page"]["items"][number]) => (
              <span>
                {display(r.metrics[metric][q.value], metric)} · n={r.metrics[metric].sampleCount}
              </span>
            ),
          })),
        ]}
      />
      <Pages
        label="Opponent pages"
        field="page"
        page={q.page}
        total={m.page.total}
        size={q.pageSize}
      />
      {m.exclusions.length > 0 ? (
        <section className="np-stack">
          <h2>Excluded role observations</h2>
          <p>
            A game can occur in more than one row; these game counts must not be added together.
          </p>
          <Table
            caption="Unpairable roles"
            rows={m.exclusions}
            getRowKey={(r) => r.role}
            columns={[
              {
                id: "role",
                header: "Role",
                render: (r) =>
                  r.role === "UNKNOWN" ? "Unknown role" : roles[r.role as keyof typeof roles],
              },
              { id: "games", header: "Games", render: (r) => r.games },
              { id: "players", header: "Participants", render: (r) => r.participants },
              { id: "unknown", header: "Unknown role", render: (r) => r.unknownRole },
              { id: "ambiguous", header: "Ambiguous role", render: (r) => r.ambiguousRole },
              { id: "missing", header: "Missing opponent", render: (r) => r.missingOpponent },
              { id: "unmapped", header: "Unmapped champion", render: (r) => r.unmappedChampion },
            ]}
          />
        </section>
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
      <div className="np-stack">
        <h1>Role matchups</h1>
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
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">{q.source === "solo" ? "Solo queue" : "Pro"}</span>
          <h1>{roles[q.role]} matchup matrix</h1>
        </div>
      </header>
      <nav aria-label="Matchup roles">
        {matchupRoles.map((r) => (
          <TextLink key={r} href={`/matchups/${r}?${params}`}>
            {roles[r]}{" "}
          </TextLink>
        ))}
      </nav>
      <form className="ev-filters" method="get" action={`/matchups/${q.role}`}>
        <Filters query={q} patches={m.patches} patch={m.patch} />
        <Select
          label="Statistic"
          name="metric"
          defaultValue={q.metric}
          options={matchupMetrics.map((metric) => ({ value: metric, label: metrics[metric] }))}
        />
        <Button type="submit">Apply filters</Button>
      </form>
      <Policy />
      <p>
        Patch {m.patch ?? "unavailable"}. Rows are champions; columns are their opponents. Both axes
        are ordered by games. Blank cells are unknown or below the minimum sample. Use the data
        table below the grid for exact values and samples.
      </p>
      <HeatGrid
        title={`${roles[q.role]} matchups: ${metrics[q.metric]}${isRate(q.metric) ? " (%)" : ""} · ${q.value}`}
        cells={cells}
      />
      <Pages
        label="Champion row pages"
        field="page"
        page={q.page}
        total={m.total}
        size={m.pageSize}
      />
      <Pages
        label="Opponent column pages"
        field="columnPage"
        page={q.columnPage}
        total={m.total}
        size={m.pageSize}
      />
      <nav aria-label="Champion matchup tables">
        {m.rows
          .filter((c) => c.championId)
          .map((c) => {
            const p = selection(q, m.patch);
            p.set("role", q.role);
            return (
              <p key={c.championKey}>
                <TextLink href={`/champions/${c.championId}/matchups?${p}`}>
                  {name(c)} matchups
                </TextLink>
              </p>
            );
          })}
      </nav>
    </div>
  );
}
