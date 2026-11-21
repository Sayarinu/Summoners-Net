import "server-only";
import { counterPickListQuerySchema, matchupMatrixQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";
const error = "Choose Solo queue or Pro, a catalog patch, a role, a statistic and a positive page.";
type Params = Record<string, string | string[] | undefined>;
function filters(params: Params) {
  const input = { ...params };
  if (input.patch === "all" || input.patch === "") delete input.patch;
  return input;
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
