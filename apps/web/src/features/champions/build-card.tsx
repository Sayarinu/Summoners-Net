"use client";
import { Fragment, useId, type ReactNode } from "react";
import { ItemIcon, RuneIcon, SummonerSpellIcon } from "@summonersnet/ui";
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
    <span className={`ev-build-key ev-build-key--${entry.kind}`} title={name}>
      {entry.kind === "skill" ? (entry.name ?? name) : entry.id}
    </span>
  );
}

/** The row's win rate and games, or why it has no rate. */
function RowStat({ row }: { row: BuildRow }) {
  if (row.sample === "hidden")
    return (
      <p className="ev-build-stat">
        {sampleLabels.hidden} ({row.winRate.sampleCount})
      </p>
    );
  return (
    <p className="ev-build-stat">
      <strong>{percent(row.winRate)}</strong> Win Rate · {row.games.toLocaleString()} Games
    </p>
  );
}

function Block({
  title,
  row,
  children,
  wide = false,
}: {
  title: string;
  row: BuildRow | undefined;
  children?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <section
      className={`ev-build-block${wide ? " ev-build-block--wide" : ""}`}
      aria-labelledby={id}
    >
      <h3 id={id}>{title}</h3>
      {row ? (
        <>
          {children ?? (
            <div className="ev-build-icons" aria-label={row.items.map(entryName).join(", ")}>
              {row.items.map((entry, i) => (
                <BuildIcon key={`${entry.kind}:${entry.id}:${i}`} entry={entry} />
              ))}
            </div>
          )}
          <RowStat row={row} />
        </>
      ) : (
        <p className="ev-build-stat">No Games Yet</p>
      )}
    </section>
  );
}

/** Icons joined by arrows, for orders such as the core path or skill priority. */
function Sequence({ row, large = false }: { row: BuildRow; large?: boolean }) {
  return (
    <div className="ev-build-icons" aria-label={row.items.map(entryName).join(" then ")}>
      {row.items.map((entry, i) => (
        <Fragment key={`${entry.kind}:${entry.id}:${i}`}>
          {i > 0 ? (
            <span aria-hidden="true" className="ev-build-arrow">
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
    <section className="ev-build-block" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {options.length ? (
        <div className="ev-build-options">
          {options.map((row, i) => (
            <Fragment key={row.items.map((item) => item.id).join(",")}>
              {i > 0 ? (
                <span aria-hidden="true" className="ev-build-or">
                  or
                </span>
              ) : null}
              <div className="ev-build-option">
                {row.items.map((entry) => (
                  <BuildIcon key={entry.id} entry={entry} large />
                ))}
                <span className="ev-build-option__stat">
                  {row.sample === "hidden" ? "—" : percent(row.winRate)}
                  <small>{row.games.toLocaleString()}</small>
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="ev-build-stat">No Games Yet</p>
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
    <section className="ev-card ev-build-card" aria-labelledby="build-card-heading">
      <h2 id="build-card-heading">Most Common Build</h2>
      <div className="ev-build-grid">
        <Block title="Runes" row={page ?? keystone} wide>
          <div className="ev-build-runes">
            {keystone ? (
              <span className="ev-build-keystone">
                <BuildIcon entry={keystone.items[0]!} large />
              </span>
            ) : null}
            <div className="ev-build-icons" aria-label="Rune Page">
              {(page?.items ?? [])
                .filter((entry) => entry.id !== keystone?.items[0]?.id)
                .map((entry, i) => (
                  <BuildIcon key={`${entry.id}:${i}`} entry={entry} />
                ))}
            </div>
            {shards ? (
              <div className="ev-build-icons" aria-label="Stat Shards">
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
        <Block title="Core Build" row={builds.path[0]} wide>
          {builds.path[0] ? <Sequence row={builds.path[0]} large /> : null}
        </Block>
        <SlotOptions title="Item 1" rows={builds.slot1} />
        <SlotOptions title="Item 2" rows={builds.slot2} />
        <SlotOptions title="Item 3" rows={builds.slot3} />
      </div>
    </section>
  );
}
