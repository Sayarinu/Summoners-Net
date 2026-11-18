import "server-only";
import type { Match, SeriesGame } from "@summonersnet/data";
import { roleKey } from "@summonersnet/data/contracts";
import type { FearlessPick } from "../features/details/draft";
import { data } from "./data";

// Riot introduced Fearless Draft for Worlds 2025 series and retained the 2025 format
// for the 2026 Swiss and Knockout stages.
// https://lolesports.com/en-SG/news/fearless-draft-takes-over-2025
// https://lolesports.com/en-US/lolesports/news/msi-and-worlds-updates
export async function previousFearlessPicks(
  match: Match,
  games: SeriesGame[],
  number: number,
): Promise<FearlessPick[] | null> {
  const year = match.startsAt?.slice(0, 4);
  const documentedFormat =
    match.league === "Worlds" &&
    match.bestOf > 1 &&
    (year === "2025" || (year === "2026" && /swiss|playoffs?|knockouts?/i.test(match.event)));
  if (!documentedFormat) return null;
  if (number < 2) return [];

  const earlier = games
    .filter((game) => game.number < number && game.state === "finished")
    .sort((first, second) => first.number - second.number);
  if (earlier.length !== number - 1 || earlier.some((game, index) => game.number !== index + 1))
    return [];
  const picks = await Promise.all(
    earlier.map(async (game) => {
      const archive = game.gameId ? await data().historicalGame(game.gameId) : null;
      const ordered = archive?.draftOrder
        .filter(({ action }) => action === "pick")
        .sort((first, second) => first.slot - second.slot)
        .flatMap(({ champion, role }) => (role ? [{ champion, role }] : []));
      if (ordered?.length === 10) return ordered;
      return (archive?.participants ?? []).flatMap(({ player, champion, position }) => {
        const role = roleKey(position);
        return player && champion && role ? [{ champion, role }] : [];
      });
    }),
  );
  const all = picks.flat();
  return picks.every(
    (entries) =>
      entries.length === 10 &&
      entries.every(({ role }) => entries.filter((pick) => pick.role === role).length === 2),
  ) && new Set(all.map(({ champion }) => champion)).size === all.length
    ? all
    : [];
}
