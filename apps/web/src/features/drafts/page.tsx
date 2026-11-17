"use client";
import { ExportLink } from "../shell/export-link";
import { Button, EmptyState, Input, Pagination, Table, TextLink } from "@summonersnet/ui";
import type { DraftAnalytics, ParsedDraftQuery, SampledValue } from "@summonersnet/data/contracts";
import type { Page } from "@summonersnet/data";

const games = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;
const rate = ({ value, sampleCount }: SampledValue) =>
  `${value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`} · ${games(sampleCount)}`;
function Pages({
  data,
  parameter,
  label,
}: {
  data: Page<unknown>;
  parameter: "priorityPage" | "rolePage";
  label: string;
}) {
  return (
    <div className="ev-pagination">
      <span className="np-meta">
        {data.total} rows · Page {data.page}
      </span>
      <Pagination
        label={label}
        currentPage={data.page}
        totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
        onPageChange={(page) => {
          const url = new URL(window.location.href);
          url.searchParams.set(parameter, String(page));
          window.location.assign(url.toString());
        }}
      />
    </div>
  );
}
export function DraftsPage({
  query,
  analytics,
  error,
}: {
  query: ParsedDraftQuery | null;
  analytics: DraftAnalytics | null;
  error: string | null;
}) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Oracle’s Elixir</span>
          <h1>Pro Drafts</h1>
          <p>Pick and ban priority, role order and first-pick results.</p>
        </div>
      </header>
      <TextLink href="/drafts/assistant">Draft Assistant</TextLink>
      <form
        action="/drafts"
        method="get"
        className="ev-filters"
        key={`${query?.patch}:${query?.league}`}
      >
        <Input
          label="Patch"
          name="patch"
          defaultValue={query?.patch ?? ""}
          placeholder="16.22"
          required
        />
        <Input
          label="League"
          name="league"
          defaultValue={query?.league ?? ""}
          placeholder="All Leagues"
          maxLength={100}
        />
        <Button type="submit">Apply Filters</Button>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !analytics || !query ? (
        <EmptyState
          title="No Draft Data Yet"
          description={
            <span>
              Import Oracle’s Elixir games and refresh metadata in{" "}
              <TextLink href="/sources">Sources</TextLink>. Draft analytics update after imports.
            </span>
          }
        />
      ) : (
        <>
          <section aria-label="Draft Coverage" className="np-stack">
            <p>
              {analytics.includedGames} included · {analytics.excludedGames} excluded ·{" "}
              {analytics.pendingGames} awaiting aggregation · {analytics.games} total games
            </p>
            {analytics.exclusions.length ? (
              <ul>
                {analytics.exclusions.map((e) => (
                  <li key={e.reason}>
                    {e.reason}: {games(e.games)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p>First-pick win rate: {rate(analytics.firstPickWinRate)}</p>
            {analytics.firstPickSides.map((s) => (
              <p key={s.side}>
                {s.side === "blue" ? "Blue" : "Red"} side when picking first: {rate(s.winRate)}
              </p>
            ))}
          </section>
          <details>
            <summary>How These Rates Are Measured</summary>
            <div className="np-stack">
              <p>
                Only complete ten-ban drafts with both first-pick flags, ten unique picks, ten
                unique bans and matching played roles are included. Missing, conflicting and older
                incomplete drafts are excluded and counted. Unknown results reduce only the win-rate
                sample.
              </p>
              <p>
                Priority rates divide the games containing a champion in that phase or slot by all
                included games. Slot is the chronological pick or ban number, independent of map
                side. Phase totals and individual slots overlap and should not be added together.
                Fearless bans carried over from earlier games are not present in these columns.
              </p>
              <p>
                Blind means picked before the eventual opposing champion in the same role; counter
                means picked after. These are observed draft positions, not proof of knowledge about
                flex picks or a causal advantage. First-pick flags determine order; blue side is not
                assumed to pick first.
              </p>
            </div>
          </details>
          <section className="np-stack" aria-label="Draft Priority">
            <ExportLink
              table="draft-priorities"
              filters={{ patch: query.patch, league: query.league }}
            />
            <Table
              caption="Pick and Ban Priority"
              rows={analytics.priorities.items}
              getRowKey={(r) => `${r.champion}:${r.action}:${r.phase}:${r.slot ?? "phase"}`}
              emptyMessage="No draft priority observations match these filters."
              columns={[
                { id: "champion", header: "Champion", render: (r) => r.champion },
                { id: "action", header: "Action", render: (r) => r.action },
                { id: "phase", header: "Phase", render: (r) => r.phase },
                { id: "slot", header: "Slot", render: (r) => r.slot ?? "Phase Total" },
                { id: "games", header: "Games", render: (r) => r.games },
                { id: "rate", header: "Rate and Sample", render: (r) => rate(r.rate) },
              ]}
            />
            <Pages data={analytics.priorities} parameter="priorityPage" label="Priority Pages" />
          </section>
          <section className="np-stack" aria-label="Role Draft Order">
            <ExportLink
              table="draft-roles"
              filters={{ patch: query.patch, league: query.league }}
            />
            <Table
              caption="Blind and Counter Picks by Role"
              rows={analytics.roles.items}
              getRowKey={(r) => `${r.champion}:${r.role}`}
              emptyMessage="No role draft observations match these filters."
              columns={[
                { id: "champion", header: "Champion", render: (r) => r.champion },
                { id: "role", header: "Role", render: (r) => r.role },
                { id: "games", header: "Games", render: (r) => r.games },
                { id: "blind", header: "Blind Rate and Sample", render: (r) => rate(r.blindRate) },
                {
                  id: "counter",
                  header: "Counter Rate and Sample",
                  render: (r) => rate(r.counterRate),
                },
              ]}
            />
            <Pages data={analytics.roles} parameter="rolePage" label="Role Pages" />
          </section>
        </>
      )}
    </div>
  );
}
