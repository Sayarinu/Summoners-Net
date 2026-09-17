import { describe, it, expect } from "vitest";
import {
  nameKey,
  roleKey,
  resolveIdentities,
  type ContextTeam,
  type PlayedSquad,
} from "./resolution.js";
import type { Identity } from "./models.js";
import { parseMatches } from "../providers/pandascore.js";
import { rawMatch, now } from "../../tests/fixtures.js";
const identity = (
  id: string,
  name: string,
  kind: "team" | "player",
  role: string | null = null,
): Identity => ({
  id,
  name,
  kind,
  role,
  source: "pandascore",
  sourceId: id,
  imageUrl: null,
  country: null,
});
const team: ContextTeam = {
  team: identity("pandascore:team:1", "Blue Gaming", "team"),
  observedAt: "2026-03-02T00:00:00Z",
  players: [
    identity("pandascore:player:1", "One", "player", "top"),
    identity("pandascore:player:2", "Two", "player", "jun"),
    identity("pandascore:player:3", "Three", "player", "mid"),
  ],
};
const squad: PlayedSquad = {
  gameId: "game:1",
  teamId: "oracle:team:1",
  playedAt: "2026-03-01T00:00:00Z",
  players: [
    { id: "oracle:player:1", name: "One", role: "top" },
    { id: "oracle:player:2", name: "Two", role: "jungle" },
    { id: "oracle:player:3", name: "Three", role: "mid" },
  ],
};
const aliases = [
  { id: squad.teamId, name: "Blue Gaming" },
  ...squad.players.map((p) => ({ id: p.id, name: p.name })),
];
describe("evidence-based source identity resolution", () => {
  it("requires repeated fixture agreement on separate dates against different opponents", () => {
    const matches = parseMatches(
      [
        rawMatch(1),
        rawMatch(2, {
          begin_at: "2026-03-02T01:00:00Z",
          opponents: [
            { opponent: { id: 10, name: "Acceptance Blue" } },
            { opponent: { id: 21, name: "Acceptance Green" } },
          ],
        }),
      ],
      now,
    );
    const games = [
      {
        gameId: "one",
        playedAt: "2026-03-01T01:00:00Z",
        league: "LCK",
        teams: [
          { id: "oracle:team:10", name: "Acceptance Blue" },
          { id: "oracle:team:20", name: "Acceptance Red" },
        ],
      },
      {
        gameId: "two",
        playedAt: "2026-03-02T01:00:00Z",
        league: "LCK",
        teams: [
          { id: "oracle:team:10", name: "Acceptance Blue" },
          { id: "oracle:team:21", name: "Acceptance Green" },
        ],
      },
    ];
    const resolve = (inputGames = games, inputMatches = matches) =>
      resolveIdentities({
        aliases: [],
        squads: [],
        teams: [],
        games: inputGames,
        matches: inputMatches,
      });
    expect(resolve().links).toMatchObject([
      {
        oracleId: "oracle:team:10",
        pandaId: "pandascore:team:10",
        evidence: { method: "fixtures" },
      },
    ]);
    expect(resolve(games.slice(0, 1)).links).toEqual([]);
    expect(resolve([...games, games[0]!]).links).toEqual([]);
    expect(resolve(games.map((g) => ({ ...g, league: "LPL" }))).links).toEqual([]);
    expect(resolve(games.map((g) => ({ ...g, playedAt: "2020-03-01T00:00:00Z" }))).links).toEqual(
      [],
    );
    expect(
      resolve(
        games,
        matches.map((m) => ({ ...m, startsAt: null })),
      ).links,
    ).toEqual([]);
    expect(
      resolve(
        games,
        matches.map((m) => ({ ...m, state: "scheduled" })),
      ).links,
    ).toEqual([]);
  });
  it("links a uniquely corroborated team and players, recording the actual game and observation", () => {
    const result = resolveIdentities({ teams: [team], squads: [squad], aliases });
    expect(result.links).toHaveLength(4);
    expect(result.links[0]?.evidence).toMatchObject({
      gameId: squad.gameId,
      playedAt: squad.playedAt,
      observedAt: team.observedAt,
    });
    expect(result.ambiguous).toBe(0);
    expect(nameKey(" HANS_SAMA ")).toBe(nameKey("Hans sama"));
    expect(roleKey(null)).toBeUndefined();
  });
  it("never merges names without three co-occurring players, including academy or successor teams", () => {
    expect(
      resolveIdentities({
        teams: [{ ...team, players: team.players.slice(0, 2) }],
        squads: [squad],
        aliases,
      }).links,
    ).toEqual([]);
    expect(
      resolveIdentities({
        teams: [{ ...team, team: { ...team.team, name: "Blue Gaming Academy" } }],
        squads: [squad],
        aliases,
      }).links,
    ).toEqual([]);
    expect(
      resolveIdentities({
        teams: [{ ...team, team: { ...team.team, name: "New Organization" } }],
        squads: [squad],
        aliases,
      }).links,
    ).toEqual([]);
    const split = squad.players.map((p) => ({ ...squad, players: [p] }));
    expect(resolveIdentities({ teams: [team], squads: split, aliases }).links).toEqual([]);
  });
  it("rejects ambiguous team IDs in either direction instead of choosing the best score", () => {
    expect(
      resolveIdentities({
        teams: [team, { ...team, team: { ...team.team, id: "pandascore:team:2" } }],
        squads: [squad],
        aliases,
      }),
    ).toEqual({ links: [], ambiguous: 1 });
    expect(
      resolveIdentities({
        teams: [team],
        squads: [squad, { ...squad, teamId: "oracle:team:2" }],
        aliases: [...aliases, { id: "oracle:team:2", name: "Blue Gaming" }],
      }).links,
    ).toEqual([]);
  });
  it("keeps homonymous players separate even when their teams can be linked", () => {
    const other = {
      ...squad,
      gameId: "game:2",
      players: [
        ...squad.players.slice(0, 2),
        { id: "oracle:player:other", name: "Three", role: "mid" },
      ],
    };
    const result = resolveIdentities({ teams: [team], squads: [squad, other], aliases });
    expect(result.links).toHaveLength(3);
    expect(result.links.some((l) => l.pandaId === "pandascore:player:3")).toBe(false);
    expect(result.ambiguous).toBe(2);
  });
  it("requires known roles and stable IDs, skips unknown names and repeated roles", () => {
    for (const players of [
      squad.players.map((p) => ({ ...p, role: "unknown" })),
      squad.players.map((p) => ({ ...p, id: `oracle:player:observation:${p.id}` })),
      squad.players.map((p) => ({ ...p, role: "top" })),
    ])
      expect(
        resolveIdentities({ teams: [team], squads: [{ ...squad, players }], aliases }).links,
      ).toEqual([]);
    expect(
      resolveIdentities({
        teams: [team],
        squads: [{ ...squad, teamId: "oracle:team:observation:1" }],
        aliases: [
          { id: "oracle:team:observation:1", name: "Blue Gaming" },
          { id: "empty", name: "" },
          { id: "unknown", name: "Unknown" },
        ],
      }).links,
    ).toEqual([]);
    const duplicate = {
      ...team,
      players: [...team.players, { ...team.players[0]!, id: "pandascore:player:duplicate" }],
    };
    expect(resolveIdentities({ teams: [duplicate], squads: [squad], aliases }).links).toEqual([]);
  });
  it("uses observed aliases without losing provenance and chooses the latest supporting game deterministically", () => {
    const renamed = {
      ...team,
      team: { ...team.team, name: "Renamed" },
      players: [{ ...team.players[0]!, name: "New Handle" }, ...team.players.slice(1)],
    };
    const result = resolveIdentities({
      teams: [renamed],
      squads: [squad, { ...squad, gameId: "latest", playedAt: "2026-03-02T00:00:00Z" }],
      aliases: [
        ...aliases,
        { id: team.team.id, name: "Blue Gaming" },
        { id: squad.players[0]!.id, name: "New Handle" },
      ],
    });
    expect(result.links).toHaveLength(4);
    expect(result.links[0]?.evidence.gameId).toBe("latest");
  });
});
it("uses tournament roster evidence only inside its observed competition period", () => {
  const historical = {
    ...team,
    tournamentId: "100",
    playedAfter: "2026-03-01T00:00:00Z",
    playedBefore: "2026-03-05T00:00:00Z",
  };
  expect(
    resolveIdentities({ teams: [historical], squads: [squad], aliases }).links[0]?.evidence
      .tournamentId,
  ).toBe("100");
  expect(
    resolveIdentities({
      teams: [{ ...historical, playedAfter: "2026-03-02T00:00:00Z" }],
      squads: [squad],
      aliases,
    }).links,
  ).toEqual([]);
  expect(
    resolveIdentities({
      teams: [{ ...historical, playedBefore: "2026-02-28T00:00:00Z" }],
      squads: [squad],
      aliases,
    }).links,
  ).toEqual([]);
});
