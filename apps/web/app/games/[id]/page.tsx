import { notFound } from "next/navigation";
import { GamePage } from "../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const record = await data().game(await sourceIdFromRoute(params));
  if (!record) notFound();
  const prefs = await preferences();
  return <GamePage game={record} timezone={prefs.timezone} hideSpoilers={prefs.hideSpoilers} />;
}
