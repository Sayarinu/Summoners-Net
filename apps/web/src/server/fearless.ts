import "server-only";
import type { Match, SeriesGame } from "@summonersnet/data";
import { data } from "./data";
import type { FearlessGame } from "../features/details/draft";

// Riot introduced Fearless Draft for Worlds 2025 series and retained the 2025 format
// for the 2026 Swiss and Knockout stages.
// https://lolesports.com/en-SG/news/fearless-draft-takes-over-2025
// https://lolesports.com/en-US/lolesports/news/msi-and-worlds-updates
export async function previousFearlessPicks(
  match: Match,
  games: SeriesGame[],
  number: number,
): Promise<FearlessGame[]> {
  const year = match.startsAt?.slice(0, 4);
  const documentedFormat =
    match.league === "Worlds" &&
    match.bestOf > 1 &&
    (year === "2025" || (year === "2026" && /swiss|playoffs?|knockouts?/i.test(match.event)));
  if (!documentedFormat || number < 2) return [];

  const earlier = games
    .filter((game) => game.number < number && game.state === "finished")
    .sort((first, second) => first.number - second.number);
  if (earlier.length !== number - 1 || earlier.some((game, index) => game.number !== index + 1))
    return [];
  const picks = await Promise.all(
    earlier.map(async (game) => {
      const archive = game.gameId ? await data().game(game.gameId) : null;
      const champions = (archive?.participants ?? []).flatMap((player) =>
        player.player && player.champion ? [player.champion] : [],
      );
      return { number: game.number, champions };
    }),
  );
  const all = picks.flatMap(({ champions }) => champions);
  return picks.every(({ champions }) => champions.length === 10) && new Set(all).size === all.length
    ? picks
    : [];
}
