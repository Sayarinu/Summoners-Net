import { TeamFinder } from "../../src/features/teams/pages";
import { browseQuery, data } from "../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const query = await browseQuery(
    Promise.resolve({ ...filters, pageSize: filters.pageSize || "24" }),
  );
  return <TeamFinder data={await data().teamDirectory(query)} query={query} />;
}
