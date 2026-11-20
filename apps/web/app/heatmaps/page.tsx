import { notFound } from "next/navigation";
import { HeatmapPage } from "../../src/features/heatmaps/page";
import { loadHeatmap } from "../../src/server/heatmaps";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadHeatmap(await searchParams);
  if (!result) notFound();
  return <HeatmapPage {...result} />;
}
