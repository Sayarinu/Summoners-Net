import { PlayerFinder } from "../../src/features/browse/players";
import { data, directoryQuery } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await directoryQuery(searchParams);
  return <PlayerFinder data={await data().playerDirectory(query)} query={query} />;
}
