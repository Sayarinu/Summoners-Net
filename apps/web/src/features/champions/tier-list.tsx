"use client";
import { ExportLink } from "../shell/export-link";
import {
  ChampionIdentity,
  EmptyState,
  PageHeader,
  Panel,
  StatusIndicator,
  Table,
} from "@summonersnet/ui";
import type { TierList } from "@summonersnet/data/contracts";
import { SavedViewsPanel } from "../saved-views/panel";
import { ChampionViews } from "./directory";
import { ChampionFilters } from "./filters";
import { goToPage, PageFooter } from "./paging";
import { interval, percent, roleLabels, sampleLabels } from "./presentation";
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
            emptyMessage="No champions match these filters."
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
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              { id: "win", header: "Win Rate", align: "end", render: (r) => percent(r.winRate) },
              {
                id: "interval",
                header: "95% Interval",
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
          <PageFooter
            summary={`${list.page.total} champions · Page ${list.page.page}`}
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
