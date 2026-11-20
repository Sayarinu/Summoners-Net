import { data } from "../../../../src/server/data";
import { notFound } from "next/navigation";
import { GameMapPage } from "../../../../src/features/map/page";
import { loadSoloGameMap } from "../../../../src/server/solo-games";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const map = await loadSoloGameMap(decodeURIComponent((await params).matchId));
  if (!map) notFound();
  const portraits = await data().championIconsByName(
    map.game.participants.map((row) => row.championName),
    map.game.patch,
  );
  return (
    <GameMapPage
      game={map.game}
      portraits={portraits}
      positions={map.positions}
      events={map.events}
      track={map.track}
    />
  );
}
