import "server-only";
import type { SeriesGame } from "@summonersnet/data";
import { gameTeams } from "../features/browse/presentation";
import type { SeriesGameSummary } from "../features/details/series";
import { data } from "./data";

export async function seriesSummaries(games: SeriesGame[]): Promise<SeriesGameSummary[]> {
  return Promise.all(
    games.flatMap(({ gameId, number, state }) => {
      if (state !== "finished" || !gameId) return [];
      return [summarize(gameId, number)];
    }),
  );
}

async function summarize(gameId: string, number: number): Promise<SeriesGameSummary> {
  const queries = data();
  const [game, detail] = await Promise.all([
    queries.game(gameId),
    /^oracle:archive:[a-f0-9]{64}$/.test(gameId) ? queries.historicalGame(gameId) : null,
  ]);
  return {
    number,
    durationSeconds: detail?.context.durationSeconds ?? null,
    teams: (game ? gameTeams(game) : []).map(({ id, entityId, side }) => {
      const stats = detail?.participants.find(
        (row) => row.side === side && row.position === "team",
      )?.statistics;
      return {
        id: entityId ?? id,
        side,
        kills: stats?.combat.kills ?? stats?.combat.teamkills ?? null,
      };
    }),
  };
}
