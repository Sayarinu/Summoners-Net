import { notFound } from "next/navigation";
import { MatchPage } from "../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = await sourceIdFromRoute(params);
  const [record, games] = await Promise.all([data().match(id), data().matchGames(id)]);
  if (!record || !games) notFound();
  const prefs = await preferences();
  return (
    <MatchPage
      match={record}
      games={games}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
