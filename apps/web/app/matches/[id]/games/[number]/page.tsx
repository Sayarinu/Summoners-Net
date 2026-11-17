import { notFound } from "next/navigation";
import { SeriesGamePage } from "../../../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../../../src/server/data";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = /^[1-9]$/.test(rawNumber) ? Number(rawNumber) : null;
  if (number === null) notFound();
  const id = await sourceIdFromRoute(params);
  const [record, games] = await Promise.all([data().match(id), data().matchGames(id)]);
  const game = games?.find((g) => g.number === number);
  if (!record || !games || !game || !["finished", "running"].includes(game.state)) notFound();
  const [archive, detail, winProbability] = game.gameId
    ? await Promise.all([
        data().game(game.gameId),
        // Only Oracle archive games carry the draft.
        /^oracle:archive:[a-f0-9]{64}$/.test(game.gameId)
          ? data().historicalGame(game.gameId)
          : null,
        data().proGameWinProbability(game.gameId),
      ])
    : [null, null, null];
  const prefs = await preferences();
  return (
    <SeriesGamePage
      match={record}
      games={games}
      number={number}
      game={archive}
      detail={detail}
      winProbability={winProbability}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
