import { notFound } from "next/navigation";
import { GamePage } from "../../../src/features/details/pages";
import { data, preferences, sourceIdFromRoute } from "../../../src/server/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = await sourceIdFromRoute(params);
  const record = await data().game(id);
  if (!record) notFound();
  const prefs = await preferences();
  return (
    <GamePage
      game={record}
      timezone={prefs.timezone}
      hideSpoilers={prefs.hideSpoilers}
      winProbability={await data().proGameWinProbability(id)}
    />
  );
}
