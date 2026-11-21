"use client";
import { Fragment, useId, type ReactNode } from "react";
import { ItemIcon, Panel, RuneIcon, SkillOrderGrid, SummonerSpellIcon } from "@summonersnet/ui";
import {
  skillPathLevels,
  type BuildItem,
  type BuildRow,
  type ChampionBuilds,
  type RuneTree,
} from "@summonersnet/data/contracts";
import { percent } from "./presentation";

const fallbackNames: Record<BuildItem["kind"], string> = {
  item: "Item",
  rune: "Rune",
  shard: "Stat Shard",
  spell: "Summoner Spell",
  skill: "Ability",
};
export const entryName = (entry: BuildItem) =>
  entry.name ?? `${fallbackNames[entry.kind]} ${entry.id}`;
const muted = "text-xs text-fg-muted";

/** One build entry: an icon for items, runes, stat shards and spells; a key for skills. */
export function BuildIcon({
  entry,
  size = "small",
  state,
}: {
  entry: BuildItem;
  size?: "small" | "medium" | "large";
  state?: "selected" | "muted";
}) {
  const name = entryName(entry);
  const icon = { id: entry.catalogId, name, imageUrl: entry.imageUrl, size, state };
  if (entry.kind === "item") return <ItemIcon {...icon} />;
  if (entry.kind === "spell") return <SummonerSpellIcon {...icon} />;
  if (entry.kind === "skill")
    return (
      <span
        className="inline-grid h-8 min-w-8 place-items-center rounded-sm border border-line-strong bg-raised font-mono text-sm font-semibold text-accent"
        title={name}
      >
        {name}
      </span>
    );
  return <RuneIcon {...icon} />;
}

/** A choice's win rate, pick rate and games. */
export function RowStats({ row }: { row: BuildRow }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-fg-muted">
      <strong className="text-sm font-medium text-fg">
        {row.winRate.value === null ? "—" : percent(row.winRate)}
      </strong>
      <span>WR</span>
      {row.pickRate.value !== null ? <span>{percent(row.pickRate)} Pick</span> : null}
      <span>{row.games.toLocaleString()} Games</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h3 id={id} className="font-mono text-2xs tracking-wide text-fg-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Icons in order with arrows between them, read as "A then B". */
function Sequence({
  row,
  size = "medium",
}: {
  row: BuildRow;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className="flex flex-wrap items-center gap-1.5"
      aria-label={row.items.map(entryName).join(" then ")}
      role="group"
    >
      {row.items.map((entry, i) => (
        <Fragment key={`${entry.id}:${i}`}>
          {i > 0 ? (
            <span aria-hidden="true" className="text-fg-muted">
              ›
            </span>
          ) : null}
          <BuildIcon entry={entry} size={size} />
        </Fragment>
      ))}
    </span>
  );
}

/** The most common choices of one kind, each with its icons and figures. */
function Options({
  rows,
  limit = 3,
  sequence = false,
  empty,
}: {
  rows: BuildRow[];
  limit?: number;
  sequence?: boolean;
  empty: string;
}) {
  if (!rows.length) return <p className={muted}>{empty}</p>;
  return (
    <ol className="flex list-none flex-col gap-3">
      {rows.slice(0, limit).map((row, i) => (
        <li key={row.items.map((item) => item.id).join(",")} className="flex flex-col gap-1">
          {sequence ? (
            <Sequence row={row} size={i === 0 ? "medium" : "small"} />
          ) : (
            <span
              className="flex flex-wrap items-center gap-1.5"
              aria-label={row.items.map(entryName).join(", ")}
              role="group"
            >
              {row.items.map((entry, n) => (
                <BuildIcon
                  key={`${entry.id}:${n}`}
                  entry={entry}
                  size={i === 0 ? "medium" : "small"}
                />
              ))}
            </span>
          )}
          <RowStats row={row} />
        </li>
      ))}
    </ol>
  );
}

function Tree({
  tree,
  chosen,
  secondary = false,
}: {
  tree: RuneTree;
  chosen: Set<number>;
  secondary?: boolean;
}) {
  // A secondary tree never holds a keystone, so its first row is left out.
  const rows = secondary ? tree.rows.slice(1) : tree.rows;
  return (
    <section
      aria-label={`${secondary ? "Secondary" : "Primary"}: ${entryName(tree.tree)}`}
      className="flex flex-col items-center gap-3"
    >
      <span className="flex items-center gap-2 text-sm text-fg-secondary">
        <BuildIcon entry={tree.tree} />
        {entryName(tree.tree)}
      </span>
      {rows.map((row, i) => (
        <span key={i} className="flex justify-center gap-2">
          {row.map((rune) => (
            <BuildIcon
              key={rune.id}
              entry={rune}
              size={!secondary && i === 0 ? "large" : "small"}
              state={chosen.has(rune.id) ? "selected" : "muted"}
            />
          ))}
        </span>
      ))}
    </section>
  );
}

/**
 * The most common rune page drawn over its trees, the chosen runes lit among the alternatives,
 * with its stat shards and the next most common pages.
 */
export function RunesPanel({ builds }: { builds: ChampionBuilds }) {
  const page = builds.runes[0];
  const shards = builds.shards[0];
  const trees = new Map(builds.runeTrees.map((t) => [t.tree.id, t]));
  const primary = page ? trees.get(page.items[0]!.id) : undefined;
  const secondary = page ? trees.get(page.items[5]?.id ?? -1) : undefined;
  const chosen = new Set(page?.items.map((i) => i.id));
  return (
    <Panel title="Runes">
      {!page ? (
        <p className={muted}>No Games Yet</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-6 max-[700px]:grid-cols-1">
            {/* A tree missing from the catalog lists the page's runes from it in order. */}
            {primary ? (
              <Tree tree={primary} chosen={chosen} />
            ) : (
              <Sequence row={{ ...page, items: page.items.slice(0, 5) }} size="small" />
            )}
            {secondary ? (
              <Tree tree={secondary} chosen={chosen} secondary />
            ) : (
              <Sequence row={{ ...page, items: page.items.slice(5) }} size="small" />
            )}
            {shards ? (
              <section aria-label="Stat Shards" className="flex flex-col items-center gap-3">
                <span className="text-sm text-fg-secondary">Stat Shards</span>
                {/* Offense, flex and defense, each row's chosen shard lit. */}
                {builds.shardRows.map((options, i) => (
                  <span key={i} className="flex gap-2">
                    {options.map((entry) => (
                      <BuildIcon
                        key={entry.id}
                        entry={entry}
                        state={shards.items[i]?.id === entry.id ? "selected" : "muted"}
                      />
                    ))}
                  </span>
                ))}
              </section>
            ) : null}
          </div>
          <RowStats row={page} />
          {builds.runes.length > 1 ? (
            <Section title="Other Rune Pages">
              <ol className="flex list-none flex-col gap-2">
                {builds.runes.slice(1, 4).map((row) => (
                  <li
                    key={row.items.map((item) => item.id).join(",")}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2"
                  >
                    <span
                      className="flex items-center gap-1.5"
                      aria-label={row.items.map(entryName).join(", ")}
                      role="group"
                    >
                      {row.items.slice(1, 5).map((entry) => (
                        <BuildIcon key={entry.id} entry={entry} />
                      ))}
                      <span aria-hidden="true" className="text-fg-muted">
                        +
                      </span>
                      {row.items.slice(5).map((entry) => (
                        <BuildIcon key={entry.id} entry={entry} />
                      ))}
                    </span>
                    <RowStats row={row} />
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

/** Summoner spells, the order abilities are maxed and the full skill path by level. */
export function SpellsAndSkillsPanel({ builds }: { builds: ChampionBuilds }) {
  const max = builds.skillmax[0];
  const path = builds.skillpath[0];
  return (
    <Panel title="Summoner Spells and Skills">
      <div className="flex flex-col gap-6">
        <Section title="Summoner Spells">
          <Options rows={builds.spells} limit={2} empty="No Games Yet" />
        </Section>
        <Section title="Skill Priority">
          {max ? (
            <div className="flex flex-col gap-1">
              <span
                className="flex items-center gap-2"
                aria-label={max.items.map(entryName).join(" then ")}
                role="group"
              >
                {max.items.map((entry, i) => (
                  <Fragment key={entry.id}>
                    {i > 0 ? (
                      <span aria-hidden="true" className="text-fg-muted">
                        ›
                      </span>
                    ) : null}
                    <BuildIcon entry={entry} />
                  </Fragment>
                ))}
              </span>
              <RowStats row={max} />
            </div>
          ) : (
            <p className={muted}>No Games With a Decided Max Order Yet</p>
          )}
        </Section>
        <Section title="Skill Order">
          {path ? (
            <div className="flex flex-col gap-1 overflow-x-auto">
              {/* Few games reach level 18, so the last levels follow the max order. */}
              <SkillOrderGrid
                caption="Most Common Skill Order"
                path={path.items.map((entry) => entry.id)}
                projectedFrom={skillPathLevels + 1}
              />
              <RowStats row={path} />
            </div>
          ) : (
            <p className={muted}>No Games With Timelines Yet</p>
          )}
        </Section>
      </div>
    </Panel>
  );
}

/** Items in the order they are bought: starting items, boots, the core and each later item. */
export function ItemsPanel({ builds }: { builds: ChampionBuilds }) {
  const empty = "No Games With Timelines Yet";
  return (
    <Panel title="Items">
      <div className="grid grid-cols-6 gap-6 max-[1150px]:grid-cols-3 max-[600px]:grid-cols-2">
        <Section title="Starting Items">
          <Options rows={builds.start} empty={empty} />
        </Section>
        <Section title="Boots">
          <Options rows={builds.boots} empty={empty} />
        </Section>
        <Section title="Core Build">
          <Options rows={builds.path} sequence empty={empty} />
        </Section>
        <Section title="Fourth Item">
          <Options rows={builds.slot4} empty={empty} />
        </Section>
        <Section title="Fifth Item">
          <Options rows={builds.slot5} empty={empty} />
        </Section>
        <Section title="Sixth Item">
          <Options rows={builds.slot6} empty={empty} />
        </Section>
      </div>
    </Panel>
  );
}
