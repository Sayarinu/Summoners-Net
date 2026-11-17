import "server-only";
import { z } from "zod";
import { championRoles } from "@summonersnet/data/contracts";
import { data } from "./data";

type Params = Record<string, string | string[] | undefined>;
const champion = z.string().regex(/^[A-Za-z0-9]{1,40}$/);
const patch = z.string().regex(/^\d{1,2}\.\d{1,2}$/);
const shared = {
  source: z.enum(["solo", "pro"]).default("solo"),
  role: z.enum(championRoles).default("ALL"),
};
export const championComparisonSchema = z.strictObject({
  a: champion,
  b: champion,
  patch: patch.optional(),
  ...shared,
});
export const patchComparisonSchema = z.strictObject({
  a: patch,
  b: patch,
  page: z.coerce.number().int().min(1).max(10000).default(1),
  ...shared,
});
const cleaned = (params: Params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== "all"));
const incomplete = (params: Params) => !params.a || !params.b;

/** Two champions' overviews on the same filters. Without both champions only the form shows. */
export async function loadChampionComparison(params: Params) {
  if (incomplete(params)) return { comparison: null, error: null };
  const parsed = championComparisonSchema.safeParse(cleaned(params));
  if (!parsed.success || Object.values(params).some(Array.isArray))
    return {
      comparison: null,
      error: "Choose two champion ids such as Ahri, a source, a role and a patch such as 16.22.",
    };
  const { a, b, ...filters } = parsed.data;
  const [left, right] = await Promise.all([
    data().championOverview({ ...filters, champion: a }),
    data().championOverview({ ...filters, champion: b }),
  ]);
  return { comparison: { query: parsed.data, a: left, b: right }, error: null };
}

/**
 * One page of the first patch's tier list by games, with the second patch's statistics for the
 * same champions and role. Without both patches only the form shows.
 */
export async function loadPatchComparison(params: Params) {
  if (incomplete(params)) return { comparison: null, error: null };
  const parsed = patchComparisonSchema.safeParse(cleaned(params));
  if (!parsed.success || Object.values(params).some(Array.isArray))
    return {
      comparison: null,
      error: "Choose two patches such as 16.21 and 16.22, a source, a role and a positive page.",
    };
  const q = parsed.data;
  const [list, other] = await Promise.all([
    data().tierList({ source: q.source, role: q.role, patch: q.a, page: q.page, sort: "games" }),
    data().championStats({ source: q.source, role: q.role, patch: q.b }),
  ]);
  return {
    comparison: {
      query: q,
      a: list.patch === q.a ? list : null,
      b: other.patch === q.b ? other : null,
    },
    error: null,
  };
}
