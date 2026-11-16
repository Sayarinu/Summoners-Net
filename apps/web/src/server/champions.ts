import "server-only";
import { championOverviewQuerySchema, tierListQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

// "all" (and an empty value) means no filter for that field.
const filters = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== "all"),
  );
/** Validates the tier list query string; an invalid one shows an error instead of data. */
export async function loadTierList(params: Record<string, string | string[] | undefined>) {
  const parsed = tierListQuerySchema.safeParse(filters(params));
  if (!parsed.success)
    return {
      list: null,
      error:
        "Choose filters from the lists: a patch such as 16.22, a role, a region, a tier and a sort.",
    };
  return { list: await data().tierList(parsed.data), error: null };
}

const filterError =
  "Choose filters from the lists: a patch such as 16.22, a role, a region and a tier.";
/**
 * Validates the champion id and filters. Unknown champions return null (not found); invalid
 * filters show the overview for the default filters with an error.
 */
export async function loadChampionOverview(
  championId: string,
  params: Record<string, string | string[] | undefined>,
) {
  const id = championOverviewQuerySchema.shape.champion.safeParse(championId);
  if (!id.success) return null;
  const input = filters(params);
  for (const name of ["playersSort", "playersPage"])
    if (params[name] !== undefined) input[name] = params[name];
  const parsed = championOverviewQuerySchema.safeParse({ ...input, champion: id.data });
  const overview = await data().championOverview(
    parsed.success ? parsed.data : { champion: id.data },
  );
  if (!overview) return null;
  return { overview, error: parsed.success ? null : filterError };
}
