import { describe, expect, it } from "vitest";
import fixture from "../../tests/riot/timeline-euw1.json" with { type: "json" };
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import {
  inferJunglePath,
  jungleSide,
  laneOf,
  normalize,
  type JunglerTimeline,
} from "./jungle-paths.js";

type Position = { x: number; y: number } | null;
interface Kill {
  timestamp: number;
  killerId: number;
  victimId: number;
  assistingParticipantIds?: number[];
  position?: { x: number; y: number };
}

/**
 * The stored fixture timeline with a minute 3 frame added, the jungler's minute 1-3 positions
 * moved to the given points and its champion kills replaced.
 */
function timeline(participantId: number, positions: Position[], kills: Kill[]) {
  const copy = structuredClone(fixture) as unknown as {
    info: { frames: { timestamp: number; events: unknown[]; participantFrames: object }[] };
  };
  const last = copy.info.frames.at(-1)!;
  copy.info.frames.push({ ...structuredClone(last), timestamp: 180022, events: [] });
  positions.forEach((position, i) => {
    const frame = copy.info.frames[i + 1]!.participantFrames as Record<
      string,
      { position?: { x: number; y: number } }
    >;
    if (position) frame[String(participantId)]!.position = position;
    else delete frame[String(participantId)]!.position;
  });
  for (const frame of copy.info.frames)
    frame.events = frame.events.filter((e) => (e as { type: string }).type !== "CHAMPION_KILL");
  copy.info.frames[1]!.events.push(...kills.map((k) => ({ type: "CHAMPION_KILL", ...k })));
  const parsed = parseRiotTimeline(copy, "EUW1_7612345678");
  const game: JunglerTimeline = {
    participantId,
    side: participantId <= 5 ? "blue" : "red",
    frames: parsed.frames.filter((f) => f.participantId === participantId),
    kills: parsed.events
      .filter((e) => e.type === "CHAMPION_KILL")
      .map((e) => ({
        timestampMs: e.timestampMs,
        x: e.x,
        y: e.y,
        killerId: e.participantId,
        assistingParticipantIds: e.assistingParticipantIds,
      })),
  };
  return game;
}

// Blue side's camps (https://hextechdocs.dev/map-data/), and red side's opposite numbers.
const blueBuff = { x: 3871, y: 7901 };
const wolves = { x: 3783, y: 6495 };
const redBuff = { x: 7862, y: 4111 };
const raptors = { x: 6943, y: 5422 };
const redSideBlueBuff = { x: 10931, y: 6990 };
const redSideRedBuff = { x: 7016, y: 10775 };
const topLane = { x: 1600, y: 10500 };
const botLane = { x: 11500, y: 1300 };

describe("jungle path rules", () => {
  it("rotates red side onto blue side and splits the jungle at the mid diagonal", () => {
    expect(normalize(redSideBlueBuff, "red")).toEqual({ x: 3819, y: 7870 });
    expect(normalize(blueBuff, "blue")).toEqual(blueBuff);
    expect(jungleSide(blueBuff)).toEqual({ side: "blue-buff", confidence: "high" });
    expect(jungleSide(redBuff)).toEqual({ side: "red-buff", confidence: "high" });
    expect(jungleSide(raptors)).toEqual({ side: "red-buff", confidence: "low" });
    expect(jungleSide({ x: 6000, y: 6300 })).toBeNull();
    expect(jungleSide(redSideRedBuff)).toEqual({ side: "invade", confidence: "high" });
    expect(jungleSide({ x: 8000, y: 8000 })).toEqual({ side: "invade", confidence: "low" });
  });
  it("names lanes and leaves bases and the jungle unknown", () => {
    expect(laneOf(topLane)).toBe("top");
    expect(laneOf({ x: 5000, y: 13500 })).toBe("top");
    expect(laneOf(botLane)).toBe("bot");
    expect(laneOf({ x: 13400, y: 6000 })).toBe("bot");
    expect(laneOf({ x: 7400, y: 7300 })).toBe("mid");
    expect(laneOf({ x: 1000, y: 1000 })).toBeNull();
    expect(laneOf({ x: 13800, y: 13900 })).toBeNull();
    expect(laneOf(wolves)).toBeNull();
  });
});

describe("inferJunglePath on fixture timelines", () => {
  it("infers a blue-buff start, a cross clear and a top gank by the jungler", () => {
    const path = inferJunglePath(
      timeline(
        2,
        [blueBuff, wolves, raptors],
        [
          { timestamp: 200000, killerId: 2, victimId: 8, position: { x: 2000, y: 4000 } },
          { timestamp: 230000, killerId: 2, victimId: 8, position: topLane },
        ],
      ),
    );
    // The first kill is in the jungle, not a lane, so it is not the first gank.
    expect(path).toEqual({
      startSide: "blue-buff",
      startConfidence: "high",
      route: "cross",
      gankLane: "top",
      gankConfidence: "high",
      gankMinute: 3,
      path: [blueBuff, wolves, raptors],
    });
  });
  it("reads a red-side jungler from blue side, with an assisted bot gank at low confidence", () => {
    const path = inferJunglePath(
      timeline(
        7,
        [redSideRedBuff, { x: 7500, y: 9500 }, { x: 6900, y: 10000 }],
        [
          {
            timestamp: 300000,
            killerId: 9,
            victimId: 4,
            assistingParticipantIds: [7],
            position: normalize(botLane, "red"),
          },
        ],
      ),
    );
    expect(path).toMatchObject({
      startSide: "red-buff",
      route: "same-side",
      gankLane: "bot",
      gankConfidence: "low",
      gankMinute: 5,
    });
    expect(path.path[0]).toEqual(normalize(redSideRedBuff, "red"));
  });
  it("marks an invade and leaves a missing frame, a mid start and late kills unknown", () => {
    expect(inferJunglePath(timeline(2, [blueBuff, null, redSideRedBuff], []))).toMatchObject({
      startSide: "blue-buff",
      route: "invade",
      gankLane: null,
      gankConfidence: null,
      path: [blueBuff, null, redSideRedBuff],
    });
    expect(
      inferJunglePath(
        timeline(
          2,
          [null, wolves, raptors],
          [
            { timestamp: 700000, killerId: 2, victimId: 8, position: topLane },
            { timestamp: 300000, killerId: 3, victimId: 8, position: topLane },
          ],
        ),
      ),
    ).toMatchObject({ startSide: null, startConfidence: null, route: null, gankLane: null });
    expect(inferJunglePath(timeline(2, [{ x: 6000, y: 6300 }, wolves, wolves], []))).toMatchObject({
      startSide: null,
      route: null,
    });
  });
});
