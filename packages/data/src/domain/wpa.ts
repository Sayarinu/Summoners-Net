// Win probability added (WPA) per event. The rule, applied with one model:
//
// 1. State before the event: the economy (gold, XP and CS differences) from the latest minute
//    at or before the event, and every counted event before it. State after: the same economy
//    with this event counted too. The event's value is the change in the credited side's win
//    probability between the two. Holding the economy fixed isolates the event itself.
// 2. Split: the killer or objective taker gets half and assisters share the other half equally;
//    with no assisters the killer or taker gets all of it. A kill's victim is charged the
//    negative of the whole value. When the killer or taker is not a participant (a tower,
//    minions), only assisters and the victim receive values; with none, the event keeps its
//    team-level value only.
// 3. When the economy at the event is unknown, the value is null and nothing is split.
import { applyEvent, emptyCounts, type FeatureEvent, type FeatureRow } from "./wp-features.js";
import { predict, vectorize, type Coefficients } from "./wp-model.js";

export interface WpaEvent extends FeatureEvent {
  seq: number;
  assistingParticipantIds: number[] | null;
}
export interface EventWpa {
  seq: number;
  type: string;
  timestampMs: number;
  /** The side the event credits, from its own point of view; null if it credits no one. */
  team: "blue" | "red" | null;
  /** The credited side's change in win probability; null when it cannot be scored. */
  delta: number | null;
  participants: {
    participantId: number;
    role: "killer" | "taker" | "assister" | "victim";
    value: number;
  }[];
}
const scored = new Set(["CHAMPION_KILL", "BUILDING_KILL", "ELITE_MONSTER_KILL"]);

/** Scores every kill and objective event of a match against its per-minute economy rows. */
export function attributeEvents(
  rows: readonly FeatureRow[],
  events: readonly WpaEvent[],
  teams: ReadonlyMap<number, number>,
  model: Coefficients,
): EventWpa[] {
  const ordered = [...events].sort((a, b) => a.timestampMs - b.timestampMs || a.seq - b.seq);
  const economy = [...rows].sort((a, b) => a.timestampMs - b.timestampMs);
  const blue = emptyCounts();
  const red = emptyCounts();
  const blueChance = (minute: number, row: FeatureRow | undefined) => {
    if (!row) return null;
    const x = vectorize({
      ...row,
      minute,
      blue: structuredClone(blue),
      red: structuredClone(red),
    });
    return x ? predict(model, x) : null;
  };
  const results: EventWpa[] = [];
  for (const e of ordered) {
    const row = economy.filter((r) => r.timestampMs <= e.timestampMs).at(-1);
    const minute = e.timestampMs / 60000;
    const before = scored.has(e.type) ? blueChance(minute, row) : null;
    const team = applyEvent(blue, red, e, teams);
    if (!scored.has(e.type)) continue;
    const after = blueChance(minute, row);
    const delta =
      before === null || after === null || !team
        ? null
        : team === "blue"
          ? after - before
          : before - after;
    const participants: EventWpa["participants"] = [];
    if (delta !== null) {
      const actor = e.participantId;
      const assisters = (e.assistingParticipantIds ?? []).filter(
        (id) => teams.has(id) && id !== actor,
      );
      const actorShare = assisters.length ? delta / 2 : delta;
      if (actor !== null && teams.has(actor))
        participants.push({
          participantId: actor,
          role: e.type === "CHAMPION_KILL" ? "killer" : "taker",
          value: actorShare,
        });
      for (const id of assisters)
        participants.push({
          participantId: id,
          role: "assister",
          value: delta / 2 / assisters.length,
        });
      if (e.type === "CHAMPION_KILL" && e.victimId !== null && teams.has(e.victimId))
        participants.push({ participantId: e.victimId, role: "victim", value: -delta });
    }
    results.push({
      seq: e.seq,
      type: e.type,
      timestampMs: e.timestampMs,
      team,
      delta,
      participants,
    });
  }
  return results;
}
