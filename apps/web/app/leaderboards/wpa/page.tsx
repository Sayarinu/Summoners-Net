import { WpaLeaderboardPage } from "../../../src/features/leaderboards/wpa";
import { data } from "../../../src/server/data";
import { loadWpaLeaderboard } from "../../../src/server/wpa-leaderboards";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadWpaLeaderboard(await searchParams);
  const names =
    result.board?.page.items.filter((row) => row.kind === "champion").map((row) => row.name) ?? [];
  return <WpaLeaderboardPage {...result} portraits={await data().championIconsByName(names)} />;
}
