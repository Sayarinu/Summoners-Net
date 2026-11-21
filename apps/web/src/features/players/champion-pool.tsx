"use client";
import type { ChampionPool, ChampionPoolRow } from "@summonersnet/data/contracts";
import { Panel, TabNav, Table } from "@summonersnet/ui";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { goToPage, PageFooter } from "../champions/paging";

type Sampled = ChampionPoolRow["kda"];
const sortLabels: Record<ChampionPool["sort"], string> = {
  games: "Games",
  winRate: "Win Rate",
  kda: "KDA",
  damagePerMinute: "DPM",
  goldDiffAt15: "GD@15",
};
/** A per-game value, or "Unknown" when no game recorded it; never 0 for missing data. */
const value = (v: Sampled, digits: number, signed = false) => {
  if (v.value === null) return "Unknown";
  const text = v.value.toFixed(digits);
  return signed && v.value > 0 ? `+${text}` : text;
};
const rate = (v: Sampled) => (v.value === null ? "Unknown" : `${(v.value * 100).toFixed(1)}%`);

/** The sort link for this pool, keeping the profile's year and league filters. */
function sortHref(sort: ChampionPool["sort"], filters: { year?: string; league?: string }) {
  const params = new URLSearchParams({ poolSort: sort });
  if (filters.year) params.set("year", filters.year);
  if (filters.league) params.set("league", filters.league);
  return `?${params}`;
}

/** The champions a player played in the selected games, with per-champion statistics. */
export function PlayerChampionPool({
  pool,
  portraits,
  filters = {},
}: {
  pool: ChampionPool;
  portraits?: ChampionPortraits | undefined;
  /** The profile's own filters, carried into the sort links. */
  filters?: { year?: string; league?: string };
}) {
  return (
    <Panel
      title="Champion Pool"
      padding="none"
      actions={
        <TabNav
          label="Sort Champion Pool"
          variant="segmented"
          items={(Object.keys(sortLabels) as ChampionPool["sort"][]).map((sort) => ({
            href: sortHref(sort, filters),
            label: sortLabels[sort],
            current: pool.sort === sort,
          }))}
        />
      }
    >
      <Table
        caption="Champion Pool"
        rows={pool.page.items}
        getRowKey={(r) => r.champion}
        columns={[
          {
            id: "champion",
            header: "Champion",
            render: (r) => (
              <span className="flex items-center gap-2">
                <ChampionPortrait name={r.champion} portraits={portraits} />
                {r.champion}
              </span>
            ),
          },
          { id: "games", header: "Games", align: "end", render: (r) => r.games },
          {
            id: "win",
            header: "Win Rate",
            align: "end",
            render: (r) => `${rate(r.winRate)} (${r.wins}–${r.winRate.sampleCount - r.wins})`,
          },
          { id: "kda", header: "KDA", align: "end", render: (r) => value(r.kda, 2) },
          { id: "kp", header: "KP", align: "end", render: (r) => rate(r.killParticipation) },
          { id: "cspm", header: "CS/Min", align: "end", render: (r) => value(r.csPerMinute, 1) },
          { id: "gpm", header: "GPM", align: "end", render: (r) => value(r.goldPerMinute, 0) },
          { id: "dpm", header: "DPM", align: "end", render: (r) => value(r.damagePerMinute, 0) },
          {
            id: "gd15",
            header: "GD@15",
            align: "end",
            render: (r) => value(r.goldDiffAt15, 0, true),
          },
          {
            id: "csd15",
            header: "CSD@15",
            align: "end",
            render: (r) => value(r.csDiffAt15, 1, true),
          },
        ]}
      />
      <PageFooter
        summary={`${pool.page.total} ${pool.page.total === 1 ? "champion" : "champions"}`}
        label="Champion Pool Pages"
        page={pool.page.page}
        total={pool.page.total}
        pageSize={pool.page.pageSize}
        onPageChange={(page) => goToPage("poolPage", page)}
      />
    </Panel>
  );
}
