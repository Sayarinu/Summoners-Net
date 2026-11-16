"use client";
import {
  Button,
  ChampionIcon,
  EmptyState,
  Pagination,
  Select,
  StatusIndicator,
  Table,
  TextLink,
} from "@summonersnet/ui";
import { championRoles, tierListSorts, type TierList } from "@summonersnet/data/contracts";
import { interval, percent, roleLabels, sampleLabels, sortLabels } from "./presentation";

const all = { label: "All", value: "all" };
export function TierListPage({ list, error }: { list: TierList | null; error: string | null }) {
  const q = list?.query;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Champions</span>
          <h1>Tier list</h1>
          <p>Win, pick and ban rates per patch, from stored aggregates.</p>
        </div>
      </header>
      <form action="/tier-list" method="get" className="ev-filters" key={JSON.stringify(q)}>
        <Select
          label="Source"
          name="source"
          defaultValue={q?.source ?? "solo"}
          options={[
            { label: "Solo queue", value: "solo" },
            { label: "Pro", value: "pro" },
          ]}
        />
        <Select
          label="Patch"
          name="patch"
          defaultValue={q?.patch ?? "all"}
          options={[
            { label: "Newest", value: "all" },
            ...(list?.facets.patches ?? []).map((p) => ({ label: p, value: p })),
          ]}
        />
        <Select
          label="Role"
          name="role"
          defaultValue={q?.role ?? "ALL"}
          options={championRoles.map((r) => ({ label: roleLabels[r], value: r }))}
        />
        <Select
          label="Region"
          name="region"
          defaultValue={q?.region ?? "all"}
          options={[all, ...(list?.facets.regions ?? []).map((r) => ({ label: r, value: r }))]}
        />
        <Select
          label="Tier"
          name="tier"
          defaultValue={q?.tier ?? "all"}
          options={[all, ...(list?.facets.tiers ?? []).map((t) => ({ label: t, value: t }))]}
        />
        <Select
          label="Sort by"
          name="sort"
          defaultValue={q?.sort ?? "games"}
          options={tierListSorts.map((s) => ({ label: sortLabels[s], value: s }))}
        />
        <Select
          label="Order"
          name="order"
          defaultValue={q?.order ?? "desc"}
          options={[
            { label: "Highest first", value: "desc" },
            { label: "Lowest first", value: "asc" },
          ]}
        />
        <Button type="submit">Apply filters</Button>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !list?.patch ? (
        <EmptyState
          title="No champion statistics yet"
          description={
            <span>
              Statistics appear once games are ingested and aggregated. See{" "}
              <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      ) : (
        <section className="np-stack" aria-label="Tier list">
          <p className="np-meta">
            Patch {list.patch} · {list.sliceGames} {list.sliceGames === 1 ? "game" : "games"} in
            this selection. Win rates show a 95% interval; rows with few games are marked.
          </p>
          <Table
            caption="Champion tier list"
            rows={list.page.items}
            getRowKey={(r) => `${r.championKey}:${r.role}`}
            emptyMessage="No champions match these filters."
            columns={[
              {
                id: "champion",
                header: "Champion",
                render: (r) => {
                  const name = r.name ?? `Champion ${r.championKey}`;
                  return (
                    <span className="ev-champion">
                      <ChampionIcon
                        id={r.championId ?? String(r.championKey)}
                        name={name}
                        imageUrl={r.imageUrl}
                        size="small"
                      />
                      {name}
                    </span>
                  );
                },
              },
              { id: "games", header: "Games", align: "end", render: (r) => r.games },
              { id: "win", header: "Win rate", align: "end", render: (r) => percent(r.winRate) },
              {
                id: "interval",
                header: "95% interval",
                align: "end",
                render: (r) => interval(r.winRate),
              },
              { id: "pick", header: "Pick rate", align: "end", render: (r) => percent(r.pickRate) },
              { id: "ban", header: "Ban rate", align: "end", render: (r) => percent(r.banRate) },
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
              label="Tier list pages"
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
    </div>
  );
}
