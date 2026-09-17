export const now = new Date("2026-03-01T12:00:00Z");
export function rawMatch(id = 1, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Acceptance Blue vs Acceptance Red",
    begin_at: "2026-03-01T01:00:00Z",
    status: "finished",
    number_of_games: 3,
    league: { id: 1, name: "LCK" },
    serie: { full_name: "LCK 2026" },
    tournament: { name: "Spring" },
    opponents: [
      { opponent: { id: 10, name: "Acceptance Blue" } },
      { opponent: { id: 20, name: "Acceptance Red" } },
    ],
    results: [
      { team_id: 10, score: 2 },
      { team_id: 20, score: 1 },
    ],
    streams_list: [
      {
        raw_url: "https://www.youtube.com/watch?v=abcdefghijk",
        language: "en",
      },
      { raw_url: "https://twitch.tv/test_channel", language: "ko" },
    ],
    ...overrides,
  };
}
export function historyCsv({
  id = "acceptance-game",
  league = "LCK",
  year = 2026,
  kills = "5",
  omitIds = false,
  completeness = "complete",
} = {}) {
  const fields = [
    "gameid",
    "league",
    "date",
    "position",
    "side",
    "teamid",
    "teamname",
    "playerid",
    "playername",
    "result",
    "kills",
    "deaths",
    "assists",
    "champion",
    "game",
    "patch",
    "datacompleteness",
  ];
  const rows = [];
  for (const [i, side] of ["Blue", "Red"].entries())
    for (const role of ["top", "jng", "mid", "bot", "sup", "team"]) {
      const teamId = String(i + 10);
      rows.push(
        [
          id,
          league,
          `${year}-03-01 01:00:00`,
          role,
          side,
          omitIds ? "" : teamId,
          `Acceptance ${side}`,
          role === "team" || omitIds ? "" : `${teamId}-${role}`,
          role === "team" ? "" : `Player ${side} ${role}`,
          i === 0 ? "1" : "0",
          kills,
          "2",
          "7",
          role === "team" ? "" : "Ahri",
          "1",
          "16.4",
          completeness,
        ].join(","),
      );
    }
  return fields.join(",") + "\n" + rows.join("\n") + "\n";
}
