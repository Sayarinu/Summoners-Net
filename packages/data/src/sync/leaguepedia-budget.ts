import type { Pool } from "pg";
import { transaction } from "../persistence/database.js";
import { DeferredRequest } from "./quota.js";

import { leaguepediaBudget } from "../providers/leaguepedia-game.js";

const provider = "leaguepedia";
export { leaguepediaBudget };
/**
 * The first pause after a refusal: short while the wiki's replicas lag, longer after a rate limit.
 * Each further consecutive refusal doubles it, up to an hour.
 */
export const firstPauseMs = { lag: 30_000, limit: 120_000 } as const;
const longestPauseMs = 3_600_000;

/** Why Leaguepedia refused a request, and how long it asked the client to wait. */
export interface Refusal {
  kind: keyof typeof firstPauseMs;
  reason: string;
  retryAfter: string | null;
}
export interface LeaguepediaBudget {
  spacingMs: number;
  perHour: number;
}

/**
 * Reserves one Leaguepedia request. Waits out the spacing after the previous request, and throws
 * {@link DeferredRequest} while the provider is paused or the hourly ceiling is reached, so the job
 * is requeued for when capacity frees up. Nothing is recorded unless the request may be sent.
 */
export async function reserveLeaguepedia(
  pool: Pool,
  clock: () => Date,
  pause: (ms: number) => Promise<void>,
  budget: LeaguepediaBudget = leaguepediaBudget,
) {
  // One worker sends Leaguepedia requests at a time, so one wait for the spacing is enough.
  for (let waited = false; ; waited = true) {
    const wait = await transaction(pool, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(9183278)");
      const now = clock();
      const paused = (
        await c.query<{ until: Date }>(
          "SELECT until FROM provider_pauses WHERE provider=$1 AND until>$2",
          [provider, now],
        )
      ).rows[0];
      if (paused) throw new DeferredRequest(paused.until);
      await c.query(
        "DELETE FROM provider_request_ledger WHERE provider=$1 AND requested_at<=$2::timestamptz-interval '1 hour'",
        [provider, now],
      );
      const used = (
        await c.query<{ count: number; oldest: Date | null; latest: Date | null }>(
          "SELECT count(*)::integer AS count,min(requested_at) AS oldest,max(requested_at) AS latest FROM provider_request_ledger WHERE provider=$1",
          [provider],
        )
      ).rows[0]!;
      if (used.count >= budget.perHour)
        throw new DeferredRequest(new Date(used.oldest!.valueOf() + 3_600_000));
      const spacing = used.latest ? used.latest.valueOf() + budget.spacingMs - now.valueOf() : 0;
      if (spacing > 0 && !waited) return spacing;
      await c.query("INSERT INTO provider_request_ledger(provider,requested_at) VALUES($1,$2)", [
        provider,
        now,
      ]);
      return 0;
    });
    if (wait <= 0) return;
    await pause(wait);
  }
}

/**
 * Pauses every Leaguepedia job after the wiki refuses a request. The pause lasts as long as the
 * reply's Retry-After, and at least the exponential backoff for this many consecutive refusals.
 */
export async function pauseLeaguepedia(pool: Pool, now: Date, refusal: Refusal): Promise<Date> {
  const { kind, reason, retryAfter } = refusal;
  return transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183278)");
    const strikes =
      (
        await c.query<{ strikes: number }>(
          "SELECT strikes FROM provider_pauses WHERE provider=$1",
          [provider],
        )
      ).rows[0]?.strikes ?? 0;
    const backoff = Math.min(longestPauseMs, firstPauseMs[kind] * 2 ** strikes);
    const seconds = Number(retryAfter);
    const asked =
      retryAfter === null
        ? 0
        : Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - now.valueOf();
    const until = new Date(now.valueOf() + Math.min(longestPauseMs, Math.max(backoff, asked || 0)));
    await c.query(
      `INSERT INTO provider_pauses(provider,until,reason,strikes) VALUES($1,$2,$3,1)
       ON CONFLICT(provider) DO UPDATE SET until=EXCLUDED.until,reason=EXCLUDED.reason,
         strikes=provider_pauses.strikes+1`,
      [provider, until, reason],
    );
    return until;
  });
}

/** A usable reply ends a run of refusals, so the next one starts from the shortest pause again. */
export async function clearLeaguepediaStrikes(pool: Pool) {
  await pool.query("UPDATE provider_pauses SET strikes=0 WHERE provider=$1 AND strikes>0", [
    provider,
  ]);
}
