import { notFound } from "next/navigation";
import { SummonerPage } from "../../../src/features/summoners/page";
import { loadSummoner } from "../../../src/server/summoners";
import { data, preferences } from "../../../src/server/data";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ puuid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { puuid } = await params;
  const result = await loadSummoner(puuid, await searchParams);
  if (!result) notFound();
  const [prefs, portraits] = await Promise.all([
    preferences(),
    data().championIconsByName(result.profile?.games.items.map((row) => row.championName) ?? []),
  ]);
  return <SummonerPage {...result} puuid={puuid} timezone={prefs.timezone} portraits={portraits} />;
}
