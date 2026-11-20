import { TierListPage } from "../../src/features/champions/tier-list";
import { loadTierList } from "../../src/server/champions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TierListPage {...await loadTierList(await searchParams)} />;
}
