import type { Pool } from "pg";
import { transaction, type Executor } from "./database.js";

/** The current patch and the `previous` patches before it, newest first. */
export async function keptPatches(db: Executor, previous: number) {
  const rows = await db.query<{ patch_key: string }>(
    "SELECT patch_key FROM patches ORDER BY release_order DESC LIMIT $1",
    [previous + 1],
  );
  return rows.rows.map((r) => r.patch_key);
}
/**
 * Prunes one batch of solo-queue matches from patches outside `kept`, with their participants,
 * timelines and payloads (by cascade). Each id stays as a 'pruned' tombstone with its patch.
 * Matches of an unknown patch are kept: their version may be newer than the catalog.
 */
export async function pruneBatch(pool: Pool, kept: readonly string[], size: number) {
  return transaction(pool, async (c) => {
    const batch = await c.query<{ match_id: string; patch_key: string }>(
      `SELECT match_id,patch_key FROM riot_matches
       WHERE patch_key IS NOT NULL AND NOT (patch_key=ANY($1::text[]))
       ORDER BY match_id LIMIT $2 FOR UPDATE`,
      [kept, size],
    );
    if (!batch.rowCount) return 0;
    await c.query(
      `UPDATE riot_match_ids i SET fetch_state='pruned',pruned_patch_key=b.patch_key
       FROM unnest($1::text[],$2::text[]) b(match_id,patch_key) WHERE i.match_id=b.match_id`,
      [batch.rows.map((r) => r.match_id), batch.rows.map((r) => r.patch_key)],
    );
    await c.query("DELETE FROM riot_matches WHERE match_id=ANY($1::text[])", [
      batch.rows.map((r) => r.match_id),
    ]);
    return batch.rowCount;
  });
}
/** Ids crawled for a patch no longer kept are never fetched. */
export async function pruneUnfetched(db: Executor, kept: readonly string[], size: number) {
  const result = await db.query(
    `UPDATE riot_match_ids SET fetch_state='pruned' WHERE match_id IN (
       SELECT match_id FROM riot_match_ids WHERE fetch_state='pending'
         AND NOT (crawl_patch_key=ANY($1::text[])) LIMIT $2)`,
    [kept, size],
  );
  return result.rowCount ?? 0;
}
/**
 * Backfill: pruned matches whose patch is kept again (after a wider setting) are queued for
 * fetching. The match job then refetches them through the request ledger.
 */
export async function requeuePruned(db: Executor, kept: readonly string[], size: number) {
  const result = await db.query(
    `UPDATE riot_match_ids SET fetch_state='pending',pruned_patch_key=NULL WHERE match_id IN (
       SELECT match_id FROM riot_match_ids WHERE fetch_state='pruned'
         AND coalesce(pruned_patch_key,crawl_patch_key)=ANY($1::text[]) LIMIT $2)`,
    [kept, size],
  );
  return result.rowCount ?? 0;
}
export async function recordRetention(
  db: Executor,
  run: { previous: number; kept: string[]; pruned: number; backfilled: number },
  now: Date,
) {
  await db.query(
    `UPDATE riot_retention SET previous_patches=$1,kept_patches=$2,last_run_at=$3,
       pruned_matches=$4,backfilled_matches=$5 WHERE id=true`,
    [run.previous, run.kept, now, run.pruned, run.backfilled],
  );
}
