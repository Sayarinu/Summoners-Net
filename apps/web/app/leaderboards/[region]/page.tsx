import { notFound } from "next/navigation";
import { LeaderboardPage } from "../../../src/features/leaderboards/page";
import { loadLeaderboard } from "../../../src/server/leaderboards";
import { preferences } from "../../../src/server/data";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { region } = await params;
  const result = await loadLeaderboard(region, await searchParams);
  if (!result) notFound();
  return <LeaderboardPage {...result} region={region} timezone={(await preferences()).timezone} />;
}
