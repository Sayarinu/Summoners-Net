"use client";
import { Fragment, useId, type ReactNode } from "react";
import { ItemIcon, Panel, RuneIcon, SummonerSpellIcon } from "@summonersnet/ui";
import type { BuildItem, BuildRow, ChampionBuilds } from "@summonersnet/data/contracts";
import { percent, sampleLabels } from "./presentation";

const fallbackNames: Record<BuildItem["kind"], string> = {
  item: "Item",
  rune: "Rune",
  shard: "Stat Shard",
  spell: "Summoner Spell",
  skill: "Ability",
};
const entryName = (entry: BuildItem) => entry.name ?? `${fallbackNames[entry.kind]} ${entry.id}`;
const iconRow = "flex flex-wrap items-center justify-center gap-2";
const statLine = "text-xs text-fg-muted";
const block = "grid content-start justify-items-center gap-2 text-center";

/** One build entry as an icon; skills show their key and stat shards their id. */
export function BuildIcon({ entry, large = false }: { entry: BuildItem; large?: boolean }) {
  const name = entryName(entry);
  const icon = {
    id: entry.catalogId,
    name,
    imageUrl: entry.imageUrl,
    size: large ? ("medium" as const) : ("small" as const),
  };
  if (entry.kind === "item") return <ItemIcon {...icon} />;
  if (entry.kind === "rune") return <RuneIcon {...icon} />;
  if (entry.kind === "spell") return <SummonerSpellIcon {...icon} />;
  return (
    <span
      className={`inline-grid h-7 min-w-7 place-items-center rounded-sm border border-line-strong bg-raised px-1 font-mono text-xs ${
        entry.kind === "skill" ? "font-semibold text-accent" : ""
      }`}
      title={name}
    >
      {entry.kind === "skill" ? (entry.name ?? name) : entry.id}
    </span>
  );
}

/** The row's win rate and games, or why it has no rate. */
function RowStat({ row }: { row: BuildRow }) {
  if (row.sample === "hidden")
    return (
      <p className={statLine}>
        {sampleLabels.hidden} ({row.winRate.sampleCount})
      </p>
    );
  return (
    <p className={statLine}>
      <strong className="font-mono font-medium text-fg">{percent(row.winRate)}</strong> Win Rate ·{" "}
      {row.games.toLocaleString()} Games
    </p>
  );
}

function Block({
  title,
  row,
  children,
}: {
  title: string;
  row: BuildRow | undefined;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section className={block} aria-labelledby={id}>
      <h3 id={id} className="text-sm text-fg-secondary">
        {title}
      </h3>
      {row ? (
        <>
          {children ?? (
            <div className={iconRow} aria-label={row.items.map(entryName).join(", ")}>
              {row.items.map((entry, i) => (
                <BuildIcon key={`${entry.kind}:${entry.id}:${i}`} entry={entry} />
              ))}
            </div>
          )}
          <RowStat row={row} />
        </>
      ) : (
        <p className={statLine}>No Games Yet</p>
      )}
    </section>
  );
}

/** Icons joined by arrows, for orders such as the core path or skill priority. */
function Sequence({ row, large = false }: { row: BuildRow; large?: boolean }) {
  return (
    <div className={iconRow} aria-label={row.items.map(entryName).join(" then ")}>
      {row.items.map((entry, i) => (
        <Fragment key={`${entry.kind}:${entry.id}:${i}`}>
          {i > 0 ? (
            <span aria-hidden="true" className="text-lg text-fg-muted">
              ›
            </span>
          ) : null}
          <BuildIcon entry={entry} large={large} />
        </Fragment>
      ))}
    </div>
  );
}

/** The two most common choices for one completed-item slot. */
function SlotOptions({ title, rows }: { title: string; rows: BuildRow[] }) {
  const options = rows.slice(0, 2);
  const id = useId();
  return (
    <section className={block} aria-labelledby={id}>
      <h3 id={id} className="text-sm text-fg-secondary">
        {title}
      </h3>
      {options.length ? (
        <div className="flex items-center gap-2">
          {options.map((row, i) => (
            <Fragment key={row.items.map((item) => item.id).join(",")}>
              {i > 0 ? (
                <span aria-hidden="true" className="text-xs text-fg-muted uppercase">
                  or
                </span>
              ) : null}
              <div className="grid justify-items-center gap-0.5">
                {row.items.map((entry) => (
                  <BuildIcon key={entry.id} entry={entry} large />
                ))}
                <span className="grid font-mono text-xs text-fg">
                  {row.sample === "hidden" ? "—" : percent(row.winRate)}
                  <small className="text-2xs text-fg-muted">{row.games.toLocaleString()}</small>
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <p className={statLine}>No Games Yet</p>
      )}
    </section>
  );
}

/**
 * The most common build at a glance: runes, spells, skill order, starting items, boots, the
 * core path and the options for each completed item. Solo queue only.
 */
export function BuildCard({ builds }: { builds: ChampionBuilds | null }) {
  if (!builds) return null;
  const keystone = builds.keystone[0];
  const page = builds.runes[0];
  const shards = builds.shards[0];
  const skillOrder = builds.skillmax[0] ?? builds.skills[0];
  return (
    <Panel title="Most Common Build">
      <div className="grid grid-cols-3 gap-x-6 gap-y-6 max-[600px]:grid-cols-2">
        <Block title="Runes" row={page ?? keystone}>
          <div className="grid justify-items-center gap-2">
            {keystone ? (
              <span className="inline-grid rounded-full outline-2 outline-offset-2 outline-accent outline-solid">
                <BuildIcon entry={keystone.items[0]!} large />
              </span>
            ) : null}
            <div className={iconRow} aria-label="Rune Page">
              {(page?.items ?? [])
                .filter((entry) => entry.id !== keystone?.items[0]?.id)
                .map((entry, i) => (
                  <BuildIcon key={`${entry.id}:${i}`} entry={entry} />
                ))}
            </div>
            {shards ? (
              <div className={iconRow} aria-label="Stat Shards">
                {shards.items.map((entry, i) => (
                  <BuildIcon key={`${entry.id}:${i}`} entry={entry} />
                ))}
              </div>
            ) : null}
          </div>
        </Block>
        <Block title="Summoner Spells" row={builds.spells[0]} />
        <Block title="Skill Order" row={skillOrder}>
          {skillOrder ? <Sequence row={skillOrder} /> : null}
        </Block>
        <Block title="Starting Items" row={builds.start[0]} />
        <Block title="Boots" row={builds.boots[0]} />
        <Block title="Core Build" row={builds.path[0]}>
          {builds.path[0] ? <Sequence row={builds.path[0]} large /> : null}
        </Block>
        <SlotOptions title="Item 1" rows={builds.slot1} />
        <SlotOptions title="Item 2" rows={builds.slot2} />
        <SlotOptions title="Item 3" rows={builds.slot3} />
      </div>
    </Panel>
  );
}
