"use client";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { ExportLink } from "../shell/export-link";
import {
  Button,
  DisclosurePanel,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  Panel,
  RoleIcon,
  Stat,
  StatGroup,
  Table,
  TabNav,
} from "@summonersnet/ui";
import type { DraftAnalytics, ParsedDraftQuery, SampledValue } from "@summonersnet/data/contracts";
import type { Page } from "@summonersnet/data";

const games = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;
const rate = ({ value, sampleCount }: SampledValue) =>
  `${value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`} · ${games(sampleCount)}`;
const percent = ({ value }: SampledValue) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

/** Switches between the pro draft analytics and the draft assistant. */
export function DraftTabs({ current }: { current: "analytics" | "assistant" }) {
  return (
    <TabNav
      label="Draft Pages"
      items={[
        { href: "/drafts", label: "Pro Drafts", current: current === "analytics" },
        { href: "/drafts/assistant", label: "Draft Assistant", current: current === "assistant" },
      ]}
    />
  );
}

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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <span className="np-meta text-accent">
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
  portraits,
}: {
  query: ParsedDraftQuery | null;
  analytics: DraftAnalytics | null;
  error: string | null;
  portraits?: ChampionPortraits;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Pro Drafts"
        {...(query ? { eyebrow: `Patch ${query.patch} · ${query.league || "All Leagues"}` } : {})}
      >
        <DraftTabs current="analytics" />
      </PageHeader>
      <FilterBar
        action="/drafts"
        method="get"
        className="border-y border-line py-3"
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
      </FilterBar>
      {error ? (
        <p role="alert">{error}</p>
      ) : !analytics || !query ? (
        <EmptyState
          title="No Draft Data Yet"
          description="Draft analytics appear once pro games and champion metadata are stored."
        />
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[1150px]:grid-cols-1">
            <Panel title="Draft Coverage">
              <div className="flex flex-col gap-4">
                <StatGroup label="Draft Coverage">
                  <Stat label="Included Games" value={analytics.includedGames} />
                  <Stat label="Excluded Games" value={analytics.excludedGames} />
                  <Stat label="Awaiting Aggregation" value={analytics.pendingGames} />
                  <Stat label="Total Games" value={analytics.games} />
                </StatGroup>
                {analytics.exclusions.length ? (
                  <ul aria-label="Exclusions" className="flex list-none flex-col gap-1 text-sm">
                    {analytics.exclusions.map((e) => (
                      <li key={e.reason} className="flex justify-between gap-4">
                        <span className="text-fg-secondary">{e.reason}</span>
                        <span className="font-mono">{games(e.games)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Panel>
            <Panel title="First Pick">
              <StatGroup label="First Pick">
                <Stat
                  label="First-Pick Win Rate"
                  value={percent(analytics.firstPickWinRate)}
                  detail={games(analytics.firstPickWinRate.sampleCount)}
                  tone="accent"
                />
                {analytics.firstPickSides.map((s) => (
                  <Stat
                    key={s.side}
                    label={`${s.side === "blue" ? "Blue" : "Red"} Side Picking First`}
                    value={
                      <span className={s.side === "blue" ? "text-side-blue" : "text-side-red"}>
                        {percent(s.winRate)}
                      </span>
                    }
                    detail={games(s.winRate.sampleCount)}
                  />
                ))}
              </StatGroup>
            </Panel>
          </div>
          <DisclosurePanel title="How These Rates Are Measured">
            <div className="flex max-w-reading flex-col gap-3 text-sm text-fg-secondary">
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
          </DisclosurePanel>
          <Panel
            title="Pick and Ban Priority"
            padding="none"
            actions={
              <ExportLink
                table="draft-priorities"
                filters={{ patch: query.patch, league: query.league }}
              />
            }
          >
            <Table
              caption="Pick and Ban Priority"
              rows={analytics.priorities.items}
              getRowKey={(r) => `${r.champion}:${r.action}:${r.phase}:${r.slot ?? "phase"}`}
              emptyMessage="No draft priority observations match these filters."
              columns={[
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => <ChampionPortrait name={r.champion} portraits={portraits} />,
                },
                { id: "action", header: "Action", render: (r) => r.action },
                { id: "phase", header: "Phase", render: (r) => r.phase },
                { id: "slot", header: "Slot", render: (r) => r.slot ?? "Phase Total" },
                { id: "games", header: "Games", align: "end", render: (r) => r.games },
                { id: "rate", header: "Rate and Sample", render: (r) => rate(r.rate) },
              ]}
            />
            <Pages data={analytics.priorities} parameter="priorityPage" label="Priority Pages" />
          </Panel>
          <Panel
            title="Blind and Counter Picks by Role"
            padding="none"
            actions={
              <ExportLink
                table="draft-roles"
                filters={{ patch: query.patch, league: query.league }}
              />
            }
          >
            <Table
              caption="Blind and Counter Picks by Role"
              rows={analytics.roles.items}
              getRowKey={(r) => `${r.champion}:${r.role}`}
              emptyMessage="No role draft observations match these filters."
              columns={[
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => <ChampionPortrait name={r.champion} portraits={portraits} />,
                },
                { id: "role", header: "Role", render: (r) => <RoleIcon role={r.role} /> },
                { id: "games", header: "Games", align: "end", render: (r) => r.games },
                { id: "blind", header: "Blind Rate and Sample", render: (r) => rate(r.blindRate) },
                {
                  id: "counter",
                  header: "Counter Rate and Sample",
                  render: (r) => rate(r.counterRate),
                },
              ]}
            />
            <Pages data={analytics.roles} parameter="rolePage" label="Role Pages" />
          </Panel>
        </>
      )}
    </div>
  );
}
