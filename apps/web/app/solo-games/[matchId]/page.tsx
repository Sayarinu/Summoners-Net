import { notFound } from "next/navigation";
import { SoloGamePage } from "../../../src/features/solo-games/page";
import { loadSoloGame } from "../../../src/server/solo-games";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const game = await loadSoloGame(decodeURIComponent((await params).matchId));
  if (!game) notFound();
  return <SoloGamePage game={game} />;
}
