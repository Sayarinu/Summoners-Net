import { createHash } from "node:crypto";
import { lstat, open, unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import type { Pool } from "pg";
import { z } from "zod";
import { normalizePatch } from "../domain/patches.js";
import { replayFileMaxBytes, type ReplayMetadataSummary } from "../domain/replays.js";
import type { RiotPlatform } from "../domain/riot-platforms.js";
import {
  roflLayout,
  parseRoflMetadata,
  statNumber,
  type ParsedReplayMetadata,
} from "../providers/rofl.js";
import { transaction, type Executor } from "./database.js";

export class ReplayImportError extends Error {}
export async function importReplayMetadata(
  pool: Pool,
  input: {
    file: string;
    platform?: RiotPlatform;
    directory: string;
    keepFiles: boolean;
    now: Date;
  },
) {
  const file = resolve(input.file),
    directory = resolve(input.directory);
  if (
    dirname(file) !== directory ||
    !/^[a-f0-9-]{36}\.rofl$/.test(basename(file)) ||
    !(await lstat(file)).isFile()
  )
    throw new ReplayImportError(
      "Replay import accepts only regular files staged by pnpm queue replay-metadata.",
    );
  let parsed: { metadata: ParsedReplayMetadata; sha256: string } | undefined;
  try {
    const handle = await open(file, "r");
    try {
      const info = await handle.stat();
      if (info.size < 20 || info.size > replayFileMaxBytes)
        throw new Error("Replay exceeds the 256 MiB limit or is empty.");
      async function readRange(position: number, length: number) {
        const buffer = Buffer.alloc(length);
        const result = await handle.read(buffer, 0, length, position);
        if (result.bytesRead !== length) throw new Error("Truncated replay.");
        return buffer;
      }
      const prefix = await readRange(0, Math.min(info.size, 512));
      const tail = await readRange(info.size - 4, 4);
      const layout = roflLayout(prefix, tail, info.size);
      const bytes = await readRange(layout.metadataOffset, layout.metadataLength);
      const payload =
        layout.payloadHeaderOffset === null
          ? undefined
          : await readRange(layout.payloadHeaderOffset, 34);
      const metadata = parseRoflMetadata(layout, bytes, payload);
      const hash = createHash("sha256");
      let size = 0;
      for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) {
        size += (chunk as Buffer).length;
        if (size > replayFileMaxBytes) throw new Error("Replay exceeds the 256 MiB limit.");
        hash.update(chunk as Buffer);
      }
      const after = await handle.stat();
      if (size !== info.size || after.mtimeMs !== info.mtimeMs)
        throw new Error("Replay changed while reading.");
      parsed = { metadata, sha256: hash.digest("hex") };
    } finally {
      await handle.close();
    }
  } catch {
    // Cleanup still runs for an invalid upload; no prefix of its metadata is stored.
    parsed = undefined;
  }
  if (!input.keepFiles) {
    try {
      await unlink(file);
    } catch {
      throw new ReplayImportError(
        "Could not remove the staged replay copy; no metadata was stored. Check the local imports folder.",
      );
    }
  }
  if (!parsed)
    throw new ReplayImportError(
      "Replay header or metadata is malformed or unsupported. Limits: 256 MiB per file and 4 MiB of metadata. Saved metadata is unchanged.",
    );
  const { metadata, sha256 } = parsed;
  await transaction(pool, async (db) => {
    await db.query(
      `INSERT INTO replay_metadata(source_sha256,format,game_id,platform,metadata,retained_file,imported_at)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_sha256) DO UPDATE SET
         platform=EXCLUDED.platform,metadata=EXCLUDED.metadata,retained_file=EXCLUDED.retained_file,imported_at=EXCLUDED.imported_at`,
      [
        sha256,
        metadata.format,
        metadata.gameId,
        input.platform ?? null,
        metadata,
        input.keepFiles ? basename(file) : null,
        input.now,
      ],
    );
  });
  return 1;
}
export async function replayMetadata(
  db: Executor,
  input: string,
): Promise<ReplayMetadataSummary | null> {
  const sha256 = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input);
  const row = (
    await db.query<{
      metadata: ParsedReplayMetadata;
      platform: RiotPlatform | null;
      retained_file: string | null;
      imported_at: Date;
    }>(
      "SELECT metadata,platform,retained_file,imported_at FROM replay_metadata WHERE source_sha256=$1",
      [sha256],
    )
  ).rows[0];
  if (!row) return null;
  const metadata = row.metadata;
  let matchId: string | null = null;
  if (metadata.gameId && row.platform) {
    const match = (
      await db.query<{ match_id: string }>(
        `SELECT match_id FROM riot_matches WHERE match_id=$1 AND lower(platform_id)=$2
       AND split_part(game_version,'.',1)||'.'||split_part(game_version,'.',2)=$3`,
        [
          row.platform.toUpperCase() + "_" + metadata.gameId,
          row.platform,
          normalizePatch(metadata.gameVersion)?.key ?? null,
        ],
      )
    ).rows[0];
    matchId = match?.match_id ?? null;
  }
  return {
    sha256,
    format: metadata.format,
    gameId: metadata.gameId,
    platform: row.platform,
    gameVersion: metadata.gameVersion,
    durationMs: metadata.durationMs,
    importedAt: row.imported_at.toISOString(),
    fileRetainedAtImport: row.retained_file !== null,
    matchId,
    participants: metadata.participants.map((p) => ({
      champion: typeof p.SKIN === "string" ? p.SKIN : null,
      teamId: statNumber(p.TEAM),
      kills: statNumber(p.CHAMPIONS_KILLED),
      deaths: statNumber(p.NUM_DEATHS),
      assists: statNumber(p.ASSISTS),
      win: p.WIN === "Win" ? true : p.WIN === "Fail" ? false : null,
    })),
  };
}
