import { WpaLeaderboardPage } from "../../../src/features/leaderboards/wpa";
import { loadWpaLeaderboard } from "../../../src/server/wpa-leaderboards";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <WpaLeaderboardPage {...await loadWpaLeaderboard(await searchParams)} />;
}
