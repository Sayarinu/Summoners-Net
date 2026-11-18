import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { syncRequestSchema, type SyncRequest } from "../domain/models.js";

export const queueUsage =
  "Usage: pnpm queue KIND [FILE] [PLATFORM]. Kinds without a file: matches, running, rosters, metadata, entities, riot-key, riot-match-ids, pro-game-details, pro-game-vods, wp-train. With a file: replay-track FILE, replay-metadata FILE [PLATFORM], pro-account-links FILE.";

const fileKinds = new Set(["replay-track", "replay-metadata", "pro-account-links"]);

/**
 * Turns `pnpm queue` arguments into a validated synchronization request. File paths are made
 * absolute so the worker reads the same file regardless of its working directory.
 */
export function parseQueueCommand(args: readonly string[], cwd = process.cwd()): SyncRequest {
  const [kind, file, platform, ...rest] = args;
  if (!kind || rest.length) throw new Error(queueUsage);
  if (!fileKinds.has(kind)) {
    if (file !== undefined) throw new Error(queueUsage);
    const parsed = syncRequestSchema.safeParse({ kind });
    if (!parsed.success) throw new Error(queueUsage);
    return parsed.data;
  }
  if (!file || (platform !== undefined && kind !== "replay-metadata")) throw new Error(queueUsage);
  const parsed = syncRequestSchema.safeParse({
    kind,
    file: resolve(cwd, file),
    ...(platform !== undefined ? { platform } : {}),
  });
  if (!parsed.success) throw new Error(queueUsage);
  return parsed.data;
}

/**
 * The worker reads replays only from its private staging folder and removes them afterwards
 * unless KEEP_REPLAY_FILES is set, so a replay is copied there first; the original stays put.
 */
export async function stageReplay(file: string, importDirectory: string) {
  const directory = resolve(importDirectory, "replays");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const staged = resolve(directory, `${randomUUID()}.rofl`);
  await copyFile(file, staged);
  await chmod(staged, 0o600);
  return staged;
}

/** Queues one request, staging a replay copy first and removing it if queueing fails. */
export async function queueCommand(
  args: readonly string[],
  options: {
    request: (request: SyncRequest) => Promise<string>;
    importDirectory: string;
    cwd?: string;
  },
) {
  const parsed = parseQueueCommand(args, options.cwd);
  if (parsed.kind !== "replay-metadata") return options.request(parsed);
  const staged = await stageReplay(parsed.file, options.importDirectory);
  try {
    return await options.request({ ...parsed, file: staged });
  } catch (error) {
    await unlink(staged).catch(() => undefined);
    throw error;
  }
}
