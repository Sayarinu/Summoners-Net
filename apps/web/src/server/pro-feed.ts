import "server-only";
import { proFeedQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";
export async function loadProFeed(params: Record<string, string | string[] | undefined>) {
  const parsed = proFeedQuerySchema.safeParse(params);
  if (!parsed.success)
    return {
      feed: null,
      error: "Choose valid team and league filters, a positive page and a page size from 1 to 100.",
    };
  return { feed: await data().proFeed(parsed.data), error: null };
}
