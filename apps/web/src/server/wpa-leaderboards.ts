import "server-only";
import { wpaLeaderboardQuerySchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Validates the query string; "all" or an empty value means the default. */
export async function loadWpaLeaderboard(params: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(
    Object.entries(params).filter(([, v]) => typeof v === "string" && v !== "" && v !== "all"),
  );
  const parsed = wpaLeaderboardQuerySchema.safeParse(raw);
  if (!parsed.success)
    return {
      board: null,
      error: "Choose a board, a patch such as 16.22 and a sort from the lists.",
    };
  return { board: await data().wpaLeaderboard(parsed.data), error: null };
}
