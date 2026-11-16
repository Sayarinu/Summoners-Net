import "server-only";
import { trendingQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";
export async function loadTrending(params: Record<string, string | string[] | undefined>) {
  const input = { ...params };
  if (input.patch === "all" || input.patch === "") delete input.patch;
  const parsed = trendingQuerySchema.safeParse(input);
  if (!parsed.success)
    return {
      trends: null,
      error: "Choose Solo queue or Pro, a patch such as 16.22, a valid role and a positive page.",
    };
  return { trends: await data().trending(parsed.data), error: null };
}
