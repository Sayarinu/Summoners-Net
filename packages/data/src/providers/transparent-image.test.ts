import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, it } from "vitest";
import { transparentImage } from "./transparent-image.js";

function asset(body: Buffer) {
  return { body, mime: "image/png", hash: createHash("sha256").update(body).digest("hex") };
}
function studioPixels() {
  const data = Buffer.alloc(16 * 16 * 3, 255);
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++)
      for (let channel = 0; channel < 3; channel++) data[(y * 16 + x) * 3 + channel] = 30;
  // White detail enclosed by the subject must remain opaque.
  for (let y = 5; y < 11; y++)
    for (let x = 5; x < 11; x++) data.fill(255, (y * 16 + x) * 3, (y * 16 + x) * 3 + 3);
  data.fill(235, (8 * 16 + 1) * 3, (8 * 16 + 1) * 3 + 3);
  return data;
}

it("removes edge-connected studio backgrounds, preserves enclosed white details and hashes the rendition", async () => {
  const original = asset(
    await sharp(studioPixels(), { raw: { width: 16, height: 16, channels: 3 } })
      .png()
      .toBuffer(),
  );
  const rendered = await transparentImage(original);
  const pixels = await sharp(rendered.body).raw().toBuffer();
  expect(rendered.hash).not.toBe(original.hash);
  expect(rendered.hash).toBe(createHash("sha256").update(rendered.body).digest("hex"));
  expect(rendered.mime).toBe("image/png");
  expect(pixels[3]).toBe(0);
  expect(pixels[(8 * 16 + 8) * 4 + 3]).toBe(255);
  expect([...pixels.subarray((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 3)]).toEqual([255, 255, 255]);
  expect(pixels[(8 * 16 + 1) * 4 + 3]).toBeGreaterThan(0);
  expect(pixels[(8 * 16 + 1) * 4 + 3]).toBeLessThan(255);
  expect(await transparentImage(rendered)).toBe(rendered);
});

it("rejects malformed images and backgrounds that cannot be removed confidently", async () => {
  const studio = studioPixels();
  studio[0] = 0;
  const nonuniform = await sharp(studio, { raw: { width: 16, height: 16, channels: 3 } })
    .png()
    .toBuffer();
  const empty = await sharp({ create: { width: 16, height: 16, channels: 3, background: "white" } })
    .png()
    .toBuffer();
  await expect(transparentImage(asset(nonuniform))).rejects.toThrow("not uniform");
  await expect(transparentImage(asset(empty))).rejects.toThrow("no distinct foreground");
  await expect(transparentImage(asset(Buffer.from("invalid")))).rejects.toThrow();
});
