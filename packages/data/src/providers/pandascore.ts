import { z } from "zod";
import { coveredLeague, sourceIdentity } from "../domain/coverage.js";
import { matchSchema, type Identity, type Broadcast, type Match } from "../domain/models.js";
const identity = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  slug: z.string().nullable().optional(),
  image_url: z.url().nullable().optional(),
  nationality: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
});
const team = identity.extend({ players: z.array(identity).optional() });
const rawGame = z.object({
  id: z.number().int(),
  position: z.number().int(),
  status: z.string(),
  begin_at: z.iso.datetime({ offset: true }).nullable().optional(),
  end_at: z.iso.datetime({ offset: true }).nullable().optional(),
  winner: z.object({ id: z.number().int().nullable() }).nullable().optional(),
});
const rawMatch = z.object({
  games: z.array(rawGame).optional(),
  id: z.number().int(),
  name: z.string(),
  begin_at: z.iso.datetime({ offset: true }).nullable(),
  status: z.string(),
  number_of_games: z.number().int().nullable(),
  league: z.object({ id: z.number().int(), name: z.string() }),
  serie: z
    .object({
      full_name: z.string().optional(),
      name: z.string().nullable().optional(),
    })
    .nullable(),
  tournament: z.object({ name: z.string() }).optional(),
  opponents: z.array(z.object({ opponent: identity })),
  results: z
    .array(
      z.object({
        team_id: z.number().int(),
        score: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  streams_list: z
    .array(z.object({ raw_url: z.string(), language: z.string().optional() }))
    .optional(),
});
function toIdentity(value: z.infer<typeof identity>, kind: "team" | "player"): Identity {
  return {
    id: sourceIdentity("pandascore", kind, String(value.id), ""),
    source: "pandascore",
    sourceId: String(value.id),
    kind,
    name: value.name ?? value.slug ?? `Unknown ${kind} ${value.id}`,
    imageUrl: value.image_url ?? null,
    country: value.nationality ?? null,
    role: value.role ?? null,
  };
}
export function parseBroadcast(raw: string, language = "unknown"): Broadcast | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "twitch.tv" || host === "www.twitch.tv") {
    const path = url.pathname.split("/").filter(Boolean);
    let externalId = "";
    if (path[0] === "videos" && /^\d+$/.test(path[1] ?? "")) externalId = `v${path[1]}`;
    else if (path.length === 1 && /^[a-zA-Z0-9_]{3,25}$/.test(path[0] ?? ""))
      externalId = path[0] ?? "";
    return { provider: "twitch", externalId, url: url.toString(), language };
  }
  if (["youtube.com", "www.youtube.com", "youtu.be"].includes(host)) {
    const candidate =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          (url.pathname.startsWith("/live/") ? url.pathname.slice(6) : ""));
    return {
      provider: "youtube",
      externalId: /^[\w-]{11}$/.test(candidate) ? candidate : "",
      url: url.toString(),
      language,
    };
  }
  return null;
}
export function parseMatches(payload: unknown, now: Date): Match[] {
  return z
    .array(rawMatch)
    .parse(payload)
    .flatMap((raw) => {
      const league = coveredLeague(
        raw.league.name,
        raw.begin_at ? new Date(raw.begin_at).getUTCFullYear() : now.getUTCFullYear(),
      );
      if (!league) return [];
      const state =
        (
          {
            not_started: "scheduled",
            running: "live",
            finished: "final",
            postponed: "postponed",
            canceled: "cancelled",
          } as const
        )[raw.status as "running"] ?? "unknown";
      const bestOf = [1, 2, 3, 5].includes(raw.number_of_games ?? 0) ? raw.number_of_games : 1;
      return [
        matchSchema.parse({
          id: `pandascore:match:${raw.id}`,
          sourceId: String(raw.id),
          name: raw.name,
          league,
          event:
            [raw.serie?.full_name ?? raw.serie?.name, raw.tournament?.name]
              .filter(Boolean)
              .join(" · ") || raw.league.name,
          startsAt: raw.begin_at ? new Date(raw.begin_at).toISOString() : null,
          state,
          bestOf,
          teams: raw.opponents.map((o) => ({
            ...toIdentity(o.opponent, "team"),
            score: raw.results?.find((r) => r.team_id === o.opponent.id)?.score ?? null,
          })),
          broadcasts: (raw.streams_list ?? []).flatMap((s) => {
            const b = parseBroadcast(s.raw_url, s.language);
            return b ? [b] : [];
          }),
          games: (raw.games ?? []).map((g) => ({
            sourceId: String(g.id),
            number: g.position,
            state: g.status,
            startsAt: g.begin_at ? new Date(g.begin_at).toISOString() : null,
            finishedAt: g.end_at ? new Date(g.end_at).toISOString() : null,
            winnerId: g.winner?.id
              ? sourceIdentity("pandascore", "team", String(g.winner.id), "")
              : null,
          })),
          updatedAt: now.toISOString(),
        }),
      ];
    });
}
export function parseTeams(payload: unknown) {
  return z
    .array(team)
    .parse(payload)
    .flatMap((t) =>
      t.players === undefined
        ? []
        : [
            {
              team: toIdentity(t, "team"),
              players: t.players.map((p) => toIdentity(p, "player")),
            },
          ],
    );
}
