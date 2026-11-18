import { z } from "zod";
import { purchases } from "../domain/builds.js";
import type { HistoricalGameTelemetry, HistoricalPlayerBuild } from "../domain/historical.js";
import type { Checkpoint } from "../domain/wp-checkpoints.js";
import { parseRiotMatch } from "./riot-match.js";
import { parseRiotTimeline, type TimelineEvent, type TimelineFrame } from "./riot-timeline.js";

export const proGamePlatformPattern = "^(LOL|ESPORTS)TMNT[0-9]{2}_[0-9]+$";
const proGameId = z.string().max(30).regex(new RegExp(proGamePlatformPattern));
/**
 * Games per request. One game's two pages are about 1.1 MB, and MediaWiki continues a response
 * past about 8 MiB, so five games fit in one reply with room to spare.
 */
export const leaguepediaBatchSize = 5;
const page = z.object({
  title: z.string(),
  missing: z.boolean().optional(),
  // A reply cut off at its size limit lists a page it could not fit with no revisions.
  revisions: z
    .array(
      z.object({
        slots: z.object({ main: z.object({ content: z.string().max(8_000_000) }) }),
      }),
    )
    .max(1)
    .optional(),
});
type Page = z.infer<typeof page>;
const reply = z.union([
  z.object({ error: z.object({ code: z.string().max(100) }) }),
  z.object({
    continue: z.record(z.string(), z.unknown()).optional(),
    query: z.object({ pages: z.array(page).max(leaguepediaBatchSize * 2) }),
  }),
]);
const gameIdentity = z.object({ gameId: z.number().int().positive() });
const dragonTypes = {
  FIRE_DRAGON: "infernal",
  EARTH_DRAGON: "mountain",
  AIR_DRAGON: "cloud",
  WATER_DRAGON: "ocean",
  CHEMTECH_DRAGON: "chemtech",
  HEXTECH_DRAGON: "hextech",
  ELDER_DRAGON: "elder",
} as const;
const objectiveNames = {
  BARON_NASHOR: "Baron Nashor",
  RIFTHERALD: "Rift Herald",
  HORDE: "Void Grub",
} as const;

/**
 * Raised when a stored detail lacks something a newer parser keeps, so stored games load again.
 * 2: checkpoints for every recorded minute, not only 10 to 25.
 * 3: physical, magic and true damage to champions per player.
 */
export const proGameDetailVersion = 3;

export interface ProGameDetails extends Omit<HistoricalGameTelemetry, "builds" | "patch"> {
  detailVersion: number;
  version: string | null;
  /** The game state at each whole minute that has a frame, from blue side's point of view. */
  checkpoints: Checkpoint[];
  players: ({ participantId: number; side: "blue" | "red" } & HistoricalPlayerBuild)[];
}

function gamePages(id: string) {
  const [platform, number] = proGameId.parse(id).split("_");
  const score = `V5 data:${platform} ${number}`;
  return { score, timeline: `${score}/Timeline`, number: Number(number) };
}

/** One request for the score and timeline pages of up to `leaguepediaBatchSize` games. */
export function leaguepediaGamesUrl(ids: readonly string[]) {
  if (!ids.length || ids.length > leaguepediaBatchSize)
    throw new Error(`Request between 1 and ${leaguepediaBatchSize} games.`);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: ids
      .flatMap((id) => {
        const { score, timeline } = gamePages(id);
        return [score, timeline];
      })
      .join("|"),
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    // Ask the wiki to refuse the request while its replicas lag, rather than add to the load.
    maxlag: "5",
  });
  return `https://lol.fandom.com/api.php?${params}`;
}

export type LeaguepediaGame =
  /** `detail` is null when the wiki has neither page. */
  | { state: "loaded"; detail: ProGameDetails | null }
  /** The pages exist but do not describe this game. */
  | { state: "invalid" }
  /** The reply was cut off before this game's pages; request it again. */
  | { state: "deferred" };
export type LeaguepediaReply =
  { state: "lagged" } | { state: "pages"; games: Map<string, LeaguepediaGame> };

/** Validates one batched reply and parses each requested game independently. */
export function parseLeaguepediaGames(input: unknown, ids: readonly string[]): LeaguepediaReply {
  const body = reply.parse(input);
  if ("error" in body) {
    if (body.error.code === "maxlag") return { state: "lagged" };
    throw new Error("Leaguepedia refused the request.");
  }
  const pages = body.query.pages;
  const continued = body.continue !== undefined;
  const games = new Map<string, LeaguepediaGame>();
  for (const id of ids) {
    const { score, timeline } = gamePages(id);
    const own = pages.filter(({ title }) => title === score || title === timeline);
    const unread = (title: string) => {
      const found = own.find((entry) => entry.title === title);
      return !found || (!found.missing && !found.revisions?.length);
    };
    if (continued && (unread(score) || unread(timeline))) {
      games.set(id, { state: "deferred" });
      continue;
    }
    try {
      games.set(id, { state: "loaded", detail: parseGame(own, id) });
    } catch {
      games.set(id, { state: "invalid" });
    }
  }
  return { state: "pages", games };
}

function objective(event: TimelineEvent) {
  if (event.type !== "ELITE_MONSTER_KILL") return null;
  if (event.monsterType === "DRAGON") {
    const type = event.monsterSubType as keyof typeof dragonTypes | null;
    const drake = type && Object.hasOwn(dragonTypes, type) ? dragonTypes[type] : null;
    return { label: drake === "elder" ? "Elder Dragon" : "Dragon", drake };
  }
  const type = event.monsterType as keyof typeof objectiveNames | null;
  return type && Object.hasOwn(objectiveNames, type)
    ? { label: objectiveNames[type], drake: null }
    : null;
}

function parseGame(pages: readonly Page[], id: string): ProGameDetails | null {
  const { score, timeline, number } = gamePages(id);
  const read = (title: string): unknown => {
    const raw = pages.find((page) => page.title === title)?.revisions?.[0]?.slots.main.content;
    if (!raw) return null;
    const info: unknown = JSON.parse(raw);
    if (gameIdentity.parse(info).gameId !== number) throw new Error("Pro game ID mismatch.");
    return info;
  };
  const scoreInfo = read(score);
  const timelineInfo = read(timeline);
  if (!scoreInfo && !timelineInfo) return null;
  const metadata = { matchId: id };
  const match = scoreInfo ? parseRiotMatch({ metadata, info: scoreInfo }, id) : null;
  if (match && match.platformId !== id.split("_")[0])
    throw new Error("Pro game platform mismatch.");
  const events = timelineInfo ? parseRiotTimeline({ metadata, info: timelineInfo }, id) : null;
  const players = (match?.participants ?? []).map((participant) => ({
    participantId: participant.participantId,
    side: participant.side,
    inventory: participant.items.map(({ itemId }) => itemId),
    damage:
      participant.physicalDamageDealtToChampions !== null &&
      participant.magicDamageDealtToChampions !== null &&
      participant.trueDamageDealtToChampions !== null
        ? {
            physical: participant.physicalDamageDealtToChampions,
            magic: participant.magicDamageDealtToChampions,
            true: participant.trueDamageDealtToChampions,
          }
        : null,
    purchases: events
      ? purchases(
          events.events.filter((event) => event.participantId === participant.participantId),
        )
      : null,
  }));
  const sides = new Map(players.map(({ participantId, side }) => [participantId, side]));
  const frames = Map.groupBy(events?.frames ?? [], (frame) => frame.timestampMs);
  const championKills = (events?.events ?? []).filter(
    (event) => event.type === "CHAMPION_KILL" && event.participantId !== null,
  );
  const checkpoints: Checkpoint[] = [];
  const gold = [...frames].flatMap(([timestampMs, frame]) => {
    const bySide = Map.groupBy(frame, ({ participantId }) => sides.get(participantId));
    const difference = (read: (player: TimelineFrame) => number | null) => {
      const sum = (side: "blue" | "red") => {
        const values = bySide.get(side)?.map(read);
        return values?.length === 5 && values.every((value) => value !== null)
          ? values.reduce((total, value) => total + value, 0)
          : null;
      };
      const blue = sum("blue");
      const red = sum("red");
      return blue === null || red === null ? null : blue - red;
    };
    const goldDiff = difference(({ totalGold }) => totalGold);
    const minute = Math.round(timestampMs / 60_000);
    if (Math.abs(timestampMs - minute * 60_000) < 2000) {
      const xpDiff = difference(({ xp }) => xp);
      const csDiff = difference(({ minionsKilled, jungleMinionsKilled }) =>
        minionsKilled === null || jungleMinionsKilled === null
          ? null
          : minionsKilled + jungleMinionsKilled,
      );
      if (goldDiff !== null && xpDiff !== null && csDiff !== null) {
        const killDiff = championKills.reduce((lead, event) => {
          if (event.timestampMs > timestampMs || event.participantId === null) return lead;
          const side = sides.get(event.participantId);
          return lead + (side === "blue" ? 1 : side === "red" ? -1 : 0);
        }, 0);
        checkpoints.push({ minute, goldDiff, xpDiff, csDiff, killDiff });
      }
    }
    return goldDiff === null ? [] : [{ seconds: Math.round(timestampMs / 1000), lead: goldDiff }];
  });
  const [firstBlood] = championKills;
  const timed: HistoricalGameTelemetry["events"] =
    firstBlood?.participantId != null
      ? [
          {
            seconds: Math.round(firstBlood.timestampMs / 1000),
            label: "First Blood",
            side: sides.get(firstBlood.participantId) ?? null,
            drake: null,
          },
        ]
      : [];
  timed.push(
    ...(events?.events ?? []).flatMap((event) => {
      const match = objective(event);
      if (!match) return [];
      return [
        {
          ...match,
          seconds: Math.round(event.timestampMs / 1000),
          side:
            event.teamId === 100
              ? ("blue" as const)
              : event.teamId === 200
                ? ("red" as const)
                : null,
        },
      ];
    }),
  );
  return {
    detailVersion: proGameDetailVersion,
    version: match?.gameVersion ?? null,
    players,
    checkpoints,
    gold: gold.sort((a, b) => a.seconds - b.seconds),
    events: timed.sort((a, b) => a.seconds - b.seconds),
  };
}
