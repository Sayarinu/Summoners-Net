import { describe, expect, it } from "vitest";
import fixture from "../../tests/riot/timeline-euw1.json" with { type: "json" };
import { parseRiotTimeline } from "./riot-timeline.js";

const id = "EUW1_7612345678";
describe("match-v5 timeline parser", () => {
  const timeline = parseRiotTimeline(fixture, id);
  it("keeps per-minute frames with positions, and null where Riot omits a position", () => {
    expect(timeline.frames).toHaveLength(30);
    expect(timeline.frames[0]).toEqual({
      participantId: 1,
      minute: 0,
      timestampMs: 0,
      x: 600,
      y: 500,
      currentGold: 500,
      totalGold: 500,
      xp: 0,
      level: 1,
      minionsKilled: 0,
      jungleMinionsKilled: 0,
    });
    const missing = timeline.frames.find((f) => f.minute === 2 && f.participantId === 3)!;
    expect(missing).toMatchObject({ x: null, y: null, level: 3 });
  });
  it("keeps kills, objectives, wards, items and skill-ups in order, skipping other events", () => {
    expect(timeline.events.map((e) => e.type)).toEqual([
      "ITEM_PURCHASED",
      "ITEM_PURCHASED",
      "ITEM_UNDO",
      "SKILL_LEVEL_UP",
      "WARD_PLACED",
      "CHAMPION_KILL",
      "ELITE_MONSTER_KILL",
      "BUILDING_KILL",
      "SKILL_LEVEL_UP",
      "GAME_END",
    ]);
    expect(timeline.events.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(timeline.events[2]).toMatchObject({ participantId: 1, itemId: 2003, afterItemId: 0 });
    expect(timeline.events[4]).toMatchObject({
      participantId: 5,
      wardType: "YELLOW_TRINKET",
      x: null,
      y: null,
    });
    expect(timeline.events[5]).toMatchObject({
      participantId: 2,
      victimId: 7,
      x: 7200,
      y: 7100,
      assistingParticipantIds: [1, 4],
    });
    expect(timeline.events[6]).toMatchObject({ teamId: 100, monsterSubType: "FIRE_DRAGON" });
    // A tower killed by minions has no participant killer.
    expect(timeline.events[7]).toMatchObject({
      participantId: null,
      teamId: 200,
      laneType: "MID_LANE",
    });
  });
  it("rejects a timeline for another match or with mismatched frame keys", () => {
    expect(() => parseRiotTimeline(fixture, "EUW1_1")).toThrow("another match");
    const broken = structuredClone(fixture);
    broken.info.frames[0]!.participantFrames["1"].participantId = 2;
    expect(() => parseRiotTimeline(broken, id)).toThrow("mismatch");
    const noFrames = structuredClone(fixture);
    noFrames.info.frames = [];
    expect(() => parseRiotTimeline(noFrames, id)).toThrow();
  });
});
