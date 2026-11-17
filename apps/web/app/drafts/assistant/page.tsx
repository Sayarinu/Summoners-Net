import { DraftAssistantPage } from "../../../src/features/drafts/assistant";
import { loadDraftAssistant } from "../../../src/server/drafts";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DraftAssistantPage {...await loadDraftAssistant(await searchParams)} />;
}
