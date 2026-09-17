import { notFound } from "next/navigation";
import { MatchPage } from "../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const record = await data().match(await sourceIdFromRoute(params));
  if (!record) notFound();
  const prefs = await preferences();
  return (
    <MatchPage
      match={record}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
