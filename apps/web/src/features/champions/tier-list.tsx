"use client";
import { ExportLink } from "../shell/export-link";
import { ChampionIcon, EmptyState, Pagination, StatusIndicator, Table } from "@summonersnet/ui";
import type { TierList } from "@summonersnet/data/contracts";
import { SavedViewsPanel } from "../saved-views/panel";
import { ChampionFilters } from "./filters";
import { interval, percent, sampleLabels } from "./presentation";
export function TierListPage({ list, error }: { list: TierList | null; error: string | null }) {
  const q = list?.query;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Tier List</h1>
        </div>
      </header>
      <ChampionFilters action="/tier-list" query={q} facets={list?.facets} sortable />
      {error ? (
        <p role="alert">{error}</p>
      ) : !list?.patch ? (
        <EmptyState title="No Champion Statistics Yet" />
      ) : (
        <section className="np-stack" aria-label="Tier List">
          <p className="np-meta">
            Patch {list.patch} · {list.sliceGames} {list.sliceGames === 1 ? "game" : "games"}
          </p>
          <ExportLink
            table="tier-list"
            filters={{
              source: list.query.source,
              patch: list.patch,
              role: list.query.role,
              region: list.query.region,
              tier: list.query.tier,
              sort: list.query.sort,
              order: list.query.order,
            }}
          />
          <Table
            caption="Champion Tier List"
            rows={list.page.items}
            getRowKey={(r) => `${r.championKey}:${r.role}`}
            emptyMessage="No champions match these filters."
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => (
                  <ChampionIcon
                    id={r.championId ?? String(r.championKey)}
                    name={r.name ?? `Champion ${r.championKey}`}
                    imageUrl={r.imageUrl}
                    size="small"
                    href={r.championId ? `/champions/${r.championId}` : undefined}
                  />
                ),
              },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              { id: "win", header: "Win Rate", align: "end", render: (r) => percent(r.winRate) },
              {
                id: "interval",
                header: "95% interval",
                align: "end",
                render: (r) => interval(r.winRate),
              },
              { id: "pick", header: "Pick Rate", align: "end", render: (r) => percent(r.pickRate) },
              { id: "ban", header: "Ban Rate", align: "end", render: (r) => percent(r.banRate) },
              {
                id: "sample",
                header: "Sample",
                render: (r) =>
                  r.sample === "shown" ? (
                    `${r.winRate.sampleCount} results`
                  ) : (
                    <StatusIndicator label={sampleLabels[r.sample]} tone="warning" />
                  ),
              },
            ]}
          />
          <div className="ev-pagination">
            <span className="np-meta">
              {list.page.total} champions · Page {list.page.page}
            </span>
            <Pagination
              label="Tier List Pages"
              currentPage={list.page.page}
              totalPages={Math.max(1, Math.ceil(list.page.total / list.page.pageSize))}
              onPageChange={(page) => {
                const url = new URL(window.location.href);
                url.searchParams.set("page", String(page));
                window.location.assign(url.toString());
              }}
            />
          </div>
        </section>
      )}
      <SavedViewsPanel path="/tier-list" defaultName="Tier List" />
    </div>
  );
}
