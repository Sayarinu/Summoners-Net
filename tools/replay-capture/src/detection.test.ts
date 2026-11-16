import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { expect, it } from "vitest";
import { worldToPixel } from "@summonersnet/ui/map-coordinates";
import { detectMinimapFrames, type DetectionInput } from "./detection.js";
import positions from "../tests/detection/positions.json" with { type: "json" };

const fixture = (name: string) =>
  readFile(new URL("../tests/detection/" + name + ".png", import.meta.url));
async function input(names = ["normal"]): Promise<DetectionInput> {
  return {
    mapId: 11,
    patch: "16.22",
    portraits: await Promise.all(
      Array.from({ length: 10 }, async (_, i) => ({
        participantId: i + 1,
        championId: i + 1,
        patch: "16.22",
        png: await fixture("portrait-" + (i + 1)),
      })),
    ),
    frames: await Promise.all(
      names.map(async (name, i) => ({ timeMs: 1000 + i * 200, png: await fixture(name) })),
    ),
  };
}
const settings = { iconSizes: [7] };
it("matches only ten roster portraits and returns pixel/world coordinates with measured scores", async () => {
  const result = await detectMinimapFrames(await input(), settings);
  expect(result).toHaveLength(1);
  expect(result[0]!.positions).toHaveLength(10);
  for (const known of positions) {
    const found = result[0]!.positions.find((p) => p.participantId === known.participantId)!;
    expect(found.championId).toBe(known.championId);
    expect(found.rejected).toBeNull();
    expect(found.position!.pixel).toEqual({ x: known.x, y: known.y });
    expect(found.confidence).toBeCloseTo(1);
    expect(worldToPixel(found.position!, 64, 48)!.x).toBeCloseTo(known.x);
    expect(worldToPixel(found.position!, 64, 48)!.y).toBeCloseTo(known.y);
  }
  const unknown = await detectMinimapFrames(await input(["unknown"]), settings);
  expect(unknown[0]!.positions[0]!.position).toBeNull();
  expect(unknown[0]!.positions.map((p) => p.championId)).not.toContain(11);
});
it("searches calibrated scales, masks borders, and applies configurable confidence and ambiguity gates", async () => {
  const scaled = await detectMinimapFrames(await input(["scaled"]), {
    ...settings,
    iconSizes: [7, 9],
  });
  expect(scaled[0]!.positions[0]!.position!.pixel).toEqual({ x: 6.5, y: 6.5 });
  const duplicate = await detectMinimapFrames(await input(["duplicate"]), settings);
  expect(duplicate[0]!.positions[0]).toMatchObject({ position: null, rejected: "ambiguous" });
  expect(duplicate[0]!.positions[0]!.confidence).toBeCloseTo(1);
  const occluded = await detectMinimapFrames(await input(["occluded"]), settings);
  expect(occluded[0]!.positions[0]).toMatchObject({ position: null, rejected: "weak" });
  expect(occluded[0]!.positions[0]!.confidence).toBeGreaterThan(0);
  const strict = await detectMinimapFrames(await input(), { ...settings, ambiguityMargin: 1 });
  expect(strict[0]!.positions.every((p) => p.position === null)).toBe(true);
  const blank = await detectMinimapFrames(await input(["blank"]), { ...settings, threshold: 0 });
  expect(blank[0]!.positions.every((p) => p.position === null && p.confidence === 0)).toBe(true);
});
it("rejects colliding champion claims without assigning a hidden champion to a guessed location", async () => {
  const data = await input();
  data.portraits[1]!.png = data.portraits[0]!.png;
  const result = await detectMinimapFrames(data, settings);
  expect(result[0]!.positions.slice(0, 2).map((p) => p.rejected)).toEqual(["overlap", "overlap"]);
  expect(result[0]!.positions.slice(0, 2).every((p) => p.position === null)).toBe(true);
});
it("turns an isolated jump into a scored null but preserves sustained moves and gaps", async () => {
  const jumped = await detectMinimapFrames(await input(["normal", "jump", "normal"]), settings);
  expect(jumped[1]!.positions[0]).toMatchObject({ position: null, rejected: "temporal-jump" });
  expect(jumped[1]!.positions[0]!.confidence).toBeCloseTo(1);
  expect(jumped[0]!.positions[0]!.position).not.toBeNull();
  expect(jumped[2]!.positions[0]!.position).not.toBeNull();
  const sustained = await detectMinimapFrames(await input(["normal", "jump", "jump"]), settings);
  expect(sustained[1]!.positions[0]!.position!.pixel).toEqual({ x: 53.5, y: 35.5 });
  const missing = await detectMinimapFrames(await input(["normal", "blank", "normal"]), settings);
  expect(missing[1]!.positions.every((p) => p.position === null)).toBe(true);
  const separated = await input(["normal", "jump", "normal"]);
  separated.frames.forEach((f, i) => {
    f.timeMs = i * 2000;
  });
  expect(
    (await detectMinimapFrames(separated, settings))[1]!.positions[0]!.position,
  ).not.toBeNull();
});
it("validates roster, patch, bounds, timestamps and options at the entry point", async () => {
  const data = await input();
  for (const invalid of [
    { ...data, mapId: 12 },
    { ...data, patch: "latest" },
    { ...data, portraits: data.portraits.slice(1) },
    { ...data, portraits: [...data.portraits.slice(1), data.portraits[1]] },
    { ...data, portraits: data.portraits.map((p) => ({ ...p, patch: "16.21" })) },
    { ...data, frames: [data.frames[0], data.frames[0]] },
    { ...data, frames: [{ timeMs: NaN, png: data.frames[0]!.png }] },
    { ...data, frames: [{ timeMs: 1, png: new Uint8Array() }] },
    { ...data, frames: [{ timeMs: 1, png: new Uint8Array(2 * 1024 * 1024 + 1) }] },
  ])
    await expect(detectMinimapFrames(invalid, settings)).rejects.toThrow();
  for (const invalid of [
    { iconSizes: [] },
    { iconSizes: [2] },
    { ...settings, threshold: NaN },
    { ...settings, threshold: 1.1 },
    { ...settings, ambiguityMargin: -1 },
    { ...settings, maxGapMs: 0 },
    { ...settings, jumpWorldUnits: 0 },
  ])
    await expect(detectMinimapFrames(data, invalid)).rejects.toThrow();
});
it("rejects invalid images, flat templates, oversized scales and inconsistent crops", async () => {
  const data = await input();
  const tiny = await sharp({ create: { width: 3, height: 3, channels: 3, background: "#111" } })
    .png()
    .toBuffer();
  for (const bytes of [
    Buffer.from("invalid"),
    await sharp(data.frames[0]!.png).jpeg().toBuffer(),
    await sharp({ create: { width: 1025, height: 1, channels: 3, background: "#111" } })
      .png()
      .toBuffer(),
  ]) {
    await expect(
      detectMinimapFrames({ ...data, frames: [{ timeMs: 1, png: bytes }] }, settings),
    ).rejects.toThrow();
  }
  await expect(
    detectMinimapFrames({ ...data, frames: [{ timeMs: 1, png: tiny }] }, settings),
  ).rejects.toThrow("fit");
  await expect(
    detectMinimapFrames(
      { ...data, portraits: data.portraits.map((p) => ({ ...p, png: tiny })) },
      settings,
    ),
  ).rejects.toThrow("flat");
  const resized = await sharp(data.frames[0]!.png).resize(63, 48).png().toBuffer();
  await expect(
    detectMinimapFrames(
      { ...data, frames: [...data.frames, { timeMs: 2000, png: resized }] },
      settings,
    ),
  ).rejects.toThrow("identical");
});
