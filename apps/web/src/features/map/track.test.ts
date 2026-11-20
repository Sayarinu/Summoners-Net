import { expect, it } from "vitest";
import { staleAfterMs, trackPositionAt, trailAt } from "./track";

const sample = (timeMs: number, x: number | null, confidence: number | null) => ({
  timeMs,
  positions: [
    { participantId: 1, x, y: x, confidence },
    { participantId: 2, x: null, y: null, confidence: null },
  ],
});
const samples = [
  sample(0, 1000, 0.9),
  sample(500, 1100, 0.3),
  sample(1000, null, 0.2),
  sample(1500, 1300, null),
  sample(5000, 2000, 0.8),
];

it("shows the latest current sample, never interpolated, with low confidence flagged", () => {
  expect(trackPositionAt(samples, 1, 250, 1000)).toEqual({
    x: 1000,
    y: 1000,
    confidence: 0.9,
    low: false,
  });
  expect(trackPositionAt(samples, 1, 600, 1000)).toMatchObject({ x: 1100, low: true });
  expect(trackPositionAt(samples, 1, 1500, 1000)).toMatchObject({ x: 1300, low: true });
  // A null observation and a stale sample are gaps.
  expect(trackPositionAt(samples, 1, 1200, 1000)).toBeNull();
  expect(trackPositionAt(samples, 1, 3000, 1000)).toBeNull();
  expect(trackPositionAt(samples, 2, 0, 1000)).toBeNull();
  expect(trackPositionAt(samples, 1, -1, 1000)).toBeNull();
  expect(trackPositionAt([], 1, 0, 1000)).toBeNull();
});
it("keeps the last ten seconds as a trail with gaps, and scales staleness with the rate", () => {
  expect(trailAt(samples, 1, 1500)).toEqual([
    { x: 1000, y: 1000 },
    { x: 1100, y: 1100 },
    { x: null, y: null },
    { x: 1300, y: 1300 },
  ]);
  expect(trailAt(samples, 1, 12000)).toEqual([{ x: 2000, y: 2000 }]);
  expect(trailAt(samples, 3, 0)).toEqual([{ x: null, y: null }]);
  expect(staleAfterMs(4)).toBe(1000);
  expect(staleAfterMs(1)).toBe(1500);
});
