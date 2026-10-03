import { createHash } from "node:crypto";
import sharp from "sharp";

export interface ImageAsset {
  body: Buffer;
  mime: string;
  hash: string;
}
export const renditionVersion = 1;

export async function transparentImage(original: ImageAsset): Promise<ImageAsset> {
  const { data, info } = await sharp(original.body, { limitInputPixels: 16_777_216 })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = width * height;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return original;

  // Remove only a uniform background connected to the canvas edges. Enclosed white
  // lettering, facial highlights, and shirt details remain untouched. No generated pixels.
  const background = [data[0]!, data[1]!, data[2]!];
  const distance = (pixel: number) =>
    Math.max(...background.map((color, channel) => Math.abs(data[pixel * 4 + channel]! - color)));
  if ([width - 1, pixels - width, pixels - 1].some((corner) => distance(corner) > 8))
    throw new Error("Image needs a reviewed transparent source; background is not uniform.");
  const visited = new Uint8Array(pixels);
  const queue = new Uint32Array(pixels);
  let end = 0;
  const add = (pixel: number) => {
    if (!visited[pixel]) {
      visited[pixel] = 1;
      if (distance(pixel) <= 28) queue[end++] = pixel;
    }
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add(pixels - width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  for (let start = 0; start < end; start++) {
    const pixel = queue[start]!;
    const x = pixel % width,
      y = Math.floor(pixel / width);
    if (x > 0) add(pixel - 1);
    if (x + 1 < width) add(pixel + 1);
    if (y > 0) add(pixel - width);
    if (y + 1 < height) add(pixel + width);
  }
  if (end < pixels * 0.01 || end === pixels)
    throw new Error("Image needs a reviewed transparent source; no distinct foreground.");
  for (let i = 0; i < end; i++) {
    const pixel = queue[i]!;
    const alpha = Math.max(0, (distance(pixel) - 12) / 16);
    data[pixel * 4 + 3] = Math.round(alpha * 255);
    if (alpha > 0)
      for (let channel = 0; channel < 3; channel++)
        data[pixel * 4 + channel] = Math.max(
          0,
          Math.min(
            255,
            Math.round((data[pixel * 4 + channel]! - background[channel]! * (1 - alpha)) / alpha),
          ),
        );
  }
  const body = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  if (body.length > 3 * 1024 * 1024) throw new Error("Transparent image exceeds 3 MiB.");
  return { body, mime: "image/png", hash: createHash("sha256").update(body).digest("hex") };
}
