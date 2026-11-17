import { DraftsPage } from "../../src/features/drafts/page";
import { data } from "../../src/server/data";
import { loadDrafts } from "../../src/server/drafts";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadDrafts(await searchParams);
  const names = result.analytics
    ? [...result.analytics.priorities.items, ...result.analytics.roles.items].map(
        (row) => row.champion,
      )
    : [];
  return <DraftsPage {...result} portraits={await data().championIconsByName(names)} />;
}
