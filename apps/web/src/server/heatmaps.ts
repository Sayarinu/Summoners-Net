import "server-only";
import { heatmapQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

const error = "Choose a champion, player or role, a heatmap type and a catalog patch.";
type Params = Record<string, string | string[] | undefined>;

/**
 * Validates the query string and reads one heatmap from the aggregates. Invalid parameters are
 * reported on the page; an unknown champion or role is not found.
 */
export async function loadHeatmap(params: Params) {
  const input = { ...params };
  if (input.patch === "" || input.patch === "latest") delete input.patch;
  const parsed = heatmapQuerySchema.safeParse(input);
  if (!parsed.success || Object.values(params).some(Array.isArray)) return { heatmap: null, error };
  const heatmap = await data().heatmap(parsed.data);
  return heatmap ? { heatmap, error: null } : null;
}
