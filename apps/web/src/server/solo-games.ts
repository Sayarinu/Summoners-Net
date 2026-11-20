import "server-only";
import { soloMatchIdSchema } from "@summonersnet/data/contracts";
import { data } from "./data";

/** Validates the match id; an invalid or unknown id is not found. */
export async function loadSoloGame(matchId: string) {
  const id = soloMatchIdSchema.safeParse(matchId);
  return id.success ? data().soloGame(id.data) : null;
}

/** A game, its stored per-minute positions and map events for the viewer; null when not found. */
export async function loadSoloGameMap(matchId: string) {
  const id = soloMatchIdSchema.safeParse(matchId);
  if (!id.success) return null;
  const [game, positions, events, track] = await Promise.all([
    data().soloGame(id.data),
    data().soloGamePositions(id.data),
    data().soloGameMapEvents(id.data),
    data().matchTrackSummary(id.data),
  ]);
  return game && positions && events ? { game, positions, events, track } : null;
}

/** The pre-game draft win probability for a stored solo game; null when not found. */
export async function loadSoloDraftWinProbability(matchId: string) {
  const id = soloMatchIdSchema.safeParse(matchId);
  return id.success ? data().soloDraftWinProbability(id.data) : null;
}
