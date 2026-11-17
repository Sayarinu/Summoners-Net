import { notFound } from "next/navigation";
import { MatchupMatrixPage } from "../../../src/features/matchups/pages";
import { loadMatchupMatrix } from "../../../src/server/matchups";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadMatchupMatrix((await params).role, await searchParams);
  if (!result) notFound();
  return <MatchupMatrixPage {...result} />;
}
