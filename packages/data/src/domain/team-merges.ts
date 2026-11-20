import { nameKey, roleKey } from "./resolution.js";

/** One team's lineup in one actual game, as Oracle's Elixir recorded it. */
export interface TeamLineup {
  gameId: string;
  teamId: string;
  teamName: string;
  league: string;
  playedAt: string;
  players: { id: string; name: string; role: string }[];
}
export interface TeamMerge {
  sourceId: string;
  targetId: string;
  evidence: {
    method: "lineup";
    kind: "observation" | "name-variant";
    sourceGameId: string;
    targetGameId: string;
    league: string;
    playedAt: string;
    players: { name: string; role: string }[];
  };
}

/** Lineups count as the same team only within one split's distance of each other. */
export const mergeWindowDays = 120;
const minimumSharedPlayers = 3;
const observation = (id: string) => id.includes(":observation:");

/**
 * The organization part of a team name: case, punctuation and a leading or trailing "Team",
 * "Esports", "Gaming" or "Club" are ignored, so "Lyon Gaming" and "LYON" compare equal. A matching
 * name only makes two teams candidates; it never merges them.
 */
export function teamNameKey(name: string): string {
  const words = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const generic = new Set(["team", "esports", "esport", "gaming", "club", "e", "sports"]);
  while (words.length > 1 && generic.has(words.at(-1)!)) words.pop();
  while (words.length > 1 && generic.has(words[0]!)) words.shift();
  return words.join("");
}

function shared(a: TeamLineup, b: TeamLineup) {
  const roles = new Map<string, string>();
  for (const p of a.players) {
    const role = roleKey(p.role);
    if (role) roles.set(role, nameKey(p.name));
  }
  const players = b.players.flatMap((p) => {
    const role = roleKey(p.role);
    return role && roles.get(role) === nameKey(p.name) ? [{ name: p.name, role }] : [];
  });
  return players;
}

/**
 * Finds Oracle teams that are one team recorded under several identities: games without a team ID
 * (each of which gets its own `observation:` team) and renamed organizations. Two teams merge only
 * when, in the same league and within {@link mergeWindowDays} days, one of each team's actual
 * lineups shares at least three players in the same roles, their names agree, and they never played
 * each other. An observation team that matches two separate teams is left alone as ambiguous.
 */
export function mergeOracleTeams(lineups: TeamLineup[]): {
  merges: TeamMerge[];
  ambiguous: number;
} {
  const byTeam = new Map<string, TeamLineup[]>();
  const opponents = new Map<string, Set<string>>();
  const byGame = new Map<string, string[]>();
  for (const lineup of lineups) {
    if (!byTeam.has(lineup.teamId)) byTeam.set(lineup.teamId, []);
    byTeam.get(lineup.teamId)!.push(lineup);
    if (!byGame.has(lineup.gameId)) byGame.set(lineup.gameId, []);
    byGame.get(lineup.gameId)!.push(lineup.teamId);
  }
  for (const teams of byGame.values())
    for (const team of teams)
      for (const other of teams)
        if (other !== team) opponents.set(team, (opponents.get(team) ?? new Set()).add(other));
  const names = new Map<string, Set<string>>();
  for (const lineup of lineups)
    names.set(
      lineup.teamId,
      (names.get(lineup.teamId) ?? new Set()).add(teamNameKey(lineup.teamName)),
    );
  const ids = [...byTeam.keys()].sort();
  const window = mergeWindowDays * 86400000;

  // Teams are compared only with teams that share a name key.
  const byName = new Map<string, Set<string>>();
  for (const [id, keys] of names)
    for (const key of keys) byName.set(key, (byName.get(key) ?? new Set()).add(id));
  const candidates = (id: string) =>
    [...new Set([...names.get(id)!].flatMap((key) => [...byName.get(key)!]))]
      .filter((other) => other !== id)
      .sort();

  interface Edge {
    a: string;
    b: string;
    aGameId: string;
    bGameId: string;
    league: string;
    aPlayedAt: string;
    bPlayedAt: string;
    gap: number;
    players: { name: string; role: string }[];
  }
  function corroborate(a: string, b: string): Edge | undefined {
    if (opponents.get(a)?.has(b)) return undefined;
    let best: Edge | undefined;
    for (const x of byTeam.get(a)!)
      for (const y of byTeam.get(b)!) {
        if (x.league !== y.league) continue;
        const gap = Math.abs(Date.parse(x.playedAt) - Date.parse(y.playedAt));
        if (gap > window) continue;
        const players = shared(x, y);
        if (new Set(players.map((p) => p.role)).size < minimumSharedPlayers) continue;
        // Keep the closest pair of games as the recorded evidence, deterministically.
        if (!best || gap < best.gap)
          best = {
            a,
            b,
            aGameId: x.gameId,
            bGameId: y.gameId,
            league: x.league,
            aPlayedAt: x.playedAt,
            bPlayedAt: y.playedAt,
            gap,
            players,
          };
      }
    return best;
  }

  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const [x, y] = [find(a), find(b)].sort();
    if (x !== y) parent.set(y!, x!);
  };
  const evidence = new Map<string, Edge>();

  // Renamed organizations: two teams with stable Oracle IDs.
  const stableIds = ids.filter((id) => !observation(id));
  for (const a of stableIds)
    for (const b of candidates(a)) {
      if (observation(b) || b < a) continue;
      const edge = corroborate(a, b);
      if (edge) {
        union(a, b);
        evidence.set(`${a}|${b}`, edge);
      }
    }
  // Games without a team ID join the one stable team their lineup corroborates.
  let ambiguous = 0;
  const unattached: string[] = [];
  for (const id of ids.filter(observation)) {
    const matches = new Map<string, Edge>();
    for (const team of candidates(id).filter((c) => !observation(c))) {
      const edge = corroborate(id, team);
      if (edge && !matches.has(find(team))) matches.set(find(team), edge);
    }
    if (matches.size === 1) {
      const [, edge] = [...matches][0]!;
      union(edge.b, id);
      evidence.set(`${edge.b}|${id}`, edge);
    } else if (matches.size > 1) ambiguous++;
    else unattached.push(id);
  }
  // The rest form teams of their own from games whose lineups corroborate each other.
  const loose = new Set(unattached);
  for (const a of unattached)
    for (const b of candidates(a)) {
      if (!loose.has(b) || b < a) continue;
      const edge = corroborate(a, b);
      if (edge) {
        union(a, b);
        evidence.set(`${a}|${b}`, edge);
      }
    }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    if (!groups.has(find(id))) groups.set(find(id), []);
    groups.get(find(id))!.push(id);
  }
  const merges: TeamMerge[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    // The survivor is a stable team with the most games; for observation-only groups, the earliest.
    const first = (id: string) =>
      byTeam
        .get(id)!
        .map((l) => l.playedAt)
        .sort()[0]!;
    const [target] = [...members].sort((a, b) => {
      if (observation(a) !== observation(b)) return observation(a) ? 1 : -1;
      if (!observation(a))
        return byTeam.get(b)!.length - byTeam.get(a)!.length || a.localeCompare(b);
      return first(a).localeCompare(first(b)) || a.localeCompare(b);
    });
    for (const source of members) {
      if (source === target) continue;
      const edge = [...evidence.values()].find(
        (e) => (e.a === source || e.b === source) && members.includes(e.a) && members.includes(e.b),
      )!;
      const ownGame = edge.a === source ? edge.aGameId : edge.bGameId;
      const otherGame = edge.a === source ? edge.bGameId : edge.aGameId;
      merges.push({
        sourceId: source,
        targetId: target!,
        evidence: {
          method: "lineup",
          kind: observation(source) ? "observation" : "name-variant",
          sourceGameId: ownGame,
          targetGameId: otherGame,
          league: edge.league,
          playedAt: edge.a === source ? edge.aPlayedAt : edge.bPlayedAt,
          players: edge.players,
        },
      });
    }
  }
  return { merges: merges.sort((a, b) => a.sourceId.localeCompare(b.sourceId)), ambiguous };
}
