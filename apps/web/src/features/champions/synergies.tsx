"use client";
import {
  RoleIcon,
  Button,
  ChampionIdentity,
  FilterBar,
  HeatGrid,
  Panel,
  Select,
  Table,
} from "@summonersnet/ui";
import {
  synergySorts,
  type BotLaneMatrix,
  type ChampionOverview,
  type Synergies,
} from "@summonersnet/data/contracts";
import { goToPage, PageFooter } from "./paging";
import { percent } from "./presentation";

const sortLabels = { games: "Games", winRate: "Win Rate", delta: "Delta" } as const;
const signed = (value: number | null) =>
  value === null ? "Unknown" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
const championName = (key: number, name: string | null) => name ?? `Champion ${key}`;

function Matrix({ matrix }: { matrix: BotLaneMatrix }) {
  const carry = new Map(matrix.carries.map((c) => [c.key, championName(c.key, c.name)]));
  const support = new Map(matrix.supports.map((s) => [s.key, championName(s.key, s.name)]));
  return (
    <div className="max-w-[560px] p-4">
      <HeatGrid
        title="Bot-Lane Pairs: Win Rate (%)"
        cells={matrix.cells.map((c) => ({
          id: `${c.carry}:${c.support}`,
          row: carry.get(c.carry)!,
          column: support.get(c.support)!,
          value: c.winRate.value === null ? null : Math.round(c.winRate.value * 1000) / 10,
          sampleCount: c.winRate.sampleCount,
        }))}
      />
    </div>
  );
}
export function SynergiesSection({ overview }: { overview: ChampionOverview }) {
  const { synergies, botLane, query: q, champion } = overview;
  if (!synergies) return null;
  return (
    <Panel
      title="Synergies"
      padding="none"
      actions={
        <FilterBar action={`/champions/${champion.id}`} method="get">
          {(["source", "patch", "role", "region", "tier"] as const).map((name) =>
            q[name] ? <input key={name} type="hidden" name={name} value={q[name]} /> : null,
          )}
          <Select
            label="Sort Allies By"
            hideLabel
            name="synergySort"
            defaultValue={synergies.sort}
            options={synergySorts.map((s) => ({ label: sortLabels[s], value: s }))}
          />
          <Button type="submit">Sort</Button>
        </FilterBar>
      }
    >
      {/* The first page opens on its top allies; later pages keep the full list open. */}
      {synergies.page.page === 1 ? (
        <AlliesTable caption="Top Allies" rows={synergies.page.items.slice(0, topAllies)} />
      ) : null}
      <details className="border-t border-line" open={synergies.page.page > 1 || undefined}>
        <summary className="cursor-pointer px-4 py-3 text-sm text-accent">
          Show All {synergies.page.total.toLocaleString()} Allies
        </summary>
        <AlliesTable caption="Allies" rows={synergies.page.items} />
        <PageFooter
          summary={`${synergies.page.total} allies · Page ${synergies.page.page}`}
          label="Ally Pages"
          page={synergies.page.page}
          total={synergies.page.total}
          pageSize={synergies.page.pageSize}
          onPageChange={(page) => goToPage("synergyPage", page)}
        />
        {botLane && botLane.cells.length > 0 ? <Matrix matrix={botLane} /> : null}
      </details>
    </Panel>
  );
}
/** Allies listed before the full list is opened. */
const topAllies = 5;
function AlliesTable({ caption, rows }: { caption: string; rows: Synergies["page"]["items"] }) {
  return (
    <Table
      caption={caption}
      rows={rows}
      getRowKey={(r) => `${r.allyKey}:${r.allyRole}`}
      emptyMessage="No allies in this selection yet."
      columns={[
        {
          id: "ally",
          header: "Ally",
          render: (r) => {
            const name = championName(r.allyKey, r.allyName);
            return (
              <ChampionIdentity
                id={r.allyId ?? String(r.allyKey)}
                name={name}
                imageUrl={r.allyImageUrl}
                size="compact"
                className="min-w-max"
                href={r.allyId ? `/champions/${r.allyId}` : undefined}
              />
            );
          },
        },
        {
          id: "role",
          header: "Role",
          render: (r) => <RoleIcon role={r.allyRole} />,
        },
        { id: "games", header: "Games", align: "end", render: (r) => r.games },
        { id: "win", header: "Win Rate", align: "end", render: (r) => percent(r.winRate) },
        {
          id: "expected",
          header: "Expected",
          align: "end",
          render: (r) => percent({ value: r.expected, sampleCount: r.games }),
        },
        { id: "delta", header: "Delta", align: "end", render: (r) => signed(r.delta.value) },
      ]}
    />
  );
}
