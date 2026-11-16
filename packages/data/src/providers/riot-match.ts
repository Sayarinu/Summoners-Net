import { z } from "zod";

// match-v5 MatchDto. Identifiers are required; every statistic is optional, because Riot omits
// fields across versions and modes. A missing field becomes null, never zero.
const int = z.number().int();
const count = int.min(0);
const optionalCount = count.nullish().transform((v) => v ?? null);
const optionalInt = int.nullish().transform((v) => v ?? null);
const optionalBool = z
  .boolean()
  .nullish()
  .transform((v) => v ?? null);
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => v ?? null);
const perkStyle = z.object({
  description: z.string().max(40),
  style: count,
  selections: z.array(z.object({ perk: count })).max(6),
});
const participant = z.object({
  participantId: int.min(1).max(10),
  puuid: z.string().min(20).max(100),
  teamId: z.union([z.literal(100), z.literal(200)]),
  championId: int.min(1),
  championName: optionalText(40),
  teamPosition: optionalText(20),
  win: optionalBool,
  kills: optionalCount,
  deaths: optionalCount,
  assists: optionalCount,
  champLevel: optionalCount,
  goldEarned: optionalCount,
  totalMinionsKilled: optionalCount,
  neutralMinionsKilled: optionalCount,
  totalDamageDealtToChampions: optionalCount,
  visionScore: optionalCount,
  summoner1Id: optionalInt,
  summoner2Id: optionalInt,
  gameEndedInEarlySurrender: optionalBool,
  item0: optionalInt,
  item1: optionalInt,
  item2: optionalInt,
  item3: optionalInt,
  item4: optionalInt,
  item5: optionalInt,
  item6: optionalInt,
  perks: z
    .object({
      statPerks: z
        .object({ defense: optionalInt, flex: optionalInt, offense: optionalInt })
        .nullish(),
      styles: z.array(perkStyle).max(2),
    })
    .nullish(),
});
const objective = z.object({ first: optionalBool, kills: optionalCount });
const matchSchema = z.object({
  metadata: z.object({
    matchId: z.string().regex(/^[A-Z0-9]{2,5}_\d{1,15}$/),
    dataVersion: optionalText(10),
  }),
  info: z.object({
    platformId: optionalText(10),
    queueId: optionalInt,
    mapId: optionalInt,
    gameVersion: z.string().min(1).max(40),
    gameCreation: count,
    gameStartTimestamp: count.nullish(),
    gameEndTimestamp: count.nullish(),
    gameDuration: count.nullish(),
    endOfGameResult: optionalText(40),
    participants: z.array(participant).min(1).max(10),
    teams: z
      .array(
        z.object({
          teamId: z.union([z.literal(100), z.literal(200)]),
          win: optionalBool,
          bans: z
            .array(z.object({ championId: int, pickTurn: count }))
            .max(10)
            .nullish(),
          objectives: z.record(z.string().regex(/^\w{1,30}$/), objective).nullish(),
        }),
      )
      .max(2),
  }),
});

export interface RiotMatch {
  matchId: string;
  dataVersion: string | null;
  platformId: string | null;
  queueId: number | null;
  mapId: number | null;
  gameVersion: string;
  createdAt: Date;
  startedAt: Date | null;
  durationSeconds: number | null;
  endOfGameResult: string | null;
  /** True when any participant's game ended in an early surrender (a remake). */
  remake: boolean | null;
  teams: {
    teamId: 100 | 200;
    side: "blue" | "red";
    win: boolean | null;
    bans: { championId: number; pickTurn: number }[];
    objectives: { name: string; first: boolean | null; kills: number | null }[];
  }[];
  participants: RiotParticipant[];
}
export interface RiotParticipant {
  participantId: number;
  puuid: string;
  teamId: 100 | 200;
  side: "blue" | "red";
  championId: number;
  championName: string | null;
  teamPosition: string | null;
  win: boolean | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  champLevel: number | null;
  goldEarned: number | null;
  totalMinionsKilled: number | null;
  neutralMinionsKilled: number | null;
  totalDamageDealtToChampions: number | null;
  visionScore: number | null;
  summoner1Id: number | null;
  summoner2Id: number | null;
  /** Final inventory by slot (0-6); empty slots and missing fields are omitted. */
  items: { slot: number; itemId: number }[];
  statPerks: { defense: number | null; flex: number | null; offense: number | null };
  perks: { style: "primary" | "sub"; styleId: number; slot: number; perkId: number }[];
}

const side = (teamId: 100 | 200) => (teamId === 100 ? "blue" : "red");

/** Validates a match-v5 payload for the requested match id. */
export function parseRiotMatch(input: unknown, matchId: string): RiotMatch {
  const { metadata, info } = matchSchema.parse(input);
  if (metadata.matchId !== matchId) throw new Error("Match payload is for another match.");
  const ids = info.participants.map((p) => p.participantId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate participant ids.");
  // Before patch 11.20 gameDuration was milliseconds; Riot marks the newer format with
  // gameEndTimestamp.
  const durationSeconds =
    info.gameDuration == null
      ? null
      : info.gameEndTimestamp != null
        ? info.gameDuration
        : Math.round(info.gameDuration / 1000);
  const surrenders = info.participants.map((p) => p.gameEndedInEarlySurrender);
  return {
    matchId: metadata.matchId,
    dataVersion: metadata.dataVersion,
    platformId: info.platformId,
    queueId: info.queueId,
    mapId: info.mapId,
    gameVersion: info.gameVersion,
    createdAt: new Date(info.gameCreation),
    startedAt: info.gameStartTimestamp != null ? new Date(info.gameStartTimestamp) : null,
    durationSeconds,
    endOfGameResult: info.endOfGameResult,
    remake: surrenders.some((s) => s === true)
      ? true
      : surrenders.every((s) => s === false)
        ? false
        : null,
    teams: info.teams.map((t) => ({
      teamId: t.teamId,
      side: side(t.teamId),
      win: t.win,
      bans: (t.bans ?? []).filter((b) => b.championId > 0),
      objectives: Object.entries(t.objectives ?? {}).map(([name, o]) => ({
        name,
        first: o.first,
        kills: o.kills,
      })),
    })),
    participants: info.participants.map((p): RiotParticipant => ({
      participantId: p.participantId,
      puuid: p.puuid,
      teamId: p.teamId,
      side: side(p.teamId),
      championId: p.championId,
      championName: p.championName,
      teamPosition: p.teamPosition || null,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      champLevel: p.champLevel,
      goldEarned: p.goldEarned,
      totalMinionsKilled: p.totalMinionsKilled,
      neutralMinionsKilled: p.neutralMinionsKilled,
      totalDamageDealtToChampions: p.totalDamageDealtToChampions,
      visionScore: p.visionScore,
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      items: ([0, 1, 2, 3, 4, 5, 6] as const).flatMap((slot) => {
        const itemId = p[`item${slot}`];
        return itemId ? [{ slot, itemId }] : [];
      }),
      statPerks: {
        defense: p.perks?.statPerks?.defense ?? null,
        flex: p.perks?.statPerks?.flex ?? null,
        offense: p.perks?.statPerks?.offense ?? null,
      },
      perks: (p.perks?.styles ?? []).flatMap((s) =>
        s.selections.map((selection, slot) => ({
          style: s.description === "primaryStyle" ? ("primary" as const) : ("sub" as const),
          styleId: s.style,
          slot,
          perkId: selection.perk,
        })),
      ),
    })),
  };
}
