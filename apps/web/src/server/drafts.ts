import "server-only";
import { draftQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

export async function loadDrafts(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ""));
  const parsed = draftQuerySchema.partial({ patch: true }).safeParse(raw);
  if (!parsed.success)
    return {
      query: null,
      analytics: null,
      error:
        "Enter a patch such as 16.22, a league of at most 100 characters, and valid page numbers.",
    };
  const patch = parsed.data.patch ?? (await data().latestDraftPatch());
  if (!patch) return { query: null, analytics: null, error: null };
  const query = draftQuerySchema.parse({ ...parsed.data, patch });
  return { query, analytics: await data().draftAnalytics(query), error: null };
}
