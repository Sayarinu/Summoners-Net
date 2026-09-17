import { DirectoryPage } from "../../src/features/browse/pages";
import { browseQuery, data } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await browseQuery(searchParams);
  return <DirectoryPage data={await data().directory("team", query)} query={query} kind="team" />;
}
