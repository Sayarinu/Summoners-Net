import { gameReplayUrl, recordingUrl } from "@summonersnet/data/contracts";
import { notFound } from "next/navigation";
import { GamePage } from "../../../src/features/details/pages";
import { seriesRound } from "../../../src/features/browse/presentation";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
import { proItemIcons } from "../../../src/server/pro-items";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = await sourceIdFromRoute(params);
  const record = await data().game(id);
  if (!record) notFound();
  const prefs = await preferences();
  const [winProbability, series, detail, archiveVod] = await Promise.all([
    data().proGameWinProbability(id),
    data().gameSeries(record.id),
    /^oracle:archive:[a-f0-9]{64}$/.test(record.id) ? data().historicalGame(record.id) : null,
    data().gameVod(record.id),
  ]);
  const [match, portraits, items] = await Promise.all([
    series ? data().match(series.matchId) : null,
    data().championIconsByName(
      [
        ...record.participants.map((participant) => participant.champion),
        ...(detail?.draft.flatMap(({ picks, bans }) => [...picks, ...bans]) ?? []),
      ],
      record.patch,
    ),
    proItemIcons(detail),
  ]);
  const game = match?.games.find((item) => item.number === series?.number);
  const vodUrl =
    (match && game ? gameReplayUrl(match, { ...game, gameVodUrl: archiveVod }) : null) ??
    recordingUrl(archiveVod) ??
    recordingUrl(detail?.context.sourceUrl);
  return (
    <GamePage
      game={record}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      winProbability={winProbability}
      series={series}
      detail={detail}
      portraits={portraits}
      items={items}
      vodUrl={vodUrl}
      round={match ? seriesRound(match) : null}
    />
  );
}
