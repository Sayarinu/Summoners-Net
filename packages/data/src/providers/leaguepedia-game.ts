import { z } from "zod";
import { purchases } from "../domain/builds.js";
import type { HistoricalGameTelemetry, HistoricalPlayerBuild } from "../domain/historical.js";
import { checkpointMinutes, type Checkpoint } from "../domain/wp-checkpoints.js";
import { parseRiotMatch } from "./riot-match.js";
import { parseRiotTimeline, type TimelineEvent, type TimelineFrame } from "./riot-timeline.js";

export const proGamePlatformPattern = "^(LOL|ESPORTS)TMNT[0-9]{2}_[0-9]+$";
const proGameId = z.string().max(30).regex(new RegExp(proGamePlatformPattern));
const revisions = z.object({
  query: z.object({
    pages: z
      .array(
        z.object({
          title: z.string(),
          revisions: z
            .array(
              z.object({
                slots: z.object({ main: z.object({ content: z.string().max(8_000_000) }) }),
              }),
            )
            .length(1)
            .optional(),
        }),
      )
      .max(2),
  }),
});
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

export interface ProGameDetails extends Omit<HistoricalGameTelemetry, "builds" | "patch"> {
  version: string | null;
  checkpoints: Checkpoint[];
  players: ({ participantId: number; side: "blue" | "red" } & HistoricalPlayerBuild)[];
}

function gamePages(id: string) {
  const [platform, number] = proGameId.parse(id).split("_");
  const score = `V5 data:${platform} ${number}`;
  return { score, timeline: `${score}/Timeline`, number: Number(number) };
}

export function leaguepediaGameUrl(id: string) {
  const { score, timeline } = gamePages(id);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: `${score}|${timeline}`,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  });
  return `https://lol.fandom.com/api.php?${params}`;
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

export function parseLeaguepediaGame(input: unknown, id: string): ProGameDetails | null {
  const { score, timeline, number } = gamePages(id);
  const pages = revisions.parse(input).query.pages;
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
  const players = (match?.participants ?? []).map(({ participantId, side, items }) => ({
    participantId,
    side,
    inventory: items.map(({ itemId }) => itemId),
    purchases: events
      ? purchases(events.events.filter((event) => event.participantId === participantId))
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
    if (
      minute >= checkpointMinutes[0] &&
      minute <= checkpointMinutes[3] &&
      Math.abs(timestampMs - minute * 60_000) < 2000
    ) {
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
    version: match?.gameVersion ?? null,
    players,
    checkpoints,
    gold: gold.sort((a, b) => a.seconds - b.seconds),
    events: timed.sort((a, b) => a.seconds - b.seconds),
  };
}
