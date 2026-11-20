import { ProFeedPage } from "../../../src/features/leaderboards/pros";
import { loadProFeed } from "../../../src/server/pro-feed";
import { preferences } from "../../../src/server/data";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ProFeedPage
      {...await loadProFeed(await searchParams)}
      timezone={(await preferences()).timezone}
    />
  );
}
