import { PastMatchesPage } from "../../src/features/browse/pages";
import { browseQuery, data, preferences } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "games" ? "games" : "series";
  const query = await browseQuery(Promise.resolve(params));
  const prefs = await preferences();
  return view === "games" ? (
    <PastMatchesPage
      view="games"
      games={await data().games(query)}
      query={query}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  ) : (
    <PastMatchesPage
      view="series"
      series={await data().matches({ ...query, state: "final" })}
      query={query}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
