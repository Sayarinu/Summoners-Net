import "server-only";
import type { HistoricalGameDetail } from "@summonersnet/data";
import { data } from "./data";

export async function proItemIcons(detail: HistoricalGameDetail | null) {
  const telemetry = detail?.telemetry;
  if (!telemetry?.patch) return undefined;
  const patch = telemetry.patch;
  const ids = [
    ...new Set(
      Object.values(telemetry.builds).flatMap(({ inventory, purchases }) =>
        [...inventory, ...(purchases?.map(({ itemId }) => itemId) ?? [])].map(String),
      ),
    ),
  ];
  const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
    data().catalogIcons({ patch, kind: "item", ids: ids.slice(index * 100, (index + 1) * 100) }),
  );
  const items = (await Promise.all(batches)).flat();
  return Object.fromEntries(items.map(({ id, name, imageUrl }) => [id, { name, imageUrl }]));
}
