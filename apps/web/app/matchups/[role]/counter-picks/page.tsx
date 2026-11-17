import { notFound } from "next/navigation";
import { CounterPickListPage } from "../../../../src/features/matchups/pages";
import { loadCounterPickList } from "../../../../src/server/matchups";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadCounterPickList((await params).role, await searchParams);
  if (!result) notFound();
  return <CounterPickListPage {...result} />;
}
