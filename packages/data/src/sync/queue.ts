import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { syncRequestSchema, type SyncRequest } from "../domain/models.js";
import { transaction } from "../persistence/database.js";
export function jobKey(r: SyncRequest) {
  return r.kind === "history"
    ? `history:${r.year}${r.file ? ":" + createHash("sha256").update(r.file).digest("hex").slice(0, 16) : ""}`
    : r.kind;
}
export async function enqueue(pool: Pool, input: unknown, now: Date) {
  const request = syncRequestSchema.parse(input);
  const key = jobKey(request);
  const result = await pool.query<{ id: string }>(
    "INSERT INTO sync_jobs(job_key,request,requested_at,available_at) VALUES($1,$2,$3,$3) ON CONFLICT(job_key) WHERE state IN ('queued','running') DO UPDATE SET job_key=EXCLUDED.job_key RETURNING id::text",
    [key, request, now],
  );
  return result.rows[0]!.id;
}
export async function schedule(pool: Pool, now: Date, currentFile?: string) {
  const requests: { request: SyncRequest; interval: number }[] = [
    { request: { kind: "running" }, interval: 120 },
    { request: { kind: "matches" }, interval: 600 },
    { request: { kind: "rosters" }, interval: 86400 },
    { request: { kind: "metadata" }, interval: 86400 },
    {
      request: {
        kind: "history",
        year: now.getUTCFullYear(),
        ...(currentFile ? { file: currentFile } : {}),
      },
      interval: 86400,
    },
  ];
  await transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183274)");
    for (const { request, interval } of requests) {
      const key = jobKey(request);
      const updated = await c.query(
        "INSERT INTO sync_schedule(job_key,next_at) VALUES($1,$2::timestamptz+make_interval(secs=>$3)) ON CONFLICT(job_key) DO UPDATE SET next_at=EXCLUDED.next_at WHERE sync_schedule.next_at<=$2 RETURNING job_key",
        [key, now, interval],
      );
      if (updated.rowCount)
        await c.query(
          "INSERT INTO sync_jobs(job_key,request,requested_at,available_at) VALUES($1,$2,$3,$3) ON CONFLICT DO NOTHING",
          [key, request, now],
        );
    }
  });
}
export async function claim(pool: Pool, now: Date) {
  const result = await pool.query<{
    id: string;
    request: unknown;
    attempts: number;
  }>(
    `WITH candidate AS (SELECT id FROM sync_jobs WHERE (state='queued' AND available_at<=$1) OR (state='running' AND lease_until<$1) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE sync_jobs j SET state='running',lease_until=$1::timestamptz+interval '5 minutes',attempts=attempts+1 FROM candidate c WHERE j.id=c.id RETURNING j.id::text,j.request,j.attempts`,
    [now],
  );
  const row = result.rows[0];
  return row ? { ...row, request: syncRequestSchema.parse(row.request) } : null;
}
