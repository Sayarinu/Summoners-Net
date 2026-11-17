"use client";
import { ItemIcon, RuneIcon, StatusIndicator, SummonerSpellIcon, Table } from "@summonersnet/ui";
import type { BuildItem, BuildRow, ChampionBuilds } from "@summonersnet/data/contracts";
import { percent, sampleLabels } from "./presentation";

const itemSections = [
  { kind: "start", title: "Starting Items" },
  { kind: "boots", title: "Boots" },
  { kind: "path", title: "Core Paths" },
  { kind: "slot1", title: "First Completed Item" },
  { kind: "slot2", title: "Second Completed Item" },
  { kind: "slot3", title: "Third Completed Item" },
] as const;
const loadoutSections = [
  { kind: "keystone", title: "Keystones" },
  { kind: "runes", title: "Rune Pages" },
  { kind: "shards", title: "Stat Shards" },
  { kind: "spells", title: "Summoner Spells" },
] as const;
const fallbackNames: Record<BuildItem["kind"], string> = {
  item: "Item",
  rune: "Rune",
  shard: "Stat Shard",
  spell: "Summoner Spell",
  skill: "Ability",
};
function Entry({ entry }: { entry: BuildItem }) {
  const name = entry.name ?? `${fallbackNames[entry.kind]} ${entry.id}`;
  const icon = { id: entry.catalogId, name, imageUrl: entry.imageUrl, size: "small" as const };
  return (
    <span className="ev-champion">
      {entry.kind === "item" ? (
        <ItemIcon {...icon} />
      ) : entry.kind === "rune" ? (
        <RuneIcon {...icon} />
      ) : entry.kind === "spell" ? (
        <SummonerSpellIcon {...icon} />
      ) : null}
      {name}
    </span>
  );
}
function Items({ row }: { row: BuildRow }) {
  return (
    <span className="ev-build">
      {row.items.map((entry, i) => (
        <Entry entry={entry} key={`${entry.kind}:${entry.id}:${i}`} />
      ))}
    </span>
  );
}
const winRate = (r: BuildRow) =>
  r.sample === "hidden" ? (
    <StatusIndicator label={`${sampleLabels.hidden} (${r.winRate.sampleCount})`} tone="warning" />
  ) : (
    `${percent(r.winRate)} · ${r.winRate.sampleCount} results`
  );
function BuildTable({
  title,
  rows,
  pickRate = false,
  emptyMessage,
}: {
  title: string;
  rows: BuildRow[];
  pickRate?: boolean;
  emptyMessage: string;
}) {
  return (
    <Table
      caption={title}
      compact
      rows={rows}
      getRowKey={(r) => r.items.map((i) => i.id).join(",")}
      emptyMessage={emptyMessage}
      columns={[
        { id: "items", header: title, render: (r) => <Items row={r} /> },
        { id: "games", header: "Games", align: "end", render: (r) => r.games },
        ...(pickRate
          ? [
              {
                id: "pick",
                header: "Pick Rate",
                align: "end" as const,
                render: (r: BuildRow) => percent(r.pickRate),
              },
            ]
          : []),
        { id: "win", header: "Win Rate", align: "end", render: winRate },
      ]}
    />
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
          {itemSections.map(({ kind, title }) => (
            <BuildTable
              key={kind}
              title={title}
              rows={builds[kind]}
              emptyMessage="No games with timelines yet."
            />
          ))}
        </>
      )}
    </section>
  );
}

export function LoadoutsSection({ builds }: { builds: ChampionBuilds | null }) {
  return (
    <section className="np-stack" aria-labelledby="loadouts-heading">
      <h2 id="loadouts-heading">Runes and Summoner Spells</h2>
      {!builds ? (
        <p className="np-body-sm">Rune pages and spells come from solo-queue match details.</p>
      ) : (
        <>
          {loadoutSections.map(({ kind, title }) => (
            <BuildTable
              key={kind}
              title={title}
              rows={builds[kind]}
              pickRate
              emptyMessage="No games yet."
            />
          ))}
        </>
      )}
    </section>
  );
}

export function SkillsSection({ builds }: { builds: ChampionBuilds | null }) {
  if (!builds) return null;
  return (
    <section className="np-stack" aria-labelledby="skills-heading">
      <h2 id="skills-heading">Skills</h2>
      <p className="np-meta">
        Games left out: {builds.excluded.skills} for the first levels, {builds.excluded.skillmax}{" "}
        for the max order
      </p>
      <BuildTable
        title="First Levels"
        rows={builds.skills}
        emptyMessage="No games with timelines yet."
      />
      <BuildTable
        title="Max Order"
        rows={builds.skillmax}
        emptyMessage="No games with a decided max order yet."
      />
    </section>
  );
}
