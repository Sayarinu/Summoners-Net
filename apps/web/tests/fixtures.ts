import type { Game, Identity, Match, Profile, SyncStatus, Page } from "@esportsviewer/data";
export const instant = "2026-03-01T12:00:00.000Z";
export const blue: Identity = {
  id: "oracle:team:10",
  source: "oracle",
  sourceId: "10",
  kind: "team",
  name: "Acceptance Blue",
  country: null,
  imageUrl: null,
  role: null,
};
export const red: Identity = {
  ...blue,
  id: "oracle:team:11",
  sourceId: "11",
  name: "Acceptance Red",
};
export const player: Identity = {
  ...blue,
  id: "oracle:player:10-mid",
  sourceId: "10-mid",
  kind: "player",
  name: "Player Blue mid",
  role: "mid",
};
export const match: Match = {
  id: "pandascore:match:1",
  sourceId: "1",
  name: "Acceptance Blue vs Acceptance Red",
  league: "LCK",
  event: "LCK Spring",
  startsAt: "2026-03-01T01:00:00.000Z",
  state: "final",
  bestOf: 3,
  teams: [
    { ...blue, score: 2 },
    { ...red, score: 1 },
  ],
  broadcasts: [
    {
      provider: "youtube",
      externalId: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      language: "en",
    },
    {
      provider: "twitch",
      externalId: "test_channel",
      url: "https://www.twitch.tv/test_channel",
      language: "ko",
    },
  ],
  games: [
    {
      sourceId: "100",
      number: 1,
      state: "finished",
      startsAt: instant,
      finishedAt: instant,
      winnerId: blue.id,
    },
  ],
  updatedAt: instant,
};
export const game: Game = {
  id: "oracle:game:acceptance-game",
  sourceId: "acceptance-game",
  matchId: null,
  league: "LCK",
  event: "LCK Spring 2026",
  year: 2026,
  occurredAt: "2026-03-01T01:00:00.000Z",
  number: 1,
  patch: "16.4",
  complete: true,
  participants: [
    {
      slot: "blue:mid",
      side: "blue",
      role: "mid",
      team: blue,
      player,
      champion: "Ahri",
      won: true,
      kills: 5,
      deaths: 2,
      assists: 7,
    },
    {
      slot: "red:mid",
      side: "red",
      role: "mid",
      team: red,
      player: { ...player, id: "oracle:player:11-mid", name: "Player Red mid" },
      champion: null,
      won: null,
      kills: null,
      deaths: null,
      assists: null,
    },
  ],
};
export function page<T>(items: T[]): Page<T> {
  return { items, page: 1, pageSize: 25, total: items.length };
}
export const profile: Profile = {
  identity: player,
  summary: {
    eligibleGames: 2,
    resultGames: 1,
    wins: 1,
    winRate: 1,
    kda: 6,
    kdaGames: 1,
    champions: [{ name: "Ahri", games: 1, wins: 1, resultGames: 1 }],
  },
  games: page([game]),
  roster: [{ team: blue, player, observedAt: instant }],
};
export const status: SyncStatus = {
  sources: [
    {
      source: "pandascore",
      lastSuccess: instant,
      lastAttempt: instant,
      records: 2,
      error: null,
    },
    {
      source: "oracle",
      lastSuccess: null,
      lastAttempt: instant,
      records: 0,
      error: "Archive quota",
    },
    {
      source: "ddragon",
      lastSuccess: null,
      lastAttempt: null,
      records: 0,
      error: null,
    },
  ],
  jobs: [
    {
      id: "1",
      kind: "history:2014",
      state: "failed",
      error: "Archive quota",
      requestedAt: instant,
    },
    {
      id: "2",
      kind: "running",
      state: "queued",
      error: null,
      requestedAt: instant,
    },
  ],
  pandaRequests: 10,
  cooldownUntil: null,
  history: [{ year: 2026, games: 1, eligible: 1, latestGameAt: instant }],
};
