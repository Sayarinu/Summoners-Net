import "server-only";
import { overviewPatchSchema } from "@summonersnet/data/contracts";
import { data } from "./data";
export async function loadPatchOverview(patch: string) {
  const parsed = overviewPatchSchema.safeParse(patch);
  return parsed.success ? data().patchOverview(parsed.data) : null;
}
