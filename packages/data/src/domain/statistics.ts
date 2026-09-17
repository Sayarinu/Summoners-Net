import type { Game, Summary } from "./models.js";
export function summarize(games: readonly Game[], kind: "team" | "player", id: string): Summary {
  let eligibleGames = 0,
    resultGames = 0,
    wins = 0,
    kills = 0,
    deaths = 0,
    assists = 0,
    kdaGames = 0;
  const champions = new Map<
    string,
    { name: string; games: number; wins: number; resultGames: number }
  >();
  for (const game of games) {
    if (!game.complete) continue;
    const played = game.participants.filter((p) =>
      kind === "player" ? p.player?.id === id : p.team.id === id,
    );
    if (!played.length) continue;
    eligibleGames++;
    const row = kind === "player" ? played[0] : played.find((p) => p.role === "team");
    if (row) {
      if (row.won !== null) {
        resultGames++;
        if (row.won) wins++;
      }
      if (row.kills !== null && row.deaths !== null && row.assists !== null) {
        kdaGames++;
        kills += row.kills;
        deaths += row.deaths;
        assists += row.assists;
      }
    }
    const picks = new Map(
      played.filter((p) => p.role !== "team" && p.champion).map((p) => [p.champion!, p]),
    );
    for (const [name, pick] of picks) {
      const item = champions.get(name) ?? { name, games: 0, wins: 0, resultGames: 0 };
      item.games++;
      if (pick.won !== null) {
        item.resultGames++;
        if (pick.won) item.wins++;
      }
      champions.set(name, item);
    }
  }
  return {
    eligibleGames,
    resultGames,
    wins,
    winRate: resultGames ? wins / resultGames : null,
    kda: deaths ? (kills + assists) / deaths : null,
    kdaGames,
    champions: [...champions.values()].sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name),
    ),
  };
}
