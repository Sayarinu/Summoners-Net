import "server-only";
import { leaderboardQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";
export async function loadLeaderboard(
  region: string,
  params: Record<string, string | string[] | undefined>,
) {
  if (!leaderboardQuerySchema.shape.region.safeParse(region).success) return null;
  const parsed = leaderboardQuerySchema.safeParse({ ...params, region });
  if (!parsed.success)
    return { list: null, error: "Choose a positive page and a page size from 1 to 100." };
  return { list: await data().leaderboard(parsed.data), error: null };
}
