import { z } from "zod";

// match-v5 TimelineDto: one frame per minute with each participant's state, and the events of
// that minute. Coordinates and statistics Riot omits stay null.
const int = z.number().int();
const nullableInt = int.nullish().transform((v) => v ?? null);
const nullableText = z
  .string()
  .max(60)
  .nullish()
  .transform((v) => v ?? null);
const position = z
  .object({ x: int, y: int })
  .nullish()
  .transform((v) => v ?? null);
const participantFrame = z.object({
  participantId: int.min(1).max(10),
  position,
  currentGold: nullableInt,
  totalGold: nullableInt,
  xp: nullableInt,
  level: nullableInt,
  minionsKilled: nullableInt,
  jungleMinionsKilled: nullableInt,
});
const event = z.object({
  type: z.string().regex(/^[A-Z_]{1,40}$/),
  timestamp: int.min(0),
  participantId: nullableInt,
  killerId: nullableInt,
  creatorId: nullableInt,
  victimId: nullableInt,
  teamId: nullableInt,
  killerTeamId: nullableInt,
  position,
  itemId: nullableInt,
  beforeId: nullableInt,
  afterId: nullableInt,
  skillSlot: nullableInt,
  levelUpType: nullableText,
  monsterType: nullableText,
  monsterSubType: nullableText,
  buildingType: nullableText,
  laneType: nullableText,
  towerType: nullableText,
  wardType: nullableText,
  assistingParticipantIds: z.array(int).max(9).nullish(),
});
const timelineSchema = z.object({
  metadata: z.object({ matchId: z.string().regex(/^[A-Z0-9]{2,5}_\d{1,15}$/) }),
  info: z.object({
    frameInterval: int.positive().nullish(),
    frames: z
      .array(
        z.object({
          timestamp: int.min(0),
          participantFrames: z.record(z.string().regex(/^([1-9]|10)$/), participantFrame),
          events: z.array(event).max(5000),
        }),
      )
      .min(1)
      .max(200),
  }),
});

/** Event types kept: kills, objectives, wards, items, skill-ups and the game end. */
export const timelineEventTypes = [
  "CHAMPION_KILL",
  "CHAMPION_SPECIAL_KILL",
  "ELITE_MONSTER_KILL",
  "BUILDING_KILL",
  "TURRET_PLATE_DESTROYED",
  "DRAGON_SOUL_GIVEN",
  "WARD_PLACED",
  "WARD_KILL",
  "ITEM_PURCHASED",
  "ITEM_SOLD",
  "ITEM_DESTROYED",
  "ITEM_UNDO",
  "SKILL_LEVEL_UP",
  "LEVEL_UP",
  "GAME_END",
] as const;
export type TimelineEventType = (typeof timelineEventTypes)[number];

export interface TimelineFrame {
  participantId: number;
  minute: number;
  timestampMs: number;
  x: number | null;
  y: number | null;
  currentGold: number | null;
  totalGold: number | null;
  xp: number | null;
  level: number | null;
  minionsKilled: number | null;
  jungleMinionsKilled: number | null;
}
export interface TimelineEvent {
  seq: number;
  type: TimelineEventType;
  timestampMs: number;
  /** The acting participant (buyer, killer, ward placer); null for minions, towers and monsters. */
  participantId: number | null;
  victimId: number | null;
  teamId: number | null;
  x: number | null;
  y: number | null;
  /** The item bought, sold or destroyed; for an undo, the item before the undo. */
  itemId: number | null;
  /** For an undo, the item after it. */
  afterItemId: number | null;
  skillSlot: number | null;
  levelUpType: string | null;
  monsterType: string | null;
  monsterSubType: string | null;
  buildingType: string | null;
  laneType: string | null;
  towerType: string | null;
  wardType: string | null;
  assistingParticipantIds: number[] | null;
}
export interface RiotTimeline {
  matchId: string;
  frames: TimelineFrame[];
  events: TimelineEvent[];
}

// Riot uses participant id 0 for minions, towers and monsters.
const participantOrNull = (id: number | null) => (id && id >= 1 && id <= 10 ? id : null);

export function parseRiotTimeline(input: unknown, matchId: string): RiotTimeline {
  const { metadata, info } = timelineSchema.parse(input);
  if (metadata.matchId !== matchId) throw new Error("Timeline payload is for another match.");
  const frames: TimelineFrame[] = [];
  const events: TimelineEvent[] = [];
  const kept = new Set<string>(timelineEventTypes);
  info.frames.forEach((frame, minute) => {
    for (const [key, p] of Object.entries(frame.participantFrames)) {
      if (Number(key) !== p.participantId) throw new Error("Participant frame key mismatch.");
      frames.push({
        participantId: p.participantId,
        minute,
        timestampMs: frame.timestamp,
        x: p.position?.x ?? null,
        y: p.position?.y ?? null,
        currentGold: p.currentGold,
        totalGold: p.totalGold,
        xp: p.xp,
        level: p.level,
        minionsKilled: p.minionsKilled,
        jungleMinionsKilled: p.jungleMinionsKilled,
      });
    }
    for (const e of frame.events) {
      if (!kept.has(e.type)) continue;
      events.push({
        seq: events.length,
        type: e.type as TimelineEventType,
        timestampMs: e.timestamp,
        participantId: participantOrNull(e.participantId ?? e.killerId ?? e.creatorId),
        victimId: participantOrNull(e.victimId),
        teamId: e.teamId ?? e.killerTeamId,
        x: e.position?.x ?? null,
        y: e.position?.y ?? null,
        itemId: e.type === "ITEM_UNDO" ? e.beforeId : e.itemId,
        afterItemId: e.type === "ITEM_UNDO" ? e.afterId : null,
        skillSlot: e.skillSlot,
        levelUpType: e.levelUpType,
        monsterType: e.monsterType,
        monsterSubType: e.monsterSubType,
        buildingType: e.buildingType,
        laneType: e.laneType,
        towerType: e.towerType,
        wardType: e.wardType,
        assistingParticipantIds:
          e.assistingParticipantIds?.filter((id) => participantOrNull(id)) ?? null,
      });
    }
  });
  return { matchId: metadata.matchId, frames, events };
}
