import { DraftsPage } from "../../src/features/drafts/page";
import { loadDrafts } from "../../src/server/drafts";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DraftsPage {...await loadDrafts(await searchParams)} />;
}
