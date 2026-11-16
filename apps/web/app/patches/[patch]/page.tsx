import { notFound } from "next/navigation";
import { PatchOverviewPage } from "../../../src/features/patches/overview";
import { loadPatchOverview } from "../../../src/server/patches";
export default async function Page({ params }: { params: Promise<{ patch: string }> }) {
  const overview = await loadPatchOverview((await params).patch);
  if (!overview) notFound();
  return <PatchOverviewPage overview={overview} />;
}
