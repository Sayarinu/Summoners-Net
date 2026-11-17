import { data } from "../../../src/server/data";
import { notFound } from "next/navigation";
import { SoloGamePage } from "../../../src/features/solo-games/page";
import { loadSoloDraftWinProbability, loadSoloGame } from "../../../src/server/solo-games";

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const id = decodeURIComponent((await params).matchId);
  const [game, draft] = await Promise.all([loadSoloGame(id), loadSoloDraftWinProbability(id)]);
  if (!game) notFound();
  const portraits = await data().championIconsByName(
    game.participants.map((row) => row.championName),
    game.patch,
  );
  return <SoloGamePage game={game} portraits={portraits} draft={draft} />;
}
