import { SearchPage } from "../../src/features/browse/pages";
import { browseQuery, data } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await browseQuery(searchParams);
  return <SearchPage data={await data().search(query)} query={query} />;
}
