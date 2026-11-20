import { PatchComparePage } from "../../../src/features/compare/pages";
import { loadPatchComparison } from "../../../src/server/compare";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();
  return <PatchComparePage {...await loadPatchComparison(params)} search={search} />;
}
