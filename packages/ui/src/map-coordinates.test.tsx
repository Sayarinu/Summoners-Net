import { expect, it } from "vitest";
import { pixelToWorld, worldToPixel } from "./map-coordinates.js";

it("inverts the map transform at corners, centre and a non-square image", () => {
  expect(pixelToWorld({ x: 0, y: 512 }, 512)).toEqual({ x: -120, y: -120 });
  expect(pixelToWorld({ x: 512, y: 0 }, 512)).toEqual({ x: 14870, y: 14980 });
  expect(pixelToWorld({ x: 400, y: 200 }, 800, 400)).toEqual({ x: 7375, y: 7430 });
  const world = { x: 5846, y: 6396 };
  const pixel = worldToPixel(world, 512)!;
  expect(pixelToWorld(pixel, 512)!.x).toBeCloseTo(world.x);
  expect(pixelToWorld(pixel, 512)!.y).toBeCloseTo(world.y);
});
it("rejects missing, non-finite, out-of-bounds pixels and invalid dimensions", () => {
  for (const pixel of [
    { x: null, y: 0 },
    { x: 0, y: null },
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
    { x: -1, y: 0 },
    { x: 513, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 513 },
  ])
    expect(pixelToWorld(pixel, 512)).toBeNull();
  for (const size of [0, -1, NaN, Infinity]) {
    expect(pixelToWorld({ x: 0, y: 0 }, size)).toBeNull();
    expect(pixelToWorld({ x: 0, y: 0 }, 512, size)).toBeNull();
  }
});
