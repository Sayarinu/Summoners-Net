import { notFound, redirect } from "next/navigation";
import { seriesHref, seriesRouteId } from "../../../src/features/browse/presentation";
import { MatchPage } from "../../../src/features/details/pages";
import { data, matchIdFromRouteId, preferences, sourceIdFromRoute } from "../../../src/server/data";
import { seriesSummaries } from "../../../src/server/series-summary";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const routeId = await sourceIdFromRoute(params);
  const id = matchIdFromRouteId(routeId);
  const [record, games] = await Promise.all([data().match(id), data().matchGames(id)]);
  if (!record || !games) notFound();
  if (routeId !== seriesRouteId(record.id)) redirect(seriesHref(record));
  const [prefs, summaries] = await Promise.all([
    preferences(),
    record.state === "final" ? seriesSummaries(games) : [],
  ]);
  return (
    <MatchPage
      match={record}
      games={games}
      summaries={summaries}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
