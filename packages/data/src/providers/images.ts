import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";

function validPng(body: Buffer) {
  if (
    body.length < 45 ||
    body.readUInt32BE(8) !== 13 ||
    body.subarray(12, 16).toString() !== "IHDR"
  )
    return false;
  const width = body.readUInt32BE(16),
    height = body.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192) return false;
  let hasData = false;
  for (let offset = 8; offset + 12 <= body.length;) {
    const size = body.readUInt32BE(offset),
      end = offset + size + 12;
    if (
      end > body.length ||
      crc32(body.subarray(offset + 4, end - 4)) !== body.readUInt32BE(end - 4)
    )
      return false;
    const type = body.subarray(offset + 4, offset + 8).toString();
    if (type === "IDAT") hasData = true;
    if (type === "IEND") return hasData && size === 0 && end === body.length;
    offset = end;
  }
  return false;
}

export function imageAddress(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["cdn-api.pandascore.co", "cdn.pandascore.co"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("Image host is not supported.");
  return url.toString();
}
export async function readImage(response: Response) {
  if (!response.ok) throw new Error(`Image returned HTTP ${response.status}.`);
  const limit = 3 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit)
    throw new Error("Image exceeds 3 MiB.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image response is empty.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error("Image exceeds 3 MiB.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const body = Buffer.concat(chunks);
  const mime = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : body[0] === 255 && body[1] === 216 && body[2] === 255
      ? "image/jpeg"
      : ["GIF87a", "GIF89a"].includes(body.subarray(0, 6).toString())
        ? "image/gif"
        : body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
  if (!mime || response.headers.get("content-type")?.split(";")[0]?.trim() !== mime)
    throw new Error("Image content is not a supported raster image.");
  if (mime === "image/png" && !validPng(body)) throw new Error("PNG image integrity check failed.");
  return { body, mime, hash: createHash("sha256").update(body).digest("hex") };
}
