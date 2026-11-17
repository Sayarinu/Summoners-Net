import { notFound } from "next/navigation";
import { GameMapPage } from "../../../../src/features/map/page";
import { loadSoloGameMap } from "../../../../src/server/solo-games";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const map = await loadSoloGameMap(decodeURIComponent((await params).matchId));
  if (!map) notFound();
  return (
    <GameMapPage game={map.game} positions={map.positions} events={map.events} track={map.track} />
  );
}
