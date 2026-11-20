import type { Pool } from "pg";
import type { SyncStatus } from "../domain/models.js";
import {
  leaguepediaBatchSize,
  leaguepediaBudget,
  proGamePlatformPattern,
} from "../providers/leaguepedia-game.js";

/** The shared Leaguepedia budget, any pause, and how far the pro timeline backfill has come. */
export async function leaguepediaProgress(
  pool: Pool,
  now: Date,
): Promise<SyncStatus["leaguepedia"]> {
  const used = (
    await pool.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM provider_request_ledger WHERE provider='leaguepedia' AND requested_at>$1::timestamptz-interval '1 hour'",
      [now],
    )
  ).rows[0]!.count;
  const paused = (
    await pool.query<{ until: Date; reason: string }>(
      "SELECT until,reason FROM provider_pauses WHERE provider='leaguepedia' AND until>$1",
      [now],
    )
  ).rows[0];
  const timelines = (
    await pool.query<{ games: number; with_timeline: number; unchecked: number }>(
      `SELECT count(DISTINCT g.source_game_id)::integer AS games,
         count(DISTINCT g.source_game_id) FILTER (
           WHERE jsonb_array_length(coalesce(d.document->'gold','[]'::jsonb))>0
         )::integer AS with_timeline,
         count(DISTINCT g.source_game_id) FILTER (WHERE d.checked_at IS NULL)::integer AS unchecked
       FROM oracle_archive_games g LEFT JOIN pro_game_details d USING (source_game_id)
       WHERE g.complete AND g.source_game_id ~ $1`,
      [proGamePlatformPattern],
    )
  ).rows[0]!;
  // At the ceiling, each request checks a full batch; a pause delays the start.
  const hours = timelines.unchecked / leaguepediaBatchSize / leaguepediaBudget.perHour;
  const start = Math.max(now.valueOf(), paused?.until.valueOf() ?? 0);
  return {
    requestsLastHour: used,
    limitPerHour: leaguepediaBudget.perHour,
    pausedUntil: paused?.until.toISOString() ?? null,
    pauseReason: paused?.reason ?? null,
    timelines: {
      games: timelines.games,
      withTimeline: timelines.with_timeline,
      unchecked: timelines.unchecked,
      estimatedFinish: timelines.unchecked
        ? new Date(start + Math.ceil(hours * 3_600_000)).toISOString()
        : null,
    },
  };
}
