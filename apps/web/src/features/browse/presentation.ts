import type { Match, Game, Identity } from "@esportsviewer/data";
import type { MatchDisplay, MatchTeam } from "@esportsviewer/ui";
export function localDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function dateTime(iso: string | null, timezone: string) {
  return iso
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(iso))
    : "Time to be confirmed";
}
export function identityHref(identity: Pick<Identity, "id" | "kind">) {
  return `/${identity.kind === "team" ? "teams" : "players"}/${encodeURIComponent(identity.id)}`;
}
export function matchDisplay(match: Match, timezone: string, now: string): MatchDisplay {
  const team = (i: number): MatchTeam => {
    const t = match.teams[i];
    return t
      ? {
          name: t.name,
          shortName: t.name,
          ...(t.imageUrl ? { logo: t.imageUrl } : {}),
          ...(t.score !== null ? { score: t.score } : {}),
        }
      : { name: "To be determined", shortName: "TBD" };
  };
  return {
    id: match.id,
    href: `/matches/${encodeURIComponent(match.id)}`,
    lifecycle: match.state,
    bestOf: match.bestOf,
    competition: match.league,
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
  return [...new Map(game.participants.map((p) => [p.team.id, p.team])).values()];
}
