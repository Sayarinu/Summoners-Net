"use client";
import { ExportLink } from "../shell/export-link";
import { ChampionIdentity, EmptyState, PageHeader, Panel, Table } from "@summonersnet/ui";
import type { TierList, TierListRow } from "@summonersnet/data/contracts";
import { SavedViewsPanel } from "../saved-views/panel";
import { ChampionViews } from "./directory";
import { ChampionFilters } from "./filters";
import { goToPage, PageFooter } from "./paging";
import { average, percent, roleLabels } from "./presentation";
export function TierListPage({ list, error }: { list: TierList | null; error: string | null }) {
  const q = list?.query;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Tier List"
        {...(list?.patch
          ? {
              eyebrow: `Patch ${list.patch} · ${list.sliceGames} ${list.sliceGames === 1 ? "game" : "games"}`,
            }
          : {})}
      >
        <ChampionViews current="tier-list" />
      </PageHeader>
      <ChampionFilters
        action="/tier-list"
        query={q}
        facets={list?.facets}
        sortable
        className="border-y border-line py-3"
      />
      {error ? (
        <p role="alert">{error}</p>
      ) : !list?.patch ? (
        <EmptyState title="No Champion Statistics Yet" />
      ) : (
        <Panel
          title={`${roleLabels[list.query.role]} · ${list.query.source === "solo" ? "Solo Queue" : "Pro"}`}
          padding="none"
          actions={
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
          }
        >
          <Table
            caption="Champion Tier List"
            rows={list.page.items}
            getRowKey={(r) => `${r.championKey}:${r.role}`}
            emptyMessage={
              list.hiddenChampions
                ? `No champion has ${list.minimumGames} games in this selection yet.`
                : "No champions match these filters."
            }
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => (
                  <ChampionIdentity
                    id={r.championId ?? String(r.championKey)}
                    name={r.name ?? `Champion ${r.championKey}`}
                    imageUrl={r.imageUrl}
                    size="compact"
                    className="min-w-max"
                    href={r.championId ? `/champions/${r.championId}` : undefined}
                  />
                ),
              },
              { id: "tier", header: "Tier", align: "center", render: (r) => r.tier ?? "—" },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              { id: "win", header: "Win Rate", align: "end", render: (r) => percent(r.winRate) },
              { id: "pick", header: "Pick Rate", align: "end", render: (r) => percent(r.pickRate) },
              { id: "ban", header: "Ban Rate", align: "end", render: (r) => percent(r.banRate) },
              {
                id: "kda",
                header: "KDA",
                align: "end" as const,
                render: (r: TierListRow) => average(r.performance.kda, 2),
              },
              {
                id: "dpm",
                header: "DPM",
                align: "end" as const,
                render: (r: TierListRow) => average(r.performance.damagePerMinute, 0),
              },
              ...(list.query.source === "pro"
                ? [
                    {
                      id: "gd15",
                      header: "GD@15",
                      align: "end" as const,
                      render: (r: TierListRow) => average(r.performance.goldDiffAt15, 0, true),
                    },
                  ]
                : []),
            ]}
          />
          <PageFooter
            summary={`${list.page.total} champions · Page ${list.page.page}${list.hiddenChampions ? ` · ${list.hiddenChampions} with fewer than ${list.minimumGames} games not listed` : ""}`}
            label="Tier List Pages"
            page={list.page.page}
            total={list.page.total}
            pageSize={list.page.pageSize}
            onPageChange={(page) => goToPage("page", page)}
          />
        </Panel>
      )}
      <SavedViewsPanel path="/tier-list" defaultName="Tier List" />
    </div>
  );
}
