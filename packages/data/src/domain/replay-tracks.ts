import { z } from "zod";
import { riotPlatforms } from "./riot-platforms.js";

export const replayTrackMaxBytes = 64 * 1024 * 1024;
const participantId = z.number().int().min(1).max(10);
const dimension = z.number().int().min(1).max(16384);
const offset = z.number().int().min(0).max(16383);
const point = z.strictObject({ x: z.number(), y: z.number() });
const observation = z.strictObject({
  participantId,
  position: z
    .strictObject({
      x: z.number().min(-120).max(14870),
      y: z.number().min(-120).max(14980),
      pixel: point,
    })
    .nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

/** Version 1 is a completed Summoner's Rift replay; no names, credentials or image payloads. */
export const replayTrackSchema = z
  .strictObject({
    formatVersion: z.literal(1, { error: "Unsupported replay track format version; expected 1." }),
    gameId: z.string().regex(/^[A-Z0-9]{2,5}_[1-9]\d{0,14}$/),
    platform: z.enum(riotPlatforms),
    patch: z.string().regex(/^[1-9]\d?\.[1-9]\d?$/),
    mapId: z.literal(11),
    sampleRateHz: z.number().min(1).max(10),
    roster: z
      .array(
        z.strictObject({
          participantId,
          championId: z.number().int().min(1).max(1000000),
          teamId: z.union([z.literal(100), z.literal(200)]),
        }),
      )
      .length(10),
    capture: z.strictObject({
      method: z.literal("replay-api-png"),
      toolVersion: z.string().trim().min(1).max(80),
      clientVersion: z.string().trim().min(1).max(80),
      capturedAt: z.iso.datetime(),
      replaySha256: z.string().regex(/^[a-f0-9]{64}$/),
      sourceWidth: dimension,
      sourceHeight: dimension,
      minimap: z.strictObject({ left: offset, top: offset, width: dimension, height: dimension }),
    }),
    samples: z
      .array(
        z.strictObject({
          timeMs: z.number().int().min(0).max(7200000),
          positions: z.array(observation).length(10),
        }),
      )
      .min(1)
      .max(72001),
  })
  .superRefine((track, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (!track.gameId.startsWith(`${track.platform.toUpperCase()}_`))
      issue(["gameId"], "Game ID prefix must match platform.");
    if (new Set(track.roster.map((p) => p.participantId)).size !== 10)
      issue(["roster"], "Roster participant IDs must be unique.");
    if (new Set(track.roster.map((p) => p.championId)).size !== 10)
      issue(["roster"], "Roster champion IDs must be unique.");
    if (track.roster.filter((p) => p.teamId === 100).length !== 5)
      issue(["roster"], "Roster must contain five participants on each team.");
    const { minimap, sourceWidth, sourceHeight } = track.capture;
    if (minimap.left + minimap.width > sourceWidth || minimap.top + minimap.height > sourceHeight)
      issue(["capture", "minimap"], "Minimap crop must fit inside the source frame.");
    track.samples.forEach((sample, index) => {
      if (index > 0 && sample.timeMs <= track.samples[index - 1]!.timeMs)
        issue(["samples", index, "timeMs"], "Sample times must strictly increase.");
      if (new Set(sample.positions.map((p) => p.participantId)).size !== 10)
        issue(
          ["samples", index, "positions"],
          "Each sample must contain every roster participant exactly once.",
        );
      sample.positions.forEach((observation, positionIndex) => {
        const path = ["samples", index, "positions", positionIndex];
        if (observation.position === null) return;
        if (observation.confidence === null)
          issue([...path, "confidence"], "A detected position requires a confidence score.");
        const { pixel } = observation.position;
        if (pixel.x < 0 || pixel.y < 0 || pixel.x > minimap.width || pixel.y > minimap.height)
          issue(
            [...path, "position", "pixel"],
            "Pixel coordinates must be relative to and inside the minimap crop.",
          );
      });
    });
  });

export type ReplayTrack = z.infer<typeof replayTrackSchema>;
export type ReplayTrackSample = ReplayTrack["samples"][number];

/** Entry point for bounded UTF-8 JSON uploads and locally produced track files. */
export function parseReplayTrackFile(json: string): ReplayTrack {
  if (new TextEncoder().encode(json).byteLength > replayTrackMaxBytes)
    throw new Error("Replay track file exceeds the 64 MiB limit.");
  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Replay track file must contain valid JSON.");
  }
  return replayTrackSchema.parse(input);
}
