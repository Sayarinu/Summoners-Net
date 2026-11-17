import { describe, expect, it } from "vitest";
import { detectMovements, zoneOf, type TrackInput } from "./track-movements.js";

const mid = { x: 7000, y: 7000 };
const bot = { x: 10000, y: 1000 };
const top = { x: 1000, y: 10000 };
const jungle = { x: 4000, y: 6500 };
const blueBase = { x: 500, y: 500 };

type Segment = [fromS: number, toS: number, point: { x: number; y: number } | null, score?: number];
/** One-hertz samples for participants 1-10 (1-5 blue, 6-10 red) following the given segments. */
function track(paths: Record<number, Segment[]>): TrackInput {
  const roster = Array.from({ length: 10 }, (_, i) => ({
    participantId: i + 1,
    teamId: i < 5 ? 100 : 200,
  }));
  const end = Math.max(0, ...Object.values(paths).flatMap((s) => s.map((x) => x[1])));
  return {
    roster,
    samples: Array.from({ length: end + 1 }, (_, t) => ({
      timeMs: t * 1000,
      positions: roster.map(({ participantId }) => {
        const segment = (paths[participantId] ?? []).find(([a, b]) => t >= a && t <= b);
        return {
          participantId,
          position: segment?.[2] ?? null,
          confidence: segment?.[2] ? (segment[3] ?? 0.9) : null,
        };
      }),
    })),
  };
}

describe("track zones", () => {
  it("names bases, lanes and the jungle in absolute coordinates", () => {
    expect([blueBase, { x: 14300, y: 14400 }, mid, top, bot, jungle].map(zoneOf)).toEqual([
      "blue-base",
      "red-base",
      "mid",
      "top",
      "bot",
      "jungle",
    ]);
    expect(zoneOf({ x: 5000, y: 13500 })).toBe("top");
    expect(zoneOf({ x: 13500, y: 5000 })).toBe("bot");
  });
});

describe("detectMovements", () => {
  it("detects a recall as a quick jump into the own base, not a slow return or an enemy base", () => {
    const movements = detectMovements(
      track({
        1: [
          [0, 20, mid],
          [21, 30, blueBase],
        ],
        // A six-second gap before reaching base (a death and respawn) is not a recall.
        2: [
          [0, 20, mid],
          [27, 30, blueBase],
        ],
        // A red champion in blue's base has not recalled.
        6: [
          [0, 20, mid],
          [21, 30, blueBase],
        ],
      }),
    );
    expect(movements).toEqual([
      {
        kind: "recall",
        startMs: 20000,
        endMs: 21000,
        teamId: 100,
        participantIds: [1],
        from: "mid",
        to: "blue-base",
      },
    ]);
  });
  it("ignores low-confidence samples", () => {
    expect(
      detectMovements(
        track({
          1: [
            [0, 20, mid],
            [21, 30, blueBase, 0.3],
          ],
        }),
      ),
    ).toEqual([]);
  });
  it("detects a roam from a lane held for 30 seconds into another lane held for 10", () => {
    const movements = detectMovements(
      track({
        1: [
          [0, 40, mid],
          [41, 50, jungle],
          [51, 65, bot],
        ],
        // Only 20 seconds in mid first: not a roam.
        2: [
          [0, 20, mid],
          [21, 40, bot],
        ],
        // Passing through base in between is a recall and a new lane, not a roam.
        3: [
          [0, 40, top],
          [41, 41, mid],
          [42, 45, blueBase],
          [46, 60, bot],
        ],
        // Five seconds in the new lane is too short.
        4: [
          [0, 40, top],
          [41, 45, mid],
        ],
      }),
    );
    expect(movements.filter((m) => m.kind === "roam")).toEqual([
      {
        kind: "roam",
        startMs: 40000,
        endMs: 51000,
        teamId: 100,
        participantIds: [1],
        from: "mid",
        to: "bot",
      },
    ]);
  });
  it("groups three teammates' roams to the same lane into one rotation", () => {
    const movements = detectMovements(
      track({
        1: [
          [0, 40, mid],
          [45, 70, bot],
        ],
        2: [
          [0, 40, top],
          [50, 70, bot],
        ],
        3: [
          [0, 45, mid],
          [60, 75, bot],
        ],
        // A fourth teammate arriving later roams on its own.
        4: [
          [0, 50, top],
          [80, 95, bot],
        ],
        // Two red champions moving together are two roams, not a rotation.
        6: [
          [0, 40, top],
          [45, 60, mid],
        ],
        7: [
          [0, 40, bot],
          [46, 60, mid],
        ],
      }),
    );
    expect(movements.map((m) => [m.kind, m.teamId, m.participantIds, m.from, m.to])).toEqual([
      // Ties at 0:40 order by kind.
      ["roam", 200, [6], "top", "mid"],
      ["roam", 200, [7], "bot", "mid"],
      ["rotation", 100, [1, 2, 3], null, "bot"],
      ["roam", 100, [4], "top", "bot"],
    ]);
    expect(movements[2]).toMatchObject({ startMs: 40000, endMs: 60000 });
  });
});
