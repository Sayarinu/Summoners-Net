import { ItemIcon } from "@summonersnet/ui";
import type { HistoricalPlayerBuild } from "@summonersnet/data";

export type ProItemIcons = Record<string, { name: string; imageUrl: string | null }>;

function clock(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const purchasesOf = (build: HistoricalPlayerBuild) => build.purchases ?? [];
/** Item icons in one row, at 20px. */
const itemRow = "inline-flex flex-nowrap gap-[2px] align-middle [&_[role=img]]:size-5";
const summaryClass =
  "-ms-[2px] inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-sm py-[2px] ps-[2px] pe-1 text-fg-muted hover:bg-interactive hover:text-fg [&::-webkit-details-marker]:hidden after:size-[0.4rem] after:flex-none after:border-e-[1.5px] after:border-b-[1.5px] after:border-current after:transition-transform after:duration-[120ms] after:ease-[ease] after:content-['']";
const mirroredSummaryClass =
  "after:-rotate-45 group-open/build:after:rotate-45 @min-[46.75rem]:flex-row-reverse @min-[46.75rem]:ms-0 @min-[46.75rem]:-me-[2px] @min-[46.75rem]:ps-1 @min-[46.75rem]:pe-[2px] @min-[46.75rem]:after:rotate-135 @min-[46.75rem]:group-open/build:after:rotate-45";

export function PlayerBuild({
  build,
  items,
  player,
  mirrored = false,
}: {
  build: HistoricalPlayerBuild;
  items: ProItemIcons | undefined;
  player: string;
  /** The red side's row once both teams sit side by side: the chevron sits inward and points in. */
  mirrored?: boolean;
}) {
  const name = (id: number) => items?.[id]?.name ?? `Item ${id}`;
  const icon = (id: number) => (
    <ItemIcon
      id={String(id)}
      name={name(id)}
      imageUrl={items?.[id]?.imageUrl ?? null}
      size="small"
    />
  );
  const inventory = build.inventory.length ? (
    <span
      className={`${itemRow} ${purchasesOf(build).length ? "" : "mt-1"}`}
      role="group"
      aria-label={`${player} Final Items`}
    >
      {build.inventory.map((id, slot) => (
        <span key={slot}>{icon(id)}</span>
      ))}
    </span>
  ) : null;
  const purchases = purchasesOf(build);
  if (!purchases.length) return inventory;
  // One step per minute; repeated buys in the same minute show once with a count.
  const steps = [
    ...Map.groupBy(purchases, ({ timestampMs }) => Math.floor(timestampMs / 60_000)),
  ].map(([minute, entries]) => ({
    minute,
    entries: [...Map.groupBy(entries, ({ itemId }) => itemId)].map(([itemId, bought]) => ({
      itemId,
      count: bought.length,
      times: bought.map(({ timestampMs }) => clock(timestampMs)).join(", "),
    })),
  }));
  return (
    <details className="group/build mt-1">
      <summary
        className={`${summaryClass} ${mirrored ? mirroredSummaryClass : "after:-rotate-45 group-open/build:after:rotate-45"}`}
        aria-label={`${player} Build Path`}
      >
        {inventory ?? <span className="np-meta">Build Path</span>}
      </summary>
      <ol
        className="mt-1 flex list-none flex-wrap items-end gap-x-2 gap-y-1 border-s-2 border-line px-2 py-1"
        role="list"
        aria-label={`${player} Purchase Order`}
      >
        {steps.map(({ minute, entries }) => (
          <li className="grid gap-px" key={minute}>
            <time className="np-meta text-xs leading-none" dateTime={`PT${minute}M`}>
              {minute}m
            </time>
            <span className={itemRow}>
              {entries.map(({ itemId, count, times }) => (
                <span
                  key={itemId}
                  className="relative inline-flex"
                  title={`${name(itemId)} at ${times}`}
                >
                  {icon(itemId)}
                  {count > 1 ? (
                    <span
                      className="absolute -end-[3px] -bottom-[2px] rounded-sm bg-raised px-[2px] text-[0.625rem] leading-[1.1] text-fg"
                      aria-label={`${count} bought`}
                    >
                      ×{count}
                    </span>
                  ) : null}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
