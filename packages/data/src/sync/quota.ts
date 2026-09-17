import type { Pool } from "pg";
import { transaction } from "../persistence/database.js";
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
