import { TeamFinder } from "../../src/features/teams/pages";
import { data, directoryQuery } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await directoryQuery(searchParams);
  return <TeamFinder data={await data().teamDirectory(query)} query={query} />;
}
