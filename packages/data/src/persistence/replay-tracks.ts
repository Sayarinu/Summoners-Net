import { normalizePatch } from "../domain/patches.js";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Pool } from "pg";
import { z } from "zod";
import {
  parseReplayTrackFile,
  replayTrackMaxBytes,
  replayTrackSchema,
  type ReplayTrack,
} from "../domain/replay-tracks.js";
import { transaction, type Executor } from "./database.js";

export class ReplayTrackImportError extends Error {}
async function matchState(
  db: Executor,
  track: ReplayTrack,
): Promise<"linked" | "unavailable" | "mismatch"> {
  const match = (
    await db.query<{ platform_id: string | null; map_id: number | null; game_version: string }>(
      "SELECT platform_id,map_id,game_version FROM riot_matches WHERE match_id=$1",
      [track.gameId],
    )
  ).rows[0];
  if (!match) return "unavailable";
  if (
    match.platform_id?.toLowerCase() !== track.platform ||
    match.map_id !== track.mapId ||
    normalizePatch(match.game_version)?.key !== track.patch
  )
    return "mismatch";
  const roster = await db.query<{ participant_id: number; champion_id: number; team_id: number }>(
    "SELECT participant_id,champion_id,team_id FROM riot_match_participants WHERE match_id=$1",
    [track.gameId],
  );
  return roster.rows.length === 10 &&
    track.roster.every((p) =>
      roster.rows.some(
        (r) =>
          r.participant_id === p.participantId &&
          r.champion_id === p.championId &&
          r.team_id === p.teamId,
      ),
    )
    ? "linked"
    : "mismatch";
}
export async function importReplayTrack(pool: Pool, file: string, now: Date) {
  if (!(await stat(file)).isFile())
    throw new ReplayTrackImportError("Choose a regular replay track file.");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of createReadStream(file)) {
    const bytes = chunk as Buffer;
    length += bytes.length;
    if (length > replayTrackMaxBytes)
      throw new ReplayTrackImportError("Replay track file exceeds the 64 MiB limit.");
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  let track: ReplayTrack;
  try {
    track = parseReplayTrackFile(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ReplayTrackImportError(
      "Replay track must be valid UTF-8 JSON matching format version 1; saved tracks are unchanged.",
    );
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  await transaction(pool, async (db) => {
    if ((await matchState(db, track)) === "mismatch")
      throw new ReplayTrackImportError(
        "Replay track platform, patch, map or roster does not match the stored Riot game; saved tracks are unchanged.",
      );
    await db.query(
      `INSERT INTO replay_tracks(platform,game_id,format_version,patch,content_sha256,sample_count,track,imported_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(platform,game_id,format_version) DO UPDATE SET patch=EXCLUDED.patch,
         content_sha256=EXCLUDED.content_sha256,sample_count=EXCLUDED.sample_count,
         track=EXCLUDED.track,imported_at=EXCLUDED.imported_at`,
      [
        track.platform,
        track.gameId,
        track.formatVersion,
        track.patch,
        hash,
        track.samples.length,
        track,
        now,
      ],
    );
  });
  return track.samples.length;
}
const keySchema = z.strictObject({
  platform: replayTrackSchema.shape.platform,
  gameId: replayTrackSchema.shape.gameId,
});
export async function replayTrack(db: Executor, input: z.input<typeof keySchema>) {
  const key = keySchema.parse(input);
  const row = (
    await db.query<{ track: ReplayTrack; imported_at: Date; content_sha256: string }>(
      "SELECT track,imported_at,content_sha256 FROM replay_tracks WHERE platform=$1 AND game_id=$2 AND format_version=1",
      [key.platform, key.gameId],
    )
  ).rows[0];
  if (!row) return null;
  const linkState = await matchState(db, row.track);
  return {
    track: row.track,
    importedAt: row.imported_at.toISOString(),
    contentSha256: row.content_sha256,
    matchId: linkState === "linked" ? row.track.gameId : null,
    linkState,
  };
}
