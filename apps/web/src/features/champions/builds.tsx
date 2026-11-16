"use client";
import { ItemIcon, RuneIcon, StatusIndicator, SummonerSpellIcon, Table } from "@summonersnet/ui";
import type { BuildItem, BuildRow, ChampionBuilds } from "@summonersnet/data/contracts";
import { percent, sampleLabels } from "./presentation";

const itemSections = [
  { kind: "start", title: "Starting items" },
  { kind: "boots", title: "Boots" },
  { kind: "path", title: "Core paths" },
  { kind: "slot1", title: "First completed item" },
  { kind: "slot2", title: "Second completed item" },
  { kind: "slot3", title: "Third completed item" },
] as const;
const loadoutSections = [
  { kind: "keystone", title: "Keystones" },
  { kind: "runes", title: "Rune pages" },
  { kind: "shards", title: "Stat shards" },
  { kind: "spells", title: "Summoner spells" },
] as const;
const fallbackNames: Record<BuildItem["kind"], string> = {
  item: "Item",
  rune: "Rune",
  shard: "Stat shard",
  spell: "Summoner spell",
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
                header: "Pick rate",
                align: "end" as const,
                render: (r: BuildRow) => percent(r.pickRate),
              },
            ]
          : []),
        { id: "win", header: "Win rate", align: "end", render: winRate },
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
          <p className="np-body-sm">
            From timeline purchases: undone purchases and sales are not purchases. Starting items
            are bought in the first 90 seconds; a path is the first three completed items.
          </p>
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
      <h2 id="loadouts-heading">Runes and summoner spells</h2>
      {!builds ? (
        <p className="np-body-sm">Rune pages and spells come from solo-queue match details.</p>
      ) : (
        <>
          <p className="np-body-sm">
            Pick rate is the share of this champion&apos;s games in the selection. Stat shards show
            their ids because Data Dragon does not describe them.
          </p>
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
      <p className="np-body-sm">
        From timeline skill-ups of the basic abilities. The first levels are the first three
        level-ups; the max order is the order abilities reach five points. Games that end before an
        order is decided are left out: {builds.excluded.skills} for the first levels,{" "}
        {builds.excluded.skillmax} for the max order.
      </p>
      <BuildTable
        title="First levels"
        rows={builds.skills}
        emptyMessage="No games with timelines yet."
      />
      <BuildTable
        title="Max order"
        rows={builds.skillmax}
        emptyMessage="No games with a decided max order yet."
      />
    </section>
  );
}
