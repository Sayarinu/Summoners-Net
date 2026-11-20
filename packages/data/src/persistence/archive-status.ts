import type { Pool } from "pg";
import type { SyncStatus } from "../domain/models.js";
import { archiveYears } from "../providers/oracle.js";

/** Every annual archive year, imported or not, with what its latest import job is waiting for. */
export async function archiveYearStatus(pool: Pool, now: Date): Promise<SyncStatus["archives"]> {
  const imported = new Map(
    (
      await pool.query<{ year: number; games: number; latest: Date }>(
        `SELECT archive_year AS year,count(*)::integer AS games,max(occurred_at) AS latest
         FROM oracle_archive_games GROUP BY archive_year`,
      )
    ).rows.map((r) => [r.year, r]),
  );
  const jobs = new Map(
    (
      await pool.query<{ year: number; state: string; available_at: Date; error: string | null }>(
        `SELECT DISTINCT ON ((request->>'year')::integer)
           (request->>'year')::integer AS year,state,available_at,error
         FROM sync_jobs WHERE request->>'kind'='history'
         ORDER BY (request->>'year')::integer,id DESC`,
      )
    ).rows.map((r) => [r.year, r]),
  );
  const last = Math.max(now.getUTCFullYear(), ...imported.keys());
  const years = [...new Set([...archiveYears, ...imported.keys()])]
    .filter((year) => year <= last)
    .sort((a, b) => a - b);
  return years.map((year) => {
    const archive = imported.get(year);
    const job = jobs.get(year);
    const waiting = job?.state === "queued" && job.available_at > now;
    const state = archive
      ? "imported"
      : !job
        ? "missing"
        : job.state === "failed"
          ? "failed"
          : waiting && job.error
            ? "blocked"
            : job.state === "done"
              ? "missing"
              : "queued";
    return {
      year,
      state,
      games: archive?.games ?? 0,
      latestGameAt: archive?.latest.toISOString() ?? null,
      retryAt: waiting ? job.available_at.toISOString() : null,
      error: job && job.state !== "done" ? job.error : null,
    };
  });
}
