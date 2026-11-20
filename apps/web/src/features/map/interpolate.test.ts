import { expect, it } from "vitest";
import { clock, positionAt, timelineEnd } from "./interpolate";

const frames = [
  { minute: 0, timestampMs: 0, x: 600, y: 500 },
  { minute: 1, timestampMs: 60000, x: 1200, y: 1100 },
  { minute: 2, timestampMs: null, x: null, y: null },
  { minute: 3, timestampMs: 180000, x: null, y: null },
  { minute: 4, timestampMs: 240000, x: 3000, y: 3000 },
];

it("returns stored frames exactly and interpolates between them", () => {
  expect(positionAt(frames, 0)).toEqual({ x: 600, y: 500, basis: "frame" });
  expect(positionAt(frames, 30000)).toEqual({ x: 900, y: 800, basis: "interpolated" });
  expect(positionAt(frames, 60000)).toEqual({ x: 1200, y: 1100, basis: "frame" });
  expect(positionAt(frames, 240000)).toEqual({ x: 3000, y: 3000, basis: "frame" });
});
it("leaves a gap around missing frames and missing coordinates instead of the origin", () => {
  expect(positionAt(frames, 90000)).toBeNull();
  expect(positionAt(frames, 120000)).toBeNull();
  expect(positionAt(frames, 200000)).toBeNull();
  expect(positionAt(frames, 250000)).toBeNull();
  expect(positionAt([], 0)).toBeNull();
  expect(positionAt(frames, -1)).toBeNull();
});
it("ends the scrubber at the last frame and formats times", () => {
  expect(timelineEnd([{ frames }, { frames: [] }])).toBe(240000);
  expect(timelineEnd([])).toBe(0);
  expect(clock(98000)).toBe("1:38");
});
