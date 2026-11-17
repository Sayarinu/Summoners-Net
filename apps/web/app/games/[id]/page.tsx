import { gameReplayUrl, recordingUrl } from "@summonersnet/data/contracts";
import { notFound } from "next/navigation";
import { GamePage } from "../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = await sourceIdFromRoute(params);
  const record = await data().game(id);
  if (!record) notFound();
  const prefs = await preferences();
  const [winProbability, series, portraits, detail] = await Promise.all([
    data().proGameWinProbability(id),
    data().gameSeries(record.id),
    data().championIconsByName(
      record.participants.map((participant) => participant.champion),
      record.patch,
    ),
    /^oracle:archive:[a-f0-9]{64}$/.test(record.id) ? data().historicalGame(record.id) : null,
  ]);
  const match = series ? await data().match(series.matchId) : null;
  const game = match?.games.find((item) => item.number === series?.number);
  const vodUrl =
    (match && game ? gameReplayUrl(match, game) : null) ?? recordingUrl(detail?.context.sourceUrl);
  return (
    <GamePage
      game={record}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      winProbability={winProbability}
      series={series}
      portraits={portraits}
      vodUrl={vodUrl}
    />
  );
}
