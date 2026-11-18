import { notFound, redirect } from "next/navigation";
import { seriesGameHref, seriesRouteId } from "../../../../../src/features/browse/presentation";
import { SeriesGamePage } from "../../../../../src/features/details/pages";
import {
  data,
  matchIdFromRouteId,
  preferences,
  sourceIdFromRoute,
} from "../../../../../src/server/data";
import { previousFearlessPicks } from "../../../../../src/server/fearless";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = /^[1-9]$/.test(rawNumber) ? Number(rawNumber) : null;
  if (number === null) notFound();
  const routeId = await sourceIdFromRoute(params);
  const id = matchIdFromRouteId(routeId);
  const [record, games] = await Promise.all([data().match(id), data().matchGames(id)]);
  const game = games?.find((g) => g.number === number);
  if (!record || !games || !game || !["finished", "running"].includes(game.state)) notFound();
  if (routeId !== seriesRouteId(record.id)) redirect(seriesGameHref(record, number));
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
  const fearless = detail ? await previousFearlessPicks(record, games, number) : [];
  const [prefs, portraits] = await Promise.all([
    preferences(),
    data().championIconsByName(
      [
        ...(archive?.participants.map((participant) => participant.champion) ?? []),
        ...(detail?.draft.flatMap(({ picks, bans }) => [...picks, ...bans]) ?? []),
        ...fearless,
      ],
      archive?.patch,
    ),
  ]);
  return (
    <SeriesGamePage
      match={record}
      games={games}
      number={number}
      game={archive}
      detail={detail}
      portraits={portraits}
      fearless={fearless}
      winProbability={winProbability}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
