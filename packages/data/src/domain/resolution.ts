import type { Identity, Match } from "./models.js";

export interface ContextTeam {
  team: Identity;
  players: Identity[];
  observedAt: string;
  tournamentId?: string;
  playedAfter?: string;
  playedBefore?: string;
}
export interface PlayedSquad {
  gameId: string;
  teamId: string;
  playedAt: string;
  players: { id: string; name: string; role: string }[];
}
export interface IdentityLink {
  oracleId: string;
  pandaId: string;
  evidence: {
    method: "lineup" | "fixtures";
    fixtures?: { gameId: string; matchId: string; playedAt: string; opponentId: string }[];
    tournamentId?: string;
    gameId: string;
    playedAt: string;
    observedAt: string;
    teamOracleId: string;
    teamPandaId: string;
    players: { oracleId: string; pandaId: string; role: string }[];
  };
}
// This generates candidates only. Neither punctuation nor a matching name establishes identity.
export const nameKey = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._'-]/g, "");
export function roleKey(role: string | null): string | undefined {
  return (
    {
      top: "top",
      mid: "mid",
      middle: "mid",
      jng: "jungle",
      jun: "jungle",
      jungle: "jungle",
      adc: "bottom",
      bot: "bottom",
      bottom: "bottom",
      sup: "support",
      support: "support",
    } as Record<string, string>
  )[role ?? ""];
}
const stable = (id: string) => !id.includes(":observation:");
const inPeriod = (team: ContextTeam, squad: PlayedSquad) =>
  (!team.playedAfter || squad.playedAt >= team.playedAfter) &&
  (!team.playedBefore || squad.playedAt <= team.playedBefore);
function unambiguous(links: IdentityLink[]): IdentityLink[] {
  const byOracle = new Map<string, Set<string>>();
  const byPanda = new Map<string, Set<string>>();
  for (const link of links) {
    byOracle.set(link.oracleId, (byOracle.get(link.oracleId) ?? new Set()).add(link.pandaId));
    byPanda.set(link.pandaId, (byPanda.get(link.pandaId) ?? new Set()).add(link.oracleId));
  }
  const unique = new Map<string, IdentityLink>();
  // Prefer the latest corroborating played lineup, deterministically, without ranking away conflicts.
  for (const link of [...links].sort(
    (a, b) =>
      b.evidence.playedAt.localeCompare(a.evidence.playedAt) ||
      a.evidence.gameId.localeCompare(b.evidence.gameId),
  ))
    if (
      byOracle.get(link.oracleId)!.size === 1 &&
      byPanda.get(link.pandaId)!.size === 1 &&
      !unique.has(link.oracleId)
    )
      unique.set(link.oracleId, link);
  return [...unique.values()];
}
/**
 * Settles team conflicts that evidence can decide before ambiguity is judged. Lineup evidence
 * outranks fixtures, so a fixture-only candidate that contradicts a lineup candidate is dropped.
 * When several Oracle teams corroborate one provider team by lineup in separate, non-overlapping
 * eras (a disbanded and a revived organization), only the latest era keeps its candidates.
 */
function settleTeamConflicts(
  lineup: IdentityLink[],
  fixtures: IdentityLink[],
  squads: PlayedSquad[],
): IdentityLink[] {
  const oraclesOf = new Map<string, Set<string>>();
  const pandasOf = new Map<string, Set<string>>();
  for (const l of lineup) {
    oraclesOf.set(l.pandaId, (oraclesOf.get(l.pandaId) ?? new Set()).add(l.oracleId));
    pandasOf.set(l.oracleId, (pandasOf.get(l.oracleId) ?? new Set()).add(l.pandaId));
  }
  const agreeing = fixtures.filter(
    (l) =>
      (oraclesOf.get(l.pandaId)?.has(l.oracleId) ?? true) &&
      (pandasOf.get(l.oracleId)?.has(l.pandaId) ?? true),
  );
  const periods = new Map<string, { first: string; last: string }>();
  for (const squad of squads) {
    const period = periods.get(squad.teamId);
    if (!period) periods.set(squad.teamId, { first: squad.playedAt, last: squad.playedAt });
    else {
      if (squad.playedAt < period.first) period.first = squad.playedAt;
      if (squad.playedAt > period.last) period.last = squad.playedAt;
    }
  }
  const superseded = new Set<string>();
  for (const [pandaId, oracles] of oraclesOf) {
    if (oracles.size < 2) continue;
    const eras = [...oracles]
      .map((id) => ({ id, ...periods.get(id)! }))
      .sort((a, b) => a.first.localeCompare(b.first));
    const separate = eras.every((era, i) => i === 0 || eras[i - 1]!.last < era.first);
    if (separate) for (const era of eras.slice(0, -1)) superseded.add(`${era.id}|${pandaId}`);
  }
  return [...lineup, ...agreeing].filter((l) => !superseded.has(`${l.oracleId}|${l.pandaId}`));
}
export function resolveIdentities(input: {
  aliases: { id: string; name: string }[];
  squads: PlayedSquad[];
  teams: ContextTeam[];
  matches?: Match[];
  games?: {
    gameId: string;
    playedAt: string;
    league: string;
    teams: { id: string; name: string }[];
  }[];
}): { links: IdentityLink[]; ambiguous: number } {
  const names = new Map<string, Set<string>>();
  for (const alias of input.aliases) {
    if (!stable(alias.id)) continue;
    const key = nameKey(alias.name);
    if (key && !key.startsWith("unknown"))
      names.set(alias.id, (names.get(alias.id) ?? new Set()).add(key));
  }
  const teamCandidates: IdentityLink[] = [];
  for (const team of input.teams) {
    const teamNames = new Set([
      nameKey(team.team.name),
      ...(team.team.aliases ?? []).map(nameKey),
      ...(names.get(team.team.id) ?? []),
    ]);
    for (const squad of input.squads) {
      if (!inPeriod(team, squad)) continue;
      if (
        !stable(squad.teamId) ||
        ![...(names.get(squad.teamId) ?? [])].some((n) => teamNames.has(n))
      )
        continue;
      const members = squad.players.flatMap((player) => {
        if (!stable(player.id)) return [];
        const role = roleKey(player.role);
        if (!role) return [];
        const candidates = team.players.filter(
          (p) =>
            roleKey(p.role) === role &&
            (names.get(player.id)?.has(nameKey(p.name)) ||
              nameKey(player.name) === nameKey(p.name)),
        );
        return candidates.length === 1
          ? [{ oracleId: player.id, pandaId: candidates[0]!.id, role }]
          : [];
      });
      // Three distinct players, roles and source IDs must coexist in one actual game.
      if (
        members.length < 3 ||
        new Set(members.map((p) => p.pandaId)).size !== members.length ||
        new Set(members.map((p) => p.role)).size !== members.length
      )
        continue;
      teamCandidates.push({
        oracleId: squad.teamId,
        pandaId: team.team.id,
        evidence: {
          ...(team.tournamentId ? { tournamentId: team.tournamentId } : {}),
          method: "lineup",
          gameId: squad.gameId,
          playedAt: squad.playedAt,
          observedAt: team.observedAt,
          teamOracleId: squad.teamId,
          teamPandaId: team.team.id,
          players: members,
        },
      });
    }
  }
  const fixtureGroups = new Map<string, IdentityLink>();
  for (const match of input.matches ?? []) {
    if (!match.startsAt || match.teams.length !== 2 || match.state !== "final") continue;
    const candidates = (input.games ?? []).flatMap((game) => {
      if (
        game.league !== match.league ||
        game.teams.length !== 2 ||
        Math.abs(Date.parse(game.playedAt) - Date.parse(match.startsAt!)) > 12 * 3600000
      )
        return [];
      const pairs = match.teams.map((p) =>
        game.teams.filter((o) =>
          [nameKey(o.name), ...(names.get(o.id) ?? [])].some((n) =>
            [
              nameKey(p.name),
              ...(p.aliases ?? []).map(nameKey),
              ...(names.get(p.id) ?? []),
            ].includes(n),
          ),
        ),
      );
      return pairs.every((p) => p.length === 1) && pairs[0]![0]!.id !== pairs[1]![0]!.id
        ? [{ game, pairs }]
        : [];
    });
    if (candidates.length !== 1) continue;
    const { game, pairs } = candidates[0]!;
    for (const [index, panda] of match.teams.entries()) {
      const oracle = pairs[index]![0]!;
      if (!stable(oracle.id)) continue;
      const key = `${oracle.id}|${panda.id}`;
      const fixture = {
        gameId: game.gameId,
        matchId: match.id,
        playedAt: game.playedAt,
        opponentId: pairs[1 - index]![0]!.id,
      };
      const link = fixtureGroups.get(key) ?? {
        oracleId: oracle.id,
        pandaId: panda.id,
        evidence: {
          method: "fixtures" as const,
          gameId: game.gameId,
          playedAt: game.playedAt,
          observedAt: match.updatedAt,
          teamOracleId: oracle.id,
          teamPandaId: panda.id,
          players: [],
          fixtures: [],
        },
      };
      link.evidence.fixtures!.push(fixture);
      fixtureGroups.set(key, link);
    }
  }
  const fixtureCandidates = [...fixtureGroups.values()].filter(
    (l) =>
      new Set(l.evidence.fixtures!.map((f) => f.playedAt.slice(0, 10))).size >= 2 &&
      new Set(l.evidence.fixtures!.map((f) => f.opponentId)).size >= 2,
  );
  const teams = unambiguous(settleTeamConflicts(teamCandidates, fixtureCandidates, input.squads));
  const acceptedTeams = new Set(teams.map((t) => `${t.oracleId}|${t.pandaId}`));
  // A player is linked only inside a corroborated team, in the same role and played lineup.
  const playerCandidates: IdentityLink[] = [];
  for (const team of input.teams)
    for (const squad of input.squads) {
      if (!inPeriod(team, squad)) continue;
      if (!acceptedTeams.has(`${squad.teamId}|${team.team.id}`)) continue;
      const members = squad.players.flatMap((player) => {
        const role = roleKey(player.role);
        if (!role || !stable(player.id)) return [];
        const candidates = team.players.filter(
          (p) =>
            roleKey(p.role) === role &&
            [nameKey(player.name), ...(names.get(player.id) ?? [])].includes(nameKey(p.name)),
        );
        return candidates.length === 1
          ? [{ oracleId: player.id, pandaId: candidates[0]!.id, role }]
          : [];
      });
      for (const member of members)
        playerCandidates.push({
          oracleId: member.oracleId,
          pandaId: member.pandaId,
          evidence: {
            ...(team.tournamentId ? { tournamentId: team.tournamentId } : {}),
            method: "lineup",
            gameId: squad.gameId,
            playedAt: squad.playedAt,
            observedAt: team.observedAt,
            teamOracleId: squad.teamId,
            teamPandaId: team.team.id,
            players: members,
          },
        });
    }
  const players = unambiguous(playerCandidates);
  return {
    links: [...teams, ...players],
    ambiguous:
      new Set([...teamCandidates, ...fixtureCandidates, ...playerCandidates].map((l) => l.oracleId))
        .size -
      teams.length -
      players.length,
  };
}
