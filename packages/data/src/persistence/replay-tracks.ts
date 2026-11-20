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
import { detectMovements, type TrackMovement } from "../domain/track-movements.js";
import { soloMatchIdSchema, timelineMinuteLimit } from "../domain/solo-games.js";
import {
  accuracyThresholds,
  compareTrack,
  evaluateAccuracy,
  markToleranceMs,
  type TrackAccuracy,
} from "../domain/track-accuracy.js";
import {
  trackRangeQuerySchema,
  trackRangeSampleLimit,
  type MatchTrackSummary,
  type TrackRange,
} from "../domain/track-views.js";
import { transaction, type Executor } from "./database.js";

export class ReplayTrackImportError extends Error {}
async function matchState(
  db: Executor,
  track: { gameId: string; platform: string; mapId: number; patch: string } & Pick<
    ReplayTrack,
    "roster"
  >,
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
      `INSERT INTO replay_tracks(platform,game_id,format_version,patch,content_sha256,sample_count,
         track,imported_at,sample_rate_hz,roster,movements)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT(platform,game_id,format_version) DO UPDATE SET patch=EXCLUDED.patch,
         content_sha256=EXCLUDED.content_sha256,sample_count=EXCLUDED.sample_count,
         track=EXCLUDED.track,imported_at=EXCLUDED.imported_at,
         sample_rate_hz=EXCLUDED.sample_rate_hz,roster=EXCLUDED.roster,movements=EXCLUDED.movements`,
      [
        track.platform,
        track.gameId,
        track.formatVersion,
        track.patch,
        hash,
        track.samples.length,
        track,
        now,
        track.sampleRateHz,
        JSON.stringify(track.roster),
        JSON.stringify(detectMovements(track)),
      ],
    );
    const key = [track.platform, track.gameId, track.formatVersion];
    await db.query(
      "DELETE FROM replay_track_samples WHERE platform=$1 AND game_id=$2 AND format_version=$3",
      key,
    );
    await db.query(
      `INSERT INTO replay_track_samples(platform,game_id,format_version,time_ms,positions)
       SELECT $1,$2,$3,(s->>'timeMs')::integer,s->'positions'
       FROM replay_tracks t, jsonb_array_elements(t.track->'samples') s
       WHERE t.platform=$1 AND t.game_id=$2 AND t.format_version=$3`,
      key,
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

const platformOf = (matchId: string) => matchId.split("_")[0]!.toLowerCase();

/** A stored track's summary for a solo game, without reading its samples; null if none. */
export async function matchTrackSummary(
  db: Executor,
  matchId: string,
): Promise<MatchTrackSummary | null> {
  const id = soloMatchIdSchema.parse(matchId);
  const row = (
    await db.query<{
      patch: string;
      sample_rate_hz: number;
      sample_count: number;
      imported_at: Date;
      roster: ReplayTrack["roster"];
      movements: TrackMovement[] | null;
      first_ms: number;
      last_ms: number;
    }>(
      `SELECT t.patch,t.sample_rate_hz,t.sample_count,t.imported_at,t.roster,t.movements,
         (SELECT min(time_ms) FROM replay_track_samples s WHERE s.platform=t.platform
           AND s.game_id=t.game_id AND s.format_version=1) AS first_ms,
         (SELECT max(time_ms) FROM replay_track_samples s WHERE s.platform=t.platform
           AND s.game_id=t.game_id AND s.format_version=1) AS last_ms
       FROM replay_tracks t WHERE t.platform=$1 AND t.game_id=$2 AND t.format_version=1`,
      [platformOf(id), id],
    )
  ).rows[0];
  if (!row) return null;
  return {
    sampleRateHz: row.sample_rate_hz,
    sampleCount: row.sample_count,
    firstMs: row.first_ms,
    lastMs: row.last_ms,
    importedAt: row.imported_at.toISOString(),
    linkState: await matchState(db, {
      gameId: id,
      platform: platformOf(id),
      mapId: 11,
      patch: row.patch,
      roster: row.roster,
    }),
    movements: row.movements,
  };
}

/**
 * A linked track's samples in one bounded time range, oldest first. Null when the game has no
 * track linked to its stored Riot match.
 */
export async function matchTrackRange(
  db: Executor,
  input: z.input<typeof trackRangeQuerySchema>,
): Promise<TrackRange | null> {
  const q = trackRangeQuerySchema.parse(input);
  const summary = await matchTrackSummary(db, q.matchId);
  if (summary?.linkState !== "linked") return null;
  const rows = (
    await db.query<{
      time_ms: number;
      positions: {
        participantId: number;
        position: { x: number; y: number } | null;
        confidence: number | null;
      }[];
    }>(
      `SELECT time_ms,positions FROM replay_track_samples
       WHERE platform=$1 AND game_id=$2 AND format_version=1 AND time_ms BETWEEN $3 AND $4
       ORDER BY time_ms LIMIT $5`,
      [platformOf(q.matchId), q.matchId, q.fromMs, q.toMs, trackRangeSampleLimit],
    )
  ).rows;
  return rows.map((r) => ({
    timeMs: r.time_ms,
    positions: r.positions.map((p) => ({
      participantId: p.participantId,
      x: p.position?.x ?? null,
      y: p.position?.y ?? null,
      confidence: p.confidence,
    })),
  }));
}

/**
 * Compares a linked track with the game's stored timeline frames at minute marks. Reads one
 * sample per mark and per-participant observation counts, so the read is bounded per game.
 * Null when the game has no track linked to its stored Riot match.
 */
export async function trackAccuracy(db: Executor, matchId: string): Promise<TrackAccuracy | null> {
  const id = soloMatchIdSchema.parse(matchId);
  const key = [platformOf(id), id];
  const track = (
    await db.query<{ roster: ReplayTrack["roster"] }>(
      "SELECT roster FROM replay_tracks WHERE platform=$1 AND game_id=$2 AND format_version=1",
      key,
    )
  ).rows[0];
  if (!track || (await matchTrackSummary(db, id))?.linkState !== "linked") return null;
  const frames = (
    await db.query<{
      participant_id: number;
      timestamp_ms: number;
      x: number | null;
      y: number | null;
    }>(
      `SELECT participant_id,timestamp_ms,x,y FROM riot_timeline_frames
       WHERE match_id=$1 AND minute<=$2 ORDER BY minute,participant_id`,
      [id, timelineMinuteLimit],
    )
  ).rows;
  const marks = [...new Set(frames.map((f) => f.timestamp_ms))];
  const samples = (
    await db.query<{
      time_ms: number;
      positions: { participantId: number; position: { x: number; y: number } | null }[];
    }>(
      `SELECT DISTINCT s.time_ms,s.positions FROM unnest($3::integer[]) AS m(ts)
       CROSS JOIN LATERAL (SELECT time_ms,positions FROM replay_track_samples
         WHERE platform=$1 AND game_id=$2 AND format_version=1
           AND time_ms BETWEEN m.ts-$4 AND m.ts+$4
         ORDER BY abs(time_ms-m.ts),time_ms LIMIT 1) s`,
      [...key, marks, markToleranceMs],
    )
  ).rows;
  const counts = (
    await db.query<{ participant_id: number; observations: number; nulls: number }>(
      `SELECT (o->>'participantId')::integer AS participant_id,count(*)::integer AS observations,
         (count(*) FILTER (WHERE o->'position'='null'::jsonb))::integer AS nulls
       FROM replay_track_samples s, jsonb_array_elements(s.positions) o
       WHERE s.platform=$1 AND s.game_id=$2 AND s.format_version=1 GROUP BY 1`,
      key,
    )
  ).rows;
  const report = compareTrack({
    roster: track.roster,
    samples: samples.map((s) => ({
      timeMs: s.time_ms,
      positions: s.positions.map((o) => ({
        participantId: o.participantId,
        x: o.position?.x ?? null,
        y: o.position?.y ?? null,
      })),
    })),
    frames: frames.map((f) => ({
      participantId: f.participant_id,
      timestampMs: f.timestamp_ms,
      x: f.x,
      y: f.y,
    })),
    counts: counts.map((c) => ({
      participantId: c.participant_id,
      observations: c.observations,
      nulls: c.nulls,
    })),
  });
  return {
    matchId: id,
    report,
    verdict: evaluateAccuracy(report.overall),
    thresholds: accuracyThresholds,
  };
}
