import { MatchesPage } from "../src/features/browse/pages";
import { browseQuery, data, preferences } from "../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await browseQuery(searchParams);
  const [matches, prefs] = await Promise.all([data().matches(query), preferences()]);
  return (
    <MatchesPage
      data={matches}
      query={query}
      hideSpoilers={prefs.hideSpoilers}
      now={new Date().toISOString()}
    />
  );
}
