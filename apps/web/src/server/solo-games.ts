import "server-only";
import { soloMatchIdSchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Validates the match id; an invalid or unknown id is not found. */
export async function loadSoloGame(matchId: string) {
  const id = soloMatchIdSchema.safeParse(matchId);
  return id.success ? data().soloGame(id.data) : null;
}
