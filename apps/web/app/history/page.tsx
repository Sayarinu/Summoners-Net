import { HistoryPage } from "../../src/features/browse/pages";
import { browseQuery, data } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await browseQuery(searchParams);
  return <HistoryPage data={await data().games(query)} query={query} />;
}
