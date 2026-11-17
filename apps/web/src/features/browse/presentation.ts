import type { Match, Game, Identity } from "@summonersnet/data";
import type { MatchDisplay, MatchTeam } from "@summonersnet/ui";
export function dateTime(iso: string | null, timezone: string) {
  return iso
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "Time to be confirmed";
}
export function identityHref(identity: Pick<Identity, "kind" | "name" | "publicSlug">) {
  const section = identity.kind === "team" ? "teams" : "players";
  // A missing route is a data-integrity issue; never expose provider IDs as a fallback.
  return identity.publicSlug ? `/${section}/${identity.publicSlug}` : `/${section}`;
}
export function matchDisplay(match: Match, timezone: string, now: string): MatchDisplay {
  const showScores = match.state === "live" || match.state === "final";
  const team = (i: number): MatchTeam => {
    const t = match.teams[i];
    if (!t) return { name: "TBD", shortName: "TBD" };
    const name = /^(tbd|to be determined)$/i.test(t.name.trim()) ? "TBD" : t.name;
    return {
      name,
      shortName: name,
      ...(name !== "TBD" && t.imageUrl ? { logo: t.imageUrl } : {}),
      ...(showScores && t.score !== null ? { score: t.score } : {}),
    };
  };
  return {
    id: match.id,
    href: `/matches/${encodeURIComponent(match.id)}`,
    lifecycle: match.state,
    bestOf: match.bestOf,
    competition: match.league,
    region: match.league,
    stage: match.event,
    scheduledLabel: dateTime(match.startsAt, timezone),
    teams: [team(0), team(1)],
    streamAvailable: match.broadcasts.length > 0,
    sourceFreshness:
      new Date(now).valueOf() - new Date(match.updatedAt).valueOf() >
      (match.state === "live" ? 300000 : 1200000)
        ? "stale"
        : "fresh",
  };
}
export function gameTeams(game: Game) {
  const teams = [
    ...new Map(game.participants.map((p) => [p.team.id, { ...p.team, side: p.side }])).values(),
  ]
    .sort((a, b) => a.side.localeCompare(b.side))
    .map((team) => {
      const results = new Set(
        game.participants.flatMap((p) =>
          p.team.id === team.id && p.side === team.side && p.won !== null ? [p.won] : [],
        ),
      );
      return { ...team, won: results.size === 1 ? [...results][0]! : null };
    });
  if (teams.length === 2 && teams[0]!.won !== null && teams[0]!.won === teams[1]!.won)
    return teams.map((team) => ({ ...team, won: null }));
  return teams;
}

export function seriesRound(match: Pick<Match, "event" | "name">) {
  for (const label of [...match.event.split(" · ").reverse(), match.name.split(":", 1)[0]]) {
    const round = label?.trim().replace(/\b(semi|quarter)-final/gi, "$1final");
    if (
      round &&
      /^(?:(?:(?:upper|lower) bracket |grand )?(?:finals?|semifinals?|quarterfinals?)(?: \d+)?|round (?:of )?\d+)$/i.test(
        round,
      )
    ) {
      return round.toLowerCase().replace(/\b(?!of\b)[a-z]/g, (letter) => letter.toUpperCase());
    }
  }
  return null;
}
