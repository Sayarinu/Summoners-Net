// Win probability features: the game state at each minute, from blue side's point of view,
// computed only from stored timeline frames and events. Bump the version whenever the
// definition changes, so a model can say which features it was trained on.
export const featureVersion = 1;
export const dragonTypes = [
  "AIR_DRAGON",
  "CHEMTECH_DRAGON",
  "EARTH_DRAGON",
  "FIRE_DRAGON",
  "HEXTECH_DRAGON",
  "WATER_DRAGON",
] as const;
export type DragonCounts = Record<(typeof dragonTypes)[number], number>;
export interface TeamCounts {
  kills: number;
  towers: number;
  inhibitors: number;
  barons: number;
  elders: number;
  dragons: DragonCounts;
  soul: boolean;
}
export interface FeatureRow {
  minute: number;
  timestampMs: number;
  /** Blue minus red; null when any participant's frame is missing for this minute. */
  goldDiff: number | null;
  xpDiff: number | null;
  csDiff: number | null;
  blue: TeamCounts;
  red: TeamCounts;
  /** Whether blue won; null when the result is unknown. */
  blueWin: boolean | null;
}
export interface FeatureFrame {
  minute: number;
  timestampMs: number;
  participantId: number;
  totalGold: number | null;
  xp: number | null;
  minionsKilled: number | null;
  jungleMinionsKilled: number | null;
}
export interface FeatureEvent {
  type: string;
  timestampMs: number;
  participantId: number | null;
  victimId: number | null;
  teamId: number | null;
  monsterType: string | null;
  monsterSubType: string | null;
  buildingType: string | null;
}

const emptyCounts = (): TeamCounts => ({
  kills: 0,
  towers: 0,
  inhibitors: 0,
  barons: 0,
  elders: 0,
  dragons: Object.fromEntries(dragonTypes.map((t) => [t, 0])) as DragonCounts,
  soul: false,
});

/**
 * One row per minute that has frames. Event counts are cumulative up to the minute's frame time.
 * teams maps participant id to team id (100 blue, 200 red).
 */
export function extractFeatures(
  frames: readonly FeatureFrame[],
  events: readonly FeatureEvent[],
  teams: ReadonlyMap<number, number>,
  blueWin: boolean | null,
): FeatureRow[] {
  const minutes = new Map<number, FeatureFrame[]>();
  for (const f of frames) minutes.set(f.minute, [...(minutes.get(f.minute) ?? []), f]);
  const ordered = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
  const blue = emptyCounts();
  const red = emptyCounts();
  const side = (team: number | null) => (team === 100 ? blue : team === 200 ? red : null);
  const other = (team: number | null) => (team === 100 ? red : team === 200 ? blue : null);
  let next = 0;
  const rows: FeatureRow[] = [];
  for (const minute of [...minutes.keys()].sort((a, b) => a - b)) {
    const minuteFrames = minutes.get(minute)!;
    const timestampMs = Math.max(...minuteFrames.map((f) => f.timestampMs));
    for (; next < ordered.length && ordered[next]!.timestampMs <= timestampMs; next++) {
      const e = ordered[next]!;
      if (e.type === "CHAMPION_KILL") {
        // Credit the kill to the victim's opponents, even when a tower or minion executed them.
        const team = other(e.victimId === null ? null : (teams.get(e.victimId) ?? null));
        if (team) team.kills++;
      } else if (e.type === "BUILDING_KILL") {
        // A building event names the team that owned the building.
        const team = other(e.teamId);
        if (team && e.buildingType === "TOWER_BUILDING") team.towers++;
        if (team && e.buildingType === "INHIBITOR_BUILDING") team.inhibitors++;
      } else if (e.type === "ELITE_MONSTER_KILL") {
        const team = side(e.teamId);
        if (!team) continue;
        if (e.monsterType === "BARON_NASHOR") team.barons++;
        else if (e.monsterType === "DRAGON" && e.monsterSubType === "ELDER_DRAGON") team.elders++;
        else if (e.monsterType === "DRAGON" && e.monsterSubType && e.monsterSubType in team.dragons)
          team.dragons[e.monsterSubType as keyof DragonCounts]++;
      } else if (e.type === "DRAGON_SOUL_GIVEN") {
        const team = side(e.teamId);
        if (team) team.soul = true;
      }
    }
    const totals = (team: number, pick: (f: FeatureFrame) => number | null) => {
      const values = minuteFrames.filter((f) => teams.get(f.participantId) === team).map(pick);
      return values.length === 5 && values.every((v) => v !== null)
        ? values.reduce<number>((n, v) => n + v, 0)
        : null;
    };
    const diff = (pick: (f: FeatureFrame) => number | null) => {
      const b = totals(100, pick);
      const r = totals(200, pick);
      return b === null || r === null ? null : b - r;
    };
    rows.push({
      minute,
      timestampMs,
      goldDiff: diff((f) => f.totalGold),
      xpDiff: diff((f) => f.xp),
      csDiff: diff((f) =>
        f.minionsKilled === null || f.jungleMinionsKilled === null
          ? null
          : f.minionsKilled + f.jungleMinionsKilled,
      ),
      blue: structuredClone(blue),
      red: structuredClone(red),
      blueWin,
    });
  }
  return rows;
}
