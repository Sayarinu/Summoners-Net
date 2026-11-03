import { describe, expect, it } from "vitest";
import { coveredLeague, sourceIdentity } from "../domain/coverage.js";
import { querySchema, syncRequestSchema } from "../domain/models.js";
import { summarize } from "../domain/statistics.js";
import { parseBroadcast, parseMatches, parseTeams } from "./pandascore.js";
import { parseHistory, archiveDownload } from "./oracle.js";
import { parseVersions, parseMetadata } from "./ddragon.js";
import { historyCsv, rawMatch, now } from "../../tests/fixtures.js";
describe("coverage and validated public inputs", () => {
  it("covers predecessors without admitting academy or post-merger tier two", () => {
    for (const name of ["OGN", "Champions", "LCK"]) expect(coveredLeague(name, 2014)).toBe("LCK");
    for (const name of ["EU LCS", "LEC"]) expect(coveredLeague(name)).toBe("LEC");
    for (const name of ["NA LCS", "LTA North", "LTA N", "LTA"])
      expect(coveredLeague(name)).toBe("LCS");
    for (const name of ["PCS", "VCS", "LJL", "LCO", "OPL"]) {
      expect(coveredLeague(name, 2024)).toBe("LCP");
      expect(coveredLeague(name, 2025)).toBeNull();
    }
    for (const name of ["LMS", "GPL", "LCP", "League of Legends Championship Pacific"])
      expect(coveredLeague(name, 2024)).toBe("LCP");
    for (const name of ["LCK CL", "LCKC", "LTA S", "NACL", "LCSA", "LDL", "EM", "unknown"])
      expect(coveredLeague(name)).toBeNull();
    expect(coveredLeague("WLDs")).toBe("Worlds");
    expect(coveredLeague("League of Legends Champions Korea")).toBe("LCK");
    expect(coveredLeague("League of Legends Pro League")).toBe("LPL");
    expect(coveredLeague("League of Legends EMEA Championship")).toBe("LEC");
    expect(sourceIdentity("oracle", "team", " 10 ", "x")).toBe("oracle:team:10");
    expect(sourceIdentity("oracle", "player", undefined, "a")).not.toBe(
      sourceIdentity("oracle", "player", undefined, "b"),
    );
  });
  it("bounds pages, rejects impossible dates, timezones and sync payload fields", () => {
    expect(querySchema.parse({ page: "2", year: "2024" })).toMatchObject({
      page: 2,
      year: 2024,
      pageSize: 25,
      timezone: "UTC",
    });
    for (const input of [
      { page: 0 },
      { pageSize: 51 },
      { date: "2026-02-30" },
      { timezone: "bad" },
      { timezone: "+01:00" },
      { year: 2013 },
      { q: "x".repeat(101) },
    ])
      expect(querySchema.safeParse(input).success).toBe(false);
    expect(
      syncRequestSchema.safeParse({
        kind: "history",
        year: 2024,
        file: "a.csv",
      }).success,
    ).toBe(true);
    expect(syncRequestSchema.safeParse({ kind: "running", token: "no" }).success).toBe(false);
  });
});
describe("PandaScore free context", () => {
  it("maps source IDs and missing results without inventing outcomes", () => {
    const match = parseMatches([rawMatch()], now)[0]!;
    expect(match).toMatchObject({
      sourceId: "1",
      state: "final",
      teams: [{ score: 2 }, { score: 1 }],
    });
    expect(parseMatches([rawMatch(2, { league: { id: 5, name: "LCK CL" } })], now)).toEqual([]);
    for (const [status, state] of Object.entries({
      not_started: "scheduled",
      running: "live",
      postponed: "postponed",
      canceled: "cancelled",
      unexpected: "unknown",
    }))
      expect(parseMatches([rawMatch(2, { status })], now)[0]!.state).toBe(state);
    expect(
      parseMatches(
        [
          rawMatch(3, {
            begin_at: null,
            number_of_games: null,
            serie: null,
            results: undefined,
            opponents: [{ opponent: { id: 5, name: null, slug: "unknown" } }],
          }),
        ],
        now,
      )[0],
    ).toMatchObject({
      startsAt: null,
      bestOf: 1,
      teams: [{ name: "unknown", score: null }],
    });
    expect(
      parseMatches(
        [
          rawMatch(3, {
            serie: { name: "Spring" },
            streams_list: [{ raw_url: "http://bad" }],
          }),
        ],
        now,
      )[0]!.broadcasts,
    ).toEqual([]);
    expect(() => parseMatches([{ id: "bad" }], now)).toThrow();
  });
  it("only accepts HTTPS broadcast hosts and safe embed identifiers", () => {
    for (const url of [
      "garbage",
      "http://twitch.tv/a",
      "https://evil.test",
      "https://user:password@twitch.tv/test",
    ])
      expect(parseBroadcast(url)).toBeNull();
    expect(parseBroadcast("https://twitch.tv/videos/123")).toMatchObject({
      externalId: "v123",
    });
    expect(parseBroadcast("https://twitch.tv/test_channel")).toMatchObject({
      externalId: "test_channel",
    });
    expect(parseBroadcast("https://twitch.tv/directory")).toMatchObject({
      provider: "twitch",
    });
    expect(parseBroadcast("https://twitch.tv/a/b")).toMatchObject({
      externalId: "",
    });
    for (const url of [
      "https://youtu.be/abcdefghijk",
      "https://www.youtube.com/live/abcdefghijk",
      "https://youtube.com/watch?v=abcdefghijk",
    ])
      expect(parseBroadcast(url)).toMatchObject({ externalId: "abcdefghijk" });
    expect(parseBroadcast("https://youtube.com/@lolesports")).toMatchObject({
      externalId: "",
    });
  });
  it("separates roster identity from names and preserves empty observations", () => {
    expect(
      parseTeams([
        {
          id: 1,
          name: "Same",
          players: [
            {
              id: 2,
              name: "Same",
              role: "mid",
              nationality: "KR",
              image_url: "https://example.org/a.png",
            },
          ],
        },
        { id: 3, name: null, players: [] },
        { id: 4, name: " Padded ", players: [{ id: 5, name: "   ", slug: "blank-name" }] },
      ]),
    ).toMatchObject([
      {
        team: { id: "pandascore:team:1" },
        players: [{ id: "pandascore:player:2", role: "mid" }],
      },
      { team: { name: "Unknown team 3" }, players: [] },
      { team: { name: "Padded" }, players: [{ name: "blank-name" }] },
    ]);
  });
});
describe("annual Oracle game records", () => {
  it("accepts BOM, role aliases, blanks and observation IDs", () => {
    const game = parseHistory("\ufeff" + historyCsv(), 2026)[0]!;
    expect(game.complete).toBe(true);
    expect(game.participants).toHaveLength(12);
    expect(game.participants[1]!.role).toBe("jungle");
    expect(game.matchId).toBeNull();
    const without = parseHistory(historyCsv({ omitIds: true, kills: "" }), 2026)[0]!;
    expect(without.participants[0]).toMatchObject({
      kills: null,
      team: { sourceId: "observation:acceptance-game:blue" },
    });
    expect(
      parseHistory(historyCsv().replaceAll("Blue", "100").replaceAll("Red", "200"), 2026)[0]!
        .complete,
    ).toBe(true);
    expect(parseHistory(historyCsv({ league: "WLDs", year: 2022 }), 2022)[0]!.league).toBe(
      "Worlds",
    );
  });
  it("deduplicates identical rows, excludes partial games and filters out-of-scope rows", () => {
    const csv = historyCsv();
    expect(parseHistory(csv + csv.split("\n")[1] + "\n", 2026)[0]!.participants).toHaveLength(12);
    expect(parseHistory(historyCsv({ completeness: "partial" }), 2026)[0]!.complete).toBe(false);
    expect(parseHistory(csv.split("\n").slice(0, -3).join("\n"), 2026)[0]!.complete).toBe(false);
    expect(
      parseHistory(csv + historyCsv({ league: "LCKC" }).split("\n").slice(1).join("\n"), 2026),
    ).toHaveLength(1);
  });
  it("rejects malformed/summary/quota files and conflicting corrections within a file", () => {
    for (const csv of [
      "<!doctype html>quota exceeded",
      "name,wins\nOne,1",
      "",
      historyCsv({ league: "NACL" }),
      historyCsv({ kills: "-1" }),
      historyCsv({ kills: "1.2" }),
      historyCsv({ kills: "abc" }),
      historyCsv().replaceAll("2026-03-01", "2025-03-01"),
      historyCsv().replaceAll(",Blue,", ",Green,"),
      historyCsv().replaceAll(",top,", ",coach,"),
      historyCsv().replaceAll(",1,5,", ",3,5,"),
      historyCsv().replaceAll("acceptance-game,", ","),
      historyCsv() + historyCsv({ kills: "6" }).split("\n").slice(1).join("\n"),
      historyCsv()
        .replace(",Red,", ",Red,")
        .replace("2026-03-01 01:00:00,sup", "2026-03-02 01:00:00,sup"),
    ])
      expect(() => parseHistory(csv, 2026)).toThrow();
    expect(() => parseHistory(historyCsv(), 2013)).toThrow();
    expect(archiveDownload(2014)).toContain("drive.google.com");
    expect(() => archiveDownload(2099)).toThrow();
  });
  it("computes explicit statistical denominators and null KDA", () => {
    const game = parseHistory(historyCsv(), 2026)[0]!;
    const id = game.participants[0]!.player!.id;
    expect(summarize([game], "player", id)).toMatchObject({
      eligibleGames: 1,
      wins: 1,
      resultGames: 1,
      winRate: 1,
      kda: 6,
      kdaGames: 1,
      champions: [{ name: "Ahri", games: 1, wins: 1, resultGames: 1 }],
    });
    expect(summarize([game], "team", game.participants[0]!.team.id).eligibleGames).toBe(1);
    const missing = structuredClone(game);
    missing.participants[0]!.won = null;
    missing.participants[0]!.deaths = 0;
    expect(summarize([missing], "player", id)).toMatchObject({
      winRate: null,
      kda: null,
      resultGames: 0,
    });
    missing.participants[0]!.kills = null;
    expect(summarize([missing, { ...game, complete: false }], "player", id).kdaGames).toBe(0);
    expect(summarize([game], "player", "absent").eligibleGames).toBe(0);
    const loss = structuredClone(game);
    loss.participants[0]!.won = false;
    loss.participants[0]!.champion = "Zed";
    expect(summarize([game, loss, game], "player", id).champions.map((c) => c.games)).toEqual([
      2, 1,
    ]);
  });
});
it("validates Data Dragon but tolerates its historical non-version archive labels", () => {
  expect(parseVersions(["16.4.1", "lolpatch_7.20"])).toEqual(["16.4.1"]);
  expect(() => parseVersions([])).toThrow();
  expect(
    parseMetadata(
      {
        version: "16.4.1",
        data: { Ahri: { name: "Ahri", image: { full: "Ahri.png" } } },
      },
      "16.4.1",
      "champion",
    ),
  ).toEqual({
    Ahri: {
      name: "Ahri",
      image: "https://ddragon.leagueoflegends.com/cdn/16.4.1/img/champion/Ahri.png",
    },
  });
  expect(parseMetadata({ data: {} }, "16.4.1", "item")).toEqual({});
  expect(() => parseMetadata({ version: "1", data: {} }, "2", "item")).toThrow();
  expect(() =>
    parseMetadata({ data: { a: { name: "a", image: { full: "../a.png" } } } }, "1", "item"),
  ).toThrow();
});
