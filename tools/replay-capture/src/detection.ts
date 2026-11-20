import sharp from "sharp";
import { z } from "zod";
import { pixelToWorld } from "@summonersnet/ui/map-coordinates";

const png = z
  .instanceof(Uint8Array)
  .refine(
    (v) => v.length > 0 && v.length <= 2 * 1024 * 1024,
    "Each PNG must contain 1–2097152 bytes.",
  );
const patch = z.string().regex(/^\d{1,2}\.\d{1,2}(?:\.\d{1,3})?$/);
const inputSchema = z
  .strictObject({
    mapId: z.literal(11),
    patch,
    portraits: z
      .array(
        z.strictObject({
          participantId: z.number().int().min(1).max(10),
          championId: z.number().int().positive(),
          patch,
          png,
        }),
      )
      .length(10),
    frames: z
      .array(
        z.strictObject({
          timeMs: z.number().int().min(0).max(7_200_000),
          png,
        }),
      )
      .min(1)
      .max(600),
  })
  .superRefine((input, ctx) => {
    if (
      new Set(input.portraits.map((p) => p.participantId)).size !== 10 ||
      new Set(input.portraits.map((p) => p.championId)).size !== 10
    )
      ctx.addIssue({
        code: "custom",
        message: "Supply exactly ten unique participants and champions.",
      });
    if (input.portraits.some((p) => p.patch !== input.patch))
      ctx.addIssue({
        code: "custom",
        message: "Every local Data Dragon portrait must match the selected patch.",
      });
    if (input.frames.some((f, i) => i > 0 && f.timeMs <= input.frames[i - 1]!.timeMs))
      ctx.addIssue({ code: "custom", message: "Frame game times must increase strictly." });
  });
const settingsSchema = z.strictObject({
  iconSizes: z.array(z.number().int().min(5).max(48)).min(1).max(3),
  threshold: z.number().min(0).max(1).default(0.9),
  ambiguityMargin: z.number().min(0).max(1).default(0.08),
  jumpWorldUnits: z.number().positive().max(20_000).default(1500),
  maxGapMs: z.number().int().min(1).max(5000).default(1000),
});
export type DetectionInput = z.infer<typeof inputSchema>;
export type DetectionSettings = z.input<typeof settingsSchema>;
export interface Detection {
  participantId: number;
  championId: number;
  confidence: number;
  position: { x: number; y: number; pixel: { x: number; y: number } } | null;
  rejected: "weak" | "ambiguous" | "overlap" | "temporal-jump" | null;
}
export interface DetectedFrame {
  timeMs: number;
  positions: Detection[];
}
interface GrayImage {
  width: number;
  height: number;
  data: Buffer;
}
interface Template {
  size: number;
  offsets: { x: number; y: number; value: number }[];
  energy: number;
}
interface Candidate {
  x: number;
  y: number;
  size: number;
  score: number;
}
async function decode(bytes: Uint8Array): Promise<GrayImage> {
  const image = sharp(bytes, { limitInputPixels: 1024 * 1024, animated: false });
  const metadata = await image.metadata();
  if (
    metadata.format !== "png" ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 1024 ||
    metadata.height > 1024 ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error("Detection requires single PNG images no larger than 1024 × 1024.");
  const { data, info } = await image
    .flatten({ background: "#000" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
async function template(image: GrayImage, size: number): Promise<Template> {
  const data = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 1 },
  })
    .resize(size, size, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const offsets: Template["offsets"] = [];
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (Math.hypot(x - centre, y - centre) <= size * 0.36)
        offsets.push({ x, y, value: data[y * size + x]! });
  const mean = offsets.reduce((sum, p) => sum + p.value, 0) / offsets.length;
  let energy = 0;
  for (const p of offsets) {
    p.value -= mean;
    energy += p.value ** 2;
  }
  if (energy / offsets.length < 1)
    throw new Error("A portrait template is flat; use a detailed local portrait.");
  return { size, offsets, energy };
}
function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function match(image: GrayImage, templates: Template[]) {
  let best: Candidate = { x: 0, y: 0, size: 0, score: 0 };
  const maps = templates.map((t) => {
    const width = image.width - t.size + 1,
      height = image.height - t.size + 1;
    const scores = new Float64Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let sum = 0,
          squares = 0,
          dot = 0;
        for (const p of t.offsets) {
          const value = image.data[(y + p.y) * image.width + x + p.x]!;
          sum += value;
          squares += value * value;
          dot += value * p.value;
        }
        const energy = squares - (sum * sum) / t.offsets.length;
        const score = energy < 1 ? 0 : Math.max(0, Math.min(1, dot / Math.sqrt(energy * t.energy)));
        scores[y * width + x] = score;
        if (score > best.score)
          best = { x: x + t.size / 2, y: y + t.size / 2, size: t.size, score };
      }
    return { width, height, scores, size: t.size };
  });
  let runnerUp = 0;
  for (const map of maps)
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        if (
          distance(best, { x: x + map.size / 2, y: y + map.size / 2 }) >=
          Math.max(best.size, map.size) / 2
        )
          runnerUp = Math.max(runnerUp, map.scores[y * map.width + x]!);
  return { ...best, margin: best.score - runnerUp };
}

/** Offline matching of already-calibrated crops; timestamps and identity must be verified separately. */
export async function detectMinimapFrames(
  rawInput: unknown,
  rawSettings: DetectionSettings,
): Promise<DetectedFrame[]> {
  const input = inputSchema.parse(rawInput),
    settings = settingsSchema.parse(rawSettings);
  const sizes = [...new Set(settings.iconSizes)];
  const portraits = await Promise.all(
    input.portraits.map(async (p) => {
      const image = await decode(p.png);
      return { ...p, templates: await Promise.all(sizes.map((size) => template(image, size))) };
    }),
  );
  const result: DetectedFrame[] = [];
  let dimensions: string | undefined;
  for (const frame of input.frames) {
    const image = await decode(frame.png);
    if (Math.max(...sizes) > Math.min(image.width, image.height))
      throw new Error("Calibrated icon sizes must fit in the minimap crop.");
    const currentDimensions = image.width + "x" + image.height;
    if (dimensions && currentDimensions !== dimensions)
      throw new Error("All minimap crops must have identical dimensions.");
    dimensions = currentDimensions;
    const matches = portraits.map((p) => match(image, p.templates));
    const positions = portraits.map((p, i): Detection => {
      const candidate = matches[i]!;
      const rejected =
        candidate.score < settings.threshold || candidate.size === 0
          ? "weak"
          : candidate.margin < settings.ambiguityMargin
            ? "ambiguous"
            : null;
      const pixel = { x: candidate.x, y: candidate.y };
      const world = pixelToWorld(pixel, image.width, image.height)!;
      return {
        participantId: p.participantId,
        championId: p.championId,
        confidence: candidate.score,
        position: rejected ? null : { ...world, pixel },
        rejected,
      };
    });
    // Reject both claims rather than resolving a collision by guessing identity.
    const collisions = new Set<number>();
    for (let i = 0; i < positions.length; i++)
      for (let j = i + 1; j < positions.length; j++)
        if (
          positions[i]!.position &&
          positions[j]!.position &&
          distance(matches[i]!, matches[j]!) < (matches[i]!.size + matches[j]!.size) / 2
        ) {
          collisions.add(i);
          collisions.add(j);
        }
    for (const i of collisions) {
      positions[i]!.position = null;
      positions[i]!.rejected = "overlap";
    }
    result.push({ timeMs: frame.timeMs, positions });
  }
  // Decide from the original neighbours, so rejecting one outlier cannot alter another decision.
  const jumps: Detection[] = [];
  for (let f = 1; f < result.length - 1; f++) {
    const previous = result[f - 1]!,
      current = result[f]!,
      next = result[f + 1]!;
    if (
      current.timeMs - previous.timeMs > settings.maxGapMs ||
      next.timeMs - current.timeMs > settings.maxGapMs
    )
      continue;
    for (let i = 0; i < current.positions.length; i++) {
      const a = previous.positions[i]!.position,
        b = current.positions[i]!.position,
        c = next.positions[i]!.position;
      if (
        a &&
        b &&
        c &&
        distance(a, c) <= settings.jumpWorldUnits &&
        distance(a, b) > settings.jumpWorldUnits &&
        distance(b, c) > settings.jumpWorldUnits
      )
        jumps.push(current.positions[i]!);
    }
  }
  for (const point of jumps) {
    point.position = null;
    point.rejected = "temporal-jump";
  }
  return result;
}
