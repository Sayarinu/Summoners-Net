import { notFound } from "next/navigation";
import { ChampionOverviewPage } from "../../../src/features/champions/overview";
import { loadChampionOverview } from "../../../src/server/champions";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ championId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadChampionOverview(
    decodeURIComponent((await params).championId),
    await searchParams,
  );
  if (!result) notFound();
  return <ChampionOverviewPage {...result} />;
}
