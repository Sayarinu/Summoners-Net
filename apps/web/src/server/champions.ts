import "server-only";
import { tierListQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Validates the tier list query string; an invalid one shows an error instead of data. */
export async function loadTierList(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(
    // "all" (and an empty value) means no filter for that field.
    Object.entries(params).filter(([, v]) => typeof v === "string" && v !== "" && v !== "all"),
  );
  const parsed = tierListQuerySchema.safeParse(raw);
  if (!parsed.success)
    return {
      list: null,
      error:
        "Choose filters from the lists: a patch such as 16.22, a role, a region, a tier and a sort.",
    };
  return { list: await data().tierList(parsed.data), error: null };
}
