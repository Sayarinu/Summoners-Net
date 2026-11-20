import { z } from "zod";
import { replayFileMaxBytes, replayMetadataMaxBytes } from "../domain/replays.js";

const version = z
  .string()
  .max(80)
  .regex(/^\d{1,3}(?:\.\d{1,10}){1,3}$/);
const count = z.number().int().min(0).max(1_000_000_000);
const duration = z.number().int().min(0).max(86_400_000);
const metadataSchema = z.strictObject({
  gameLength: duration,
  gameVersion: version.optional(),
  lastGameChunkId: count.optional(),
  lastKeyFrameId: count.optional(),
  statsJson: z.string().max(replayMetadataMaxBytes),
});
const numericFields = ["TEAM", "CHAMPIONS_KILLED", "NUM_DEATHS", "ASSISTS"];
export function statNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 && value <= 1e9 ? value : null;
  return typeof value === "string" && /^\d{1,10}$/.test(value) && Number(value) <= 1e9
    ? Number(value)
    : null;
}
const statsSchema = z
  .array(
    z
      .record(
        z.string().min(1).max(128),
        z.union([z.string().max(4096), z.number(), z.boolean(), z.null()]),
      )
      .superRefine((row, ctx) => {
        if (Object.keys(row).length > 512)
          ctx.addIssue({ code: "custom", message: "Too many statistic fields." });
        for (const key of numericFields) {
          const value = row[key];
          if (value !== undefined && value !== null && value !== "" && statNumber(value) === null)
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: "Statistic must be a bounded nonnegative integer.",
            });
        }
      }),
  )
  .max(64);
export interface RoflLayout {
  format: "ROFL" | "ROFL2";
  metadataOffset: number;
  metadataLength: number;
  payloadHeaderOffset: number | null;
  payloadHeaderLength: number;
  headerVersion: string | null;
}
function range(offset: number, length: number, size: number) {
  if (offset < 0 || length < 1 || offset + length > size)
    throw new Error("Replay contains an invalid or truncated section.");
}
/** Layout evidence and unsupported assumptions are recorded in docs/formats/rofl-metadata-research.md. */
export function roflLayout(prefix: Buffer, tail: Buffer, fileSize: number): RoflLayout {
  if (!Number.isSafeInteger(fileSize) || fileSize < 20 || fileSize > replayFileMaxBytes)
    throw new Error("Replay must be a nonempty file up to 256 MiB.");
  if (prefix.length < 6 || !prefix.subarray(0, 4).equals(Buffer.from("RIOT")) || prefix[5] !== 0)
    throw new Error("Unsupported replay signature.");
  if (prefix[4] === 2) {
    if (prefix.length < 15 || tail.length !== 4)
      throw new Error("Truncated ROFL2 header or footer.");
    const length = prefix[14]!;
    if (length < 1 || length > 80 || prefix.length < 15 + length)
      throw new Error("Invalid ROFL2 version length.");
    const headerVersion = version.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(prefix.subarray(15, 15 + length)),
    );
    const metadataLength = tail.readUInt32LE(0);
    const metadataOffset = fileSize - 4 - metadataLength;
    if (metadataLength > replayMetadataMaxBytes || metadataOffset < 15 + length + 256)
      throw new Error("ROFL2 metadata overlaps its header/signature or exceeds 4 MiB.");
    range(metadataOffset, metadataLength, fileSize - 4);
    return {
      format: "ROFL2",
      metadataOffset,
      metadataLength,
      payloadHeaderOffset: null,
      payloadHeaderLength: 0,
      headerVersion,
    };
  }
  if (prefix[4] !== 0) throw new Error("Unsupported replay container version.");
  if (
    prefix.length < 288 ||
    prefix.readUInt16LE(262) !== 288 ||
    prefix.readUInt32LE(264) !== fileSize
  )
    throw new Error("Legacy replay header length or file length does not match.");
  const metadataOffset = prefix.readUInt32LE(268),
    metadataLength = prefix.readUInt32LE(272);
  const payloadHeaderOffset = prefix.readUInt32LE(276),
    payloadHeaderLength = prefix.readUInt32LE(280);
  const payloadOffset = prefix.readUInt32LE(284);
  range(metadataOffset, metadataLength, fileSize);
  range(payloadHeaderOffset, payloadHeaderLength, fileSize);
  if (
    metadataLength > replayMetadataMaxBytes ||
    metadataOffset < 288 ||
    payloadHeaderOffset < 288 ||
    payloadHeaderLength < 34 ||
    payloadHeaderLength > 65569 ||
    (metadataOffset < payloadHeaderOffset + payloadHeaderLength &&
      payloadHeaderOffset < metadataOffset + metadataLength) ||
    payloadOffset < payloadHeaderOffset + payloadHeaderLength ||
    payloadOffset > fileSize ||
    (payloadOffset >= metadataOffset && payloadOffset < metadataOffset + metadataLength)
  )
    throw new Error("Legacy replay sections overlap or exceed supported bounds.");
  return {
    format: "ROFL",
    metadataOffset,
    metadataLength,
    payloadHeaderOffset,
    payloadHeaderLength,
    headerVersion: null,
  };
}
export function parseRoflMetadata(layout: RoflLayout, bytes: Buffer, payloadHeader?: Buffer) {
  if (bytes.length !== layout.metadataLength) throw new Error("Truncated replay metadata.");
  const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const metadata = metadataSchema.parse(raw);
  const stats: unknown = JSON.parse(metadata.statsJson);
  const participants = statsSchema.parse(stats);
  const gameVersion = layout.headerVersion ?? version.parse(metadata.gameVersion);
  if (metadata.gameVersion && metadata.gameVersion !== gameVersion)
    throw new Error("Replay version fields disagree.");
  let gameId: string | null = null,
    headerDurationMs: number | null = null;
  if (layout.format === "ROFL") {
    if (
      !payloadHeader ||
      payloadHeader.length !== 34 ||
      34 + payloadHeader.readUInt16LE(32) > layout.payloadHeaderLength
    )
      throw new Error("Invalid legacy payload header or key length.");
    gameId = payloadHeader.readBigUInt64LE(0).toString();
    if (gameId === "0") throw new Error("Replay has no valid game ID.");
    headerDurationMs = duration.parse(payloadHeader.readUInt32LE(8));
  }
  return {
    format: layout.format,
    gameId,
    gameVersion,
    durationMs: metadata.gameLength,
    headerDurationMs,
    lastGameChunkId: metadata.lastGameChunkId ?? null,
    lastKeyFrameId: metadata.lastKeyFrameId ?? null,
    participants,
  };
}
export type ParsedReplayMetadata = ReturnType<typeof parseRoflMetadata>;
