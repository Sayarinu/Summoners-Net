import { describe, expect, it } from "vitest";
import { mergeOracleTeams, teamNameKey, type TeamLineup } from "./team-merges.js";

const roles = ["top", "jng", "mid", "bot", "sup"];
let game = 0;
function lineup(
  teamId: string,
  teamName: string,
  playedAt: string,
  players: string[],
  league = "LCK",
): TeamLineup {
  game++;
  return {
    gameId: `g${game}`,
    teamId,
    teamName,
    league,
    playedAt,
    players: players.map((name, i) => ({ id: `oracle:player:${name}`, name, role: roles[i]! })),
  };
}
const kt = ["PerfecT", "Cuzz", "Bdd", "Aiming", "Effort"];
const stable = "oracle:team:oe:team:kt";
const obs = (n: number) => `oracle:team:observation:oracle:archive:${n}:blue`;

describe("teamNameKey", () => {
  it("ignores case, punctuation and generic leading or trailing words", () => {
    expect(teamNameKey("Lyon Gaming")).toBe(teamNameKey("LYON"));
    expect(teamNameKey("FURIA Esports")).toBe("furia");
    expect(teamNameKey("Team Heretics")).toBe("heretics");
    expect(teamNameKey("T1")).not.toBe(teamNameKey("T1 Academy"));
    expect(teamNameKey("Team")).toBe("team");
  });
});

describe("mergeOracleTeams", () => {
  it("joins games without a team ID to the stable team their lineup corroborates", () => {
    const { merges, ambiguous } = mergeOracleTeams([
      lineup(stable, "KT Rolster", "2026-02-01T10:00:00Z", kt),
      lineup(obs(1), "KT Rolster", "2026-03-01T10:00:00Z", kt),
      lineup(obs(2), "KT Rolster", "2026-03-08T10:00:00Z", ["A", "Cuzz", "Bdd", "Aiming", "B"]),
    ]);
    expect(ambiguous).toBe(0);
    expect(merges.map((m) => [m.sourceId, m.targetId, m.evidence.kind])).toEqual([
      [obs(1), stable, "observation"],
      [obs(2), stable, "observation"],
    ]);
    expect(merges[1]!.evidence.players.map((p) => p.name)).toEqual(["Cuzz", "Bdd", "Aiming"]);
  });

  it("forms one team from repeated games without a team ID, keeping the earliest as the survivor", () => {
    const roster = ["Jaguar", "Kodo", "Lux", "Mako", "Nori"];
    const { merges } = mergeOracleTeams([
      lineup(obs(3), "Super Guy Destroys", "2019-03-08T10:00:00Z", roster, "LMS"),
      lineup(obs(1), "Super Guy Destroys", "2019-02-01T10:00:00Z", roster, "LMS"),
      lineup(obs(2), "Super Guy Destroys", "2019-02-15T10:00:00Z", roster, "LMS"),
    ]);
    expect(merges.map((m) => [m.sourceId, m.targetId])).toEqual([
      [obs(2), obs(1)],
      [obs(3), obs(1)],
    ]);
  });

  it("merges a renamed organization into the stable team with the most games", () => {
    const furia = ["Guigo", "Tatu", "Tutsz", "Ayu", "JoJo"];
    const { merges } = mergeOracleTeams([
      lineup("oracle:team:a", "FURIA", "2026-01-10T10:00:00Z", furia, "LTA"),
      lineup("oracle:team:b", "FURIA Esports", "2026-03-10T10:00:00Z", furia, "LTA"),
      lineup("oracle:team:b", "FURIA Esports", "2026-03-17T10:00:00Z", furia, "LTA"),
    ]);
    expect(merges.map((m) => [m.sourceId, m.targetId, m.evidence.kind, m.evidence.league])).toEqual(
      [["oracle:team:a", "oracle:team:b", "name-variant", "LTA"]],
    );
  });

  it("keeps same-name teams separate without shared players in the same period and league", () => {
    const { merges } = mergeOracleTeams([
      lineup("oracle:team:gambit-gaming", "Gambit Gaming", "2014-03-01T10:00:00Z", kt, "LCS EU"),
      lineup("oracle:team:gambit-esports", "Gambit Esports", "2017-03-01T10:00:00Z", kt, "LCL"),
      lineup("oracle:team:x", "Ascension", "2026-01-01T10:00:00Z", kt, "LCK"),
      lineup("oracle:team:y", "Ascension Gaming", "2026-01-08T10:00:00Z", kt, "LPL"),
      lineup("oracle:team:p", "Panic", "2026-01-01T10:00:00Z", kt, "LCK"),
      lineup("oracle:team:q", "Panic", "2026-01-02T10:00:00Z", ["A", "B", "Bdd", "C", "Effort"]),
    ]);
    expect(merges).toEqual([]);
  });

  it("never merges teams that played each other or share lineups under unrelated names", () => {
    const a = lineup("oracle:team:a", "Imperium", "2026-01-01T10:00:00Z", kt);
    const { merges } = mergeOracleTeams([
      a,
      { ...lineup("oracle:team:b", "Imperium Club", "2026-01-01T10:00:00Z", kt), gameId: a.gameId },
      lineup("oracle:team:c", "Other Name", "2026-01-02T10:00:00Z", kt),
    ]);
    expect(merges).toEqual([]);
  });

  it("leaves a game without a team ID alone when it corroborates two separate teams", () => {
    const { merges, ambiguous } = mergeOracleTeams([
      lineup("oracle:team:one", "Matrix", "2026-01-01T10:00:00Z", kt),
      lineup("oracle:team:two", "Matrix", "2026-06-20T10:00:00Z", [
        "PerfecT",
        "Cuzz",
        "Bdd",
        "X",
        "Y",
      ]),
      lineup(obs(9), "Matrix", "2026-03-25T10:00:00Z", kt),
    ]);
    expect(ambiguous).toBe(1);
    expect(merges).toEqual([]);
  });
});
