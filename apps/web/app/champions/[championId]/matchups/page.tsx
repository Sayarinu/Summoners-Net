import { notFound } from "next/navigation";
import { ChampionMatchupsPage } from "../../../../src/features/matchups/pages";
import { loadChampionMatchups } from "../../../../src/server/matchups";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ championId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadChampionMatchups((await params).championId, await searchParams);
  if (!result) notFound();
  return <ChampionMatchupsPage {...result} />;
}
