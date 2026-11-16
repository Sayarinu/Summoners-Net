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
  synergySorts,
  type BotLaneMatrix,
  type ChampionOverview,
  type Synergies,
} from "@summonersnet/data/contracts";
import { percent, roleLabels } from "./presentation";

const sortLabels = { games: "Games", winRate: "Win rate", delta: "Delta" } as const;
const signed = (value: number | null) =>
  value === null ? "Unknown" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
const championName = (key: number, name: string | null) => name ?? `Champion ${key}`;

function Matrix({ matrix }: { matrix: BotLaneMatrix }) {
  const carry = new Map(matrix.carries.map((c) => [c.key, championName(c.key, c.name)]));
  const support = new Map(matrix.supports.map((s) => [s.key, championName(s.key, s.name)]));
  return (
    <HeatGrid
      title="Bot-lane pairs: win rate (%)"
      cells={matrix.cells.map((c) => ({
        id: `${c.carry}:${c.support}`,
        row: carry.get(c.carry)!,
        column: support.get(c.support)!,
        value: c.winRate.value === null ? null : Math.round(c.winRate.value * 1000) / 10,
        sampleCount: c.winRate.sampleCount,
      }))}
    />
  );
}
export function SynergiesSection({ overview }: { overview: ChampionOverview }) {
  const { synergies, botLane, query: q, champion } = overview;
  if (!synergies) return null;
  return (
    <section className="np-stack" aria-labelledby="synergies-heading">
      <h2 id="synergies-heading">Synergies</h2>
      <p className="np-body-sm">
        Expected win rate adds each champion&apos;s distance from 50% in its role. Delta is the
        pair&apos;s win rate minus that, pulled toward zero for small samples.
      </p>
      <form action={`/champions/${champion.id}`} method="get" className="ev-filters">
        {(["source", "patch", "role", "region", "tier"] as const).map((name) =>
          q[name] ? <input key={name} type="hidden" name={name} value={q[name]} /> : null,
        )}
        <Select
          label="Sort allies by"
          name="synergySort"
          defaultValue={synergies.sort}
          options={synergySorts.map((s) => ({ label: sortLabels[s], value: s }))}
        />
        <Button type="submit">Sort</Button>
      </form>
      <AlliesTable synergies={synergies} />
      <div className="ev-pagination">
        <span className="np-meta">
          {synergies.page.total} allies · Page {synergies.page.page}
        </span>
        <Pagination
          label="Ally pages"
          currentPage={synergies.page.page}
          totalPages={Math.max(1, Math.ceil(synergies.page.total / synergies.page.pageSize))}
          onPageChange={(page) => {
            const url = new URL(window.location.href);
            url.searchParams.set("synergyPage", String(page));
            window.location.assign(url.toString());
          }}
        />
      </div>
      {botLane && botLane.cells.length > 0 ? <Matrix matrix={botLane} /> : null}
    </section>
  );
}
function AlliesTable({ synergies }: { synergies: Synergies }) {
  return (
    <Table
      caption="Allies"
      rows={synergies.page.items}
      getRowKey={(r) => `${r.allyKey}:${r.allyRole}`}
      emptyMessage="No allies in this selection yet."
      columns={[
        {
          id: "ally",
          header: "Ally",
          render: (r) => {
            const name = championName(r.allyKey, r.allyName);
            return (
              <span className="ev-champion">
                <ChampionIcon
                  id={r.allyId ?? String(r.allyKey)}
                  name={name}
                  imageUrl={r.allyImageUrl}
                  size="small"
                />
                {r.allyId ? <TextLink href={`/champions/${r.allyId}`}>{name}</TextLink> : name}
              </span>
            );
          },
        },
        {
          id: "role",
          header: "Role",
          render: (r) => roleLabels[r.allyRole as keyof typeof roleLabels] ?? r.allyRole,
        },
        { id: "games", header: "Games", align: "end", render: (r) => r.games },
        { id: "win", header: "Win rate", align: "end", render: (r) => percent(r.winRate) },
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
