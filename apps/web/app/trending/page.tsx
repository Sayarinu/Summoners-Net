import { TrendingPage } from "../../src/features/champions/trending";
import { loadTrending } from "../../src/server/trending";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TrendingPage {...await loadTrending(await searchParams)} />;
}
