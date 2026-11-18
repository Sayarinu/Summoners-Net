import { ItemIcon } from "@summonersnet/ui";
import type { HistoricalPlayerBuild } from "@summonersnet/data";

export type ProItemIcons = Record<string, { name: string; imageUrl: string | null }>;

function clock(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PlayerBuild({
  build,
  items,
  player,
}: {
  build: HistoricalPlayerBuild;
  items: ProItemIcons | undefined;
  player: string;
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
    <span className="ev-player-build__items" role="group" aria-label={`${player} Final Items`}>
      {build.inventory.map((id, slot) => (
        <span key={slot}>{icon(id)}</span>
      ))}
    </span>
  ) : null;
  const purchases = build.purchases ?? [];
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
    <details className="ev-player-build">
      <summary aria-label={`${player} Build Path`}>
        {inventory ?? <span className="np-meta">Build Path</span>}
      </summary>
      <ol className="ev-player-build__path" role="list" aria-label={`${player} Purchase Order`}>
        {steps.map(({ minute, entries }) => (
          <li key={minute}>
            <time className="np-meta" dateTime={`PT${minute}M`}>
              {minute}m
            </time>
            <span className="ev-player-build__items">
              {entries.map(({ itemId, count, times }) => (
                <span
                  key={itemId}
                  className="ev-player-build__purchase"
                  title={`${name(itemId)} at ${times}`}
                >
                  {icon(itemId)}
                  {count > 1 ? (
                    <span className="ev-player-build__count" aria-label={`${count} bought`}>
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
