import "server-only";
import {
  championMatchupsQuerySchema,
  counterPickListQuerySchema,
  matchupMatrixQuerySchema,
} from "@summonersnet/data/contracts";
import { data } from "./data";
const error = "Choose Solo queue or Pro, a catalog patch, a role, a statistic and a positive page.";
type Params = Record<string, string | string[] | undefined>;
function filters(params: Params) {
  const input = { ...params };
  if (input.patch === "all" || input.patch === "") delete input.patch;
  return input;
}
export async function loadChampionMatchups(champion: string, params: Params) {
  if (!championMatchupsQuerySchema.shape.champion.safeParse(champion).success) return null;
  const parsed = championMatchupsQuerySchema.omit({ champion: true }).safeParse(filters(params));
  // Several patches arrive as repeated values; every other filter takes one.
  const repeated = Object.entries(params).some(([key, v]) => key !== "patch" && Array.isArray(v));
  if (!parsed.success || repeated) return { matchups: null, error };
  const matchups = await data().championMatchups({ ...parsed.data, champion });
  if (!matchups) return null;
  // The stored score for the patch the matchup page resolved, so both describe the same sample.
  const blindability = matchups.patch
    ? await data().championBlindability({
        championKey: matchups.champion.championKey,
        source: parsed.data.source,
        patch: matchups.patch,
        role: parsed.data.role,
      })
    : null;
  return { matchups, blindability, error: null };
}
export async function loadMatchupMatrix(role: string, params: Params) {
  const parsedRole = matchupMatrixQuerySchema.shape.role.safeParse(role);
  if (!parsedRole.success) return null;
  const parsed = matchupMatrixQuerySchema.omit({ role: true }).safeParse(filters(params));
  if (!parsed.success || Object.values(params).some(Array.isArray)) return { matrix: null, error };
  return {
    matrix: await data().matchupMatrix({ ...parsed.data, role: parsedRole.data }),
    error: null,
  };
}
export async function loadCounterPickList(role: string, params: Params) {
  const parsedRole = counterPickListQuerySchema.shape.role.safeParse(role);
  if (!parsedRole.success) return null;
  const parsed = counterPickListQuerySchema.omit({ role: true }).safeParse(filters(params));
  if (!parsed.success || Object.values(params).some(Array.isArray))
    return { list: null, error, role: parsedRole.data };
  return {
    list: await data().counterPickList({ ...parsed.data, role: parsedRole.data }),
    error: null,
    role: parsedRole.data,
  };
}
