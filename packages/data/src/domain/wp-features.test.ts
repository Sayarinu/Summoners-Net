import { describe, expect, it } from "vitest";
import timeline from "../../tests/riot/timeline-euw1.json" with { type: "json" };
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import { extractFeatures, type FeatureEvent, type FeatureFrame } from "./wp-features.js";

const teams = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 100 : 200]));
const parsed = parseRiotTimeline(timeline, "EUW1_7612345678");
const frames: FeatureFrame[] = parsed.frames;
const events: FeatureEvent[] = parsed.events;

describe("win probability features", () => {
  it("computes blue-minus-red differences and cumulative objectives from the fixture timeline", () => {
    const rows = extractFeatures(frames, events, teams, true);
    expect(rows.map((r) => r.minute)).toEqual([0, 1, 2]);
    // Minute 0: every participant has 500 gold and no experience.
    expect(rows[0]).toMatchObject({ minute: 0, goldDiff: 0, xpDiff: 0, csDiff: 0, blueWin: true });
    // State is taken at each frame's time: the kill (98 s) and fire dragon (110 s) happen after
    // the minute-1 frame and first count at minute 2.
    expect(rows[1]!.blue).toMatchObject({ kills: 0, dragons: { FIRE_DRAGON: 0 } });
    expect(rows[2]!.blue).toMatchObject({ kills: 1, dragons: { FIRE_DRAGON: 1 } });
    expect(rows[2]!.red.kills).toBe(0);
    // Minions destroy blue's outer mid tower at 125 s, after the last frame: no row counts it.
    expect(rows[2]!.red.towers).toBe(0);
    // Participant 3's minute-2 frame has no position but full statistics: differences stand.
    expect(rows[2]!.goldDiff).toBe(0);
  });
  it("leaves frame differences null when a participant's frame is missing, never zero", () => {
    const missing = frames.filter((f) => !(f.minute === 1 && f.participantId === 7));
    const rows = extractFeatures(missing, events, teams, null);
    expect(rows[1]).toMatchObject({ goldDiff: null, xpDiff: null, csDiff: null, blueWin: null });
    // Event counts do not depend on frames and still accumulate.
    expect(rows[2]).toMatchObject({ goldDiff: 0, blue: { kills: 1 } });
    const unknownGold = frames.map((f) =>
      f.minute === 2 && f.participantId === 1 ? { ...f, totalGold: null } : f,
    );
    expect(extractFeatures(unknownGold, events, teams, true)[2]!.goldDiff).toBeNull();
  });
  it("counts barons, elders, inhibitors and soul, and ignores events after the frame", () => {
    const at = (timestampMs: number, e: Partial<FeatureEvent>): FeatureEvent => ({
      type: "ELITE_MONSTER_KILL",
      timestampMs,
      participantId: 1,
      victimId: null,
      teamId: 200,
      monsterType: null,
      monsterSubType: null,
      buildingType: null,
      ...e,
    });
    const rows = extractFeatures(
      frames,
      [
        at(30000, { monsterType: "BARON_NASHOR" }),
        at(31000, { monsterType: "DRAGON", monsterSubType: "ELDER_DRAGON" }),
        at(32000, { type: "BUILDING_KILL", teamId: 100, buildingType: "INHIBITOR_BUILDING" }),
        at(33000, { type: "DRAGON_SOUL_GIVEN" }),
        at(200000, { monsterType: "BARON_NASHOR" }),
      ],
      teams,
      false,
    );
    expect(rows[1]!.red).toMatchObject({ barons: 1, elders: 1, inhibitors: 1, soul: true });
    expect(rows[2]!.red.barons).toBe(1);
  });
});
