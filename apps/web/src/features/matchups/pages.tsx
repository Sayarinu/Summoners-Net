"use client";
import { ExportLink } from "../shell/export-link";
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
const roles = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} as const;
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
/** The role list takes only source and patch filters. */
function counterPicksHref(role: string, source: string, patch: string | null) {
  const params = new URLSearchParams({ source });
  if (patch) params.set("patch", patch);
  return `/matchups/${role}/counter-picks?${params}`;
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
          { value: "solo", label: "Solo Queue" },
          { value: "pro", label: "Pro" },
        ]}
      />
      <Select
        label="Patch"
        name="patch"
        defaultValue={patch ?? "all"}
        options={[
          { value: "all", label: "Latest Available" },
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
/** Blind and best-response counter-pick win rates, with their coverage and samples. */
export function CounterPickSummary({
  value: v,
  listHref,
}: {
  value: ChampionBlindability;
  listHref: string;
}) {
  return (
    <div className="np-stack">
      <dl className="ev-summary" aria-label="Counter-Pick Statistics">
        <div>
          <dt>Blind win rate</dt>
          <dd>{percent(v.expected)}</dd>
        </div>
        <div>
          <dt>Counter-pick win rate</dt>
          <dd>{percent(v.counterWinRate)}</dd>
        </div>
        <div>
          <dt>Counter-pick value</dt>
          <dd>{points(v.counterDifference)}</dd>
        </div>
        <div>
          <dt>Best response to</dt>
          <dd>
            {v.counterOpponents} {v.counterOpponents === 1 ? "opponent" : "opponents"} ·{" "}
            {v.counterPicks} of {v.rolePicks} opponent picks
          </dd>
        </div>
      </dl>
      {v.counterReason ? (
        <p role="status">Counter-pick value unavailable: {counterPickReasons[v.counterReason]}</p>
      ) : null}
      <p className="np-body-sm">
        <TextLink href={listHref}>Compare the Role</TextLink>
      </p>
    </div>
  );
}
function Blindability({
  score: b,
  listHref,
}: {
  score: ChampionBlindability | null;
  listHref: string;
}) {
  const tail = blindabilityTailShare * 100;
  return (
    <section className="np-stack" aria-labelledby="blindability">
      <h2 id="blindability">Blindability</h2>
      {!b ? (
        <p className="np-meta">No stored blindability score for this role, source and patch.</p>
      ) : (
        <>
          <dl className="ev-summary" aria-label="Blindability Statistics">
            <div>
              <dt>Blindability score</dt>
              <dd>{percent(b.score)}</dd>
            </div>
            <div>
              <dt>Pick-weighted win rate</dt>
              <dd>{percent(b.expected)}</dd>
            </div>
            <div>
              <dt>Counter-pick worst case</dt>
              <dd>
                {percent(b.worstCase)}
                {b.worstOpponent ? ` · against ${name(b.worstOpponent)}` : ""}
              </dd>
            </div>
            <div>
              <dt>Lower-tail win rate ({tail}% of picks)</dt>
              <dd>{percent(b.lowerTail)}</dd>
            </div>
            <div>
              <dt>Variance</dt>
              <dd>{b.variance === null ? "Unknown" : b.variance.toFixed(4)}</dd>
            </div>
            <div>
              <dt>Covered pick share</dt>
              <dd>
                {percent(b.coverage)} · {b.coveredPicks} of {b.rolePicks} opponent picks
              </dd>
            </div>
          </dl>
          {b.reason ? (
            <p role="status">Score unavailable: {blindabilityReasons[b.reason]}</p>
          ) : null}
          <p className="np-meta">
            {b.coveredOpponents} of {b.sampledOpponents} sampled opponents meet the minimum ·{" "}
            {b.games} lane games
          </p>
          <h3>Counter-Pick Value</h3>
          <CounterPickSummary value={b} listHref={listHref} />
        </>
      )}
      <details>
        <summary>How Blindability Is Calculated</summary>
        <p className="np-body-sm">
          A champion is safe to pick blind when it has few bad matchups that opponents actually
          pick. Each opponent’s win rate is the shrunk matchup estimate shown below. Opponents with
          fewer than {matchupMinimumSample} win-rate observations are left out, and the covered pick
          share says how much of the role’s opponent picks remain. Each opponent is weighted by how
          often it is picked in this role, patch and source (its paired lane games, w).
        </p>
        <pre className="np-body-sm">{`expected  E = Σ wᵢ·pᵢ / Σ wᵢ
worst     min pᵢ   (the enemy counter-picks optimally)
variance  Σ wᵢ·(pᵢ − E)² / Σ wᵢ
tail      mean pᵢ over the worst ${tail}% of Σ wᵢ, worst matchups first
score     tail`}</pre>
        <p className="np-body-sm">
          The score is the lower-tail win rate: what the champion can expect when the enemy picks
          from its worst common matchups. It is unknown when fewer than{" "}
          {blindabilityMinimumOpponents} opponents meet the minimum or they cover less than{" "}
          {blindabilityMinimumCoverage * 100}% of opponent picks. Like the matchups, it describes
          stored samples and is not evidence of causation.
        </p>
      </details>
    </section>
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
      <div className="np-stack">
        <h1>Champion Matchups</h1>
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
            {q.source === "solo" ? "Solo Queue" : "Pro"} · {roles[q.role]}
          </span>
          <h1>{name(m.champion)} matchups</h1>
        </div>
      </header>
      <nav aria-label="Matchup Views">
        <TextLink
          href={`/champions/${q.champion}?source=${q.source}${m.patch ? `&patch=${m.patch}` : ""}&role=${q.role}`}
        >
          Champion Overview
        </TextLink>
        {" · "}
        <TextLink href={`/matchups/${q.role}?${selection(q, m.patch)}`}>
          Role Matchup Matrix
        </TextLink>
        {" · "}
        <TextLink href={counterPicksHref(q.role, q.source, m.patch)}>
          Role Counter-Pick Values
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
      </form>
      <Blindability
        score={m.patch ? blindability : null}
        listHref={counterPicksHref(q.role, q.source, m.patch)}
      />
      <p className="np-meta">
        Patch {m.patch ?? "unavailable"} ·{" "}
        {q.value === "raw" ? "Raw observations" : "Shrunk estimates"} · {m.page.total} opponents
      </p>
      <ExportLink
        table="champion-matchups"
        filters={{
          champion: q.champion,
          source: q.source,
          patch: m.patch,
          role: q.role,
          sort: q.sort,
          order: q.order,
        }}
      />
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
        label="Opponent Pages"
        field="page"
        page={q.page}
        total={m.page.total}
        size={q.pageSize}
      />
      {m.exclusions.length > 0 ? (
        <section className="np-stack">
          <h2>Excluded Role Observations</h2>
          <p>
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
                render: (r) =>
                  r.role === "UNKNOWN" ? "Unknown Role" : roles[r.role as keyof typeof roles],
              },
              { id: "games", header: "Games", render: (r) => r.games },
              { id: "players", header: "Participants", render: (r) => r.participants },
              { id: "unknown", header: "Unknown Role", render: (r) => r.unknownRole },
              { id: "ambiguous", header: "Ambiguous Role", render: (r) => r.ambiguousRole },
              { id: "missing", header: "Missing Opponent", render: (r) => r.missingOpponent },
              { id: "unmapped", header: "Unmapped Champion", render: (r) => r.unmappedChampion },
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
        <h1>Role Matchups</h1>
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
          <span className="np-overline">{q.source === "solo" ? "Solo Queue" : "Pro"}</span>
          <h1>{roles[q.role]} matchup matrix</h1>
        </div>
      </header>
      <nav aria-label="Matchup Roles">
        {matchupRoles.map((r) => (
          <TextLink key={r} href={`/matchups/${r}?${params}`}>
            {roles[r]}{" "}
          </TextLink>
        ))}
      </nav>
      <TextLink href={counterPicksHref(q.role, q.source, m.patch)}>
        {roles[q.role]} counter-pick values
      </TextLink>
      <form className="ev-filters" method="get" action={`/matchups/${q.role}`}>
        <Filters query={q} patches={m.patches} patch={m.patch} />
        <Select
          label="Statistic"
          name="metric"
          defaultValue={q.metric}
          options={matchupMetrics.map((metric) => ({ value: metric, label: metrics[metric] }))}
        />
        <Button type="submit">Apply Filters</Button>
      </form>
      <p>
        Patch {m.patch ?? "unavailable"}. Rows are champions; columns are their opponents. Both axes
        are ordered by games. Blank cells are unknown or below the minimum sample. Use the data
        table below the grid for exact values and samples.
      </p>
      <ExportLink
        table="matchup-matrix"
        filters={{ source: q.source, patch: m.patch, role: q.role, metric: q.metric }}
        label="Download Every Pair as CSV"
      />
      <HeatGrid
        title={`${roles[q.role]} matchups: ${metrics[q.metric]}${isRate(q.metric) ? " (%)" : ""} · ${q.value}`}
        cells={cells}
      />
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
      <nav aria-label="Champion Matchup Tables">
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
const counterPickSortLabels: Record<(typeof counterPickSorts)[number], string> = {
  difference: "Counter-pick value",
  counter: "Counter-pick win rate",
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
  role: keyof typeof roles;
}) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          {l ? (
            <span className="np-overline">{l.query.source === "solo" ? "Solo Queue" : "Pro"}</span>
          ) : null}
          <h1>{roles[role]} counter-pick values</h1>
        </div>
      </header>
      <nav aria-label="Counter-Pick Roles">
        {matchupRoles.map((r) => (
          <TextLink key={r} href={`/matchups/${r}/counter-picks`}>
            {roles[r]}{" "}
          </TextLink>
        ))}
      </nav>
      {!l ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <form className="ev-filters" method="get" action={`/matchups/${role}/counter-picks`}>
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
          </form>
          <p className="np-meta">
            Patch {l.patch ?? "unavailable"} · {l.page.total} champions
          </p>
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
          <Table
            caption={`${roles[role]} counter-pick values`}
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
              { id: "games", header: "Lane Games", render: (r) => r.games },
              { id: "blind", header: "Blind Win Rate", render: (r) => percent(r.blind) },
              { id: "counter", header: "Counter-Pick Win Rate", render: (r) => percent(r.counter) },
              {
                id: "difference",
                header: "Counter-Pick Value",
                render: (r) => points(r.difference),
              },
              { id: "score", header: "Blindability Score", render: (r) => percent(r.score) },
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
                render: (r) =>
                  r.reason
                    ? blindabilityReasons[r.reason]
                    : r.counterReason
                      ? counterPickReasons[r.counterReason]
                      : "",
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
        </>
      )}
    </div>
  );
}
