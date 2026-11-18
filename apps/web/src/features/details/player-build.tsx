import { ItemIcon } from "@summonersnet/ui";
import type { HistoricalPlayerBuild } from "@summonersnet/data";

export type ProItemIcons = Record<string, { name: string; imageUrl: string | null }>;

export function PlayerBuild({
  build,
  items,
  player,
}: {
  build: HistoricalPlayerBuild;
  items: ProItemIcons | undefined;
  player: string;
}) {
  const icon = (id: number) => {
    const item = items?.[id];
    return (
      <ItemIcon
        id={String(id)}
        name={item?.name ?? `Item ${id}`}
        imageUrl={item?.imageUrl ?? null}
        size="small"
      />
    );
  };
  const inventory = (
    <span className="ev-player-build__items" role="group" aria-label={`${player} Final Items`}>
      {build.inventory.map((id, slot) => (
        <span key={slot}>{icon(id)}</span>
      ))}
    </span>
  );
  const purchases = build.purchases ?? [];
  if (!purchases.length) return build.inventory.length ? inventory : null;
  const minutes = Map.groupBy(purchases, ({ timestampMs }) => Math.floor(timestampMs / 60_000));
  return (
    <details className="ev-player-build">
      <summary aria-label={`${player} Build Path`}>
        {build.inventory.length ? inventory : "Build Path"}
      </summary>
      <ol className="ev-player-build__path" role="list" aria-label={`${player} Purchase Order`}>
        {[...minutes].map(([minute, entries]) => (
          <li key={minute}>
            <time className="np-meta" dateTime={`PT${minute}M`}>
              {minute}m
            </time>
            <span className="ev-player-build__items">
              {entries.map(({ itemId, timestampMs }, index) => (
                <span
                  key={index}
                  title={`${Math.floor(timestampMs / 60000)}:${String(Math.floor(timestampMs / 1000) % 60).padStart(2, "0")}`}
                >
                  {icon(itemId)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
