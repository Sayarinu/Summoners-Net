import type { Pool } from "pg";
import { transaction } from "../persistence/database.js";
import { defaultApplicationLimits, parseRateLimitHeader } from "../providers/riot.js";
export class DeferredRequest extends Error {
  constructor(public readonly until: Date) {
    super("Refresh is waiting for the shared provider budget.");
  }
}
export async function reserveRequest(pool: Pool, now: Date) {
  await transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183273)");
    const state = await c.query<{ cooldown_until: Date | null }>(
      "SELECT cooldown_until FROM quota_state WHERE id=true FOR UPDATE",
    );
    const cooldown = state.rows[0]?.cooldown_until;
    if (cooldown && cooldown > now) throw new DeferredRequest(cooldown);
    await c.query(
      "DELETE FROM request_ledger WHERE requested_at<=$1::timestamptz-interval '1 hour'",
      [now],
    );
    const budget = await c.query<{ count: number; oldest: Date | null }>(
      "SELECT count(*)::integer AS count,min(requested_at) AS oldest FROM request_ledger",
    );
    if ((budget.rows[0]?.count ?? 0) >= 600)
      throw new DeferredRequest(
        new Date((budget.rows[0]?.oldest?.valueOf() ?? now.valueOf()) + 3600000),
      );
    await c.query("INSERT INTO request_ledger(requested_at) VALUES($1)", [now]);
  });
}
export async function observeQuota(pool: Pool, headers: Headers, status: number, now: Date) {
  const retry = headers.get("retry-after");
  const remaining = headers.get("x-ratelimit-remaining") ?? headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-ratelimit-reset") ?? headers.get("x-rate-limit-reset");
  let until: number = 0;
  if (retry) {
    const seconds = Number(retry);
    until = Number.isFinite(seconds)
      ? now.valueOf() + Math.max(0, seconds) * 1000
      : Date.parse(retry);
  }
  if (remaining !== null && Number(remaining) <= 0) {
    const epoch = Number(reset);
    until = Math.max(
      until || 0,
      Number.isFinite(epoch) && epoch > now.valueOf() / 1000
        ? epoch * 1000
        : now.valueOf() + 3600000,
    );
  }
  if (status === 429) until = Math.max(until || 0, now.valueOf() + 60000);
  if (Number.isFinite(until) && until > now.valueOf())
    await pool.query(
      "UPDATE quota_state SET cooldown_until=GREATEST(cooldown_until,$1) WHERE id=true",
      [new Date(until)],
    );
}

// Riot: per routing value, an application scope (method '') and a scope per method.
const applicationScope = "";
/**
 * Reserves one Riot request for a region and method. Returns null when the request is recorded
 * and may be sent, or the time at which capacity frees up; nothing is recorded in that case.
 */
export async function reserveRiotRequest(
  pool: Pool,
  region: string,
  method: string,
  now: Date,
): Promise<Date | null> {
  return transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183277)");
    const paused = await c.query<{ until: Date }>(
      "SELECT max(until) AS until FROM riot_rate_pauses WHERE region=$1 AND method IN ('',$2) AND until>$3 HAVING max(until) IS NOT NULL",
      [region, method, now],
    );
    if (paused.rows[0]) return paused.rows[0].until;
    const limits = await c.query<{ method: string; window_seconds: number; limit_count: number }>(
      "SELECT method,window_seconds,limit_count FROM riot_rate_limits WHERE region=$1 AND method IN ('',$2)",
      [region, method],
    );
    const scopes = limits.rows.some((l) => l.method === applicationScope)
      ? limits.rows
      : [
          ...limits.rows,
          ...defaultApplicationLimits.map((l) => ({
            method: applicationScope,
            window_seconds: l.windowSeconds,
            limit_count: l.limit,
          })),
        ];
    let until: Date | null = null;
    for (const scope of scopes) {
      // The oldest request that must leave the window before one more fits.
      const blocking = await c.query<{ requested_at: Date }>(
        `SELECT requested_at FROM riot_request_ledger
         WHERE region=$1 AND ($2='' OR method=$2) AND requested_at>$3::timestamptz-make_interval(secs=>$4)
         ORDER BY requested_at DESC OFFSET $5-1 LIMIT 1`,
        [region, scope.method, now, scope.window_seconds, scope.limit_count],
      );
      const oldest = blocking.rows[0]?.requested_at;
      if (oldest) {
        const free = new Date(oldest.valueOf() + scope.window_seconds * 1000);
        if (!until || free > until) until = free;
      }
    }
    if (until) return until;
    await c.query(
      "DELETE FROM riot_request_ledger WHERE region=$1 AND requested_at<=$2::timestamptz-make_interval(secs=>$3)",
      [region, now, Math.max(3600, ...scopes.map((s) => s.window_seconds))],
    );
    await c.query("INSERT INTO riot_request_ledger(region,method,requested_at) VALUES($1,$2,$3)", [
      region,
      method,
      now,
    ]);
    return null;
  });
}
/**
 * Records the limits Riot reported and, for a 429, pauses the limited scope until Retry-After.
 * Returns the pause end for a 429.
 */
export async function observeRiotLimits(
  pool: Pool,
  region: string,
  method: string,
  headers: Headers,
  status: number,
  now: Date,
): Promise<Date | null> {
  return transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(9183277)");
    for (const [scope, header] of [
      [applicationScope, "x-app-rate-limit"],
      [method, "x-method-rate-limit"],
    ] as const) {
      const limits = parseRateLimitHeader(headers.get(header));
      if (!limits) continue;
      await c.query("DELETE FROM riot_rate_limits WHERE region=$1 AND method=$2", [region, scope]);
      for (const l of limits)
        await c.query(
          `INSERT INTO riot_rate_limits(region,method,window_seconds,limit_count,observed_at)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(region,method,window_seconds)
           DO UPDATE SET limit_count=LEAST(riot_rate_limits.limit_count,EXCLUDED.limit_count)`,
          [region, scope, l.windowSeconds, l.limit, now],
        );
    }
    if (status !== 429) return null;
    const seconds = Number(headers.get("retry-after"));
    // Without Retry-After (a service-level 429), back off for ten seconds.
    const until = new Date(
      now.valueOf() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000,
    );
    const scope = headers.get("x-rate-limit-type") === "application" ? applicationScope : method;
    await c.query(
      `INSERT INTO riot_rate_pauses(region,method,until) VALUES($1,$2,$3)
       ON CONFLICT(region,method) DO UPDATE SET until=GREATEST(riot_rate_pauses.until,EXCLUDED.until)`,
      [region, scope, until],
    );
    return until;
  });
}
