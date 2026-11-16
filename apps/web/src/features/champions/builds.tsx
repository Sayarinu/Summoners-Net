"use client";
import { ItemIcon, StatusIndicator, Table } from "@summonersnet/ui";
import type { BuildRow, ChampionBuilds } from "@summonersnet/data/contracts";
import { percent, sampleLabels } from "./presentation";

const sections = [
  { kind: "start", title: "Starting items" },
  { kind: "boots", title: "Boots" },
  { kind: "path", title: "Core paths" },
  { kind: "slot1", title: "First completed item" },
  { kind: "slot2", title: "Second completed item" },
  { kind: "slot3", title: "Third completed item" },
] as const;

function Items({ row }: { row: BuildRow }) {
  return (
    <span className="ev-build">
      {row.items.map((item, i) => {
        const name = item.name ?? `Item ${item.id}`;
        return (
          <span className="ev-champion" key={`${item.id}:${i}`}>
            <ItemIcon id={String(item.id)} name={name} imageUrl={item.imageUrl} size="small" />
            {name}
          </span>
        );
      })}
    </span>
  );
}
export function BuildsSection({ builds }: { builds: ChampionBuilds | null }) {
  return (
    <section className="np-stack" aria-labelledby="builds-heading">
      <h2 id="builds-heading">Builds</h2>
      {!builds ? (
        <p className="np-body-sm">
          Builds come from solo-queue timelines; pro play has no item purchase events.
        </p>
      ) : (
        <>
          <p className="np-body-sm">
            From timeline purchases: undone purchases and sales are not purchases. Starting items
            are bought in the first 90 seconds; a path is the first three completed items.
          </p>
          {sections.map(({ kind, title }) => (
            <Table
              key={kind}
              caption={title}
              compact
              rows={builds[kind]}
              getRowKey={(r) => r.items.map((i) => i.id).join(",")}
              emptyMessage="No games with timelines yet."
              columns={[
                { id: "items", header: title, render: (r) => <Items row={r} /> },
                { id: "games", header: "Games", align: "end", render: (r) => r.games },
                {
                  id: "win",
                  header: "Win rate",
                  align: "end",
                  render: (r) =>
                    r.sample === "hidden" ? (
                      <StatusIndicator
                        label={`${sampleLabels.hidden} (${r.winRate.sampleCount})`}
                        tone="warning"
                      />
                    ) : (
                      `${percent(r.winRate)} · ${r.winRate.sampleCount} results`
                    ),
                },
              ]}
            />
          ))}
        </>
      )}
    </section>
  );
}
