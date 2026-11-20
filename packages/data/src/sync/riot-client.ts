import type { Pool } from "pg";
import { riotRoutingSchema, type RiotRouting } from "../providers/riot.js";
import { DeferredRequest, observeRiotLimits, reserveRiotRequest } from "./quota.js";

export interface RiotClientOptions {
  key: string;
  clock: () => Date;
  fetch: typeof fetch;
  pause: (milliseconds: number) => Promise<void>;
  /** Waits up to this long in the worker; a longer wait reschedules the job. */
  maximumWaitMs?: number;
  /** Attempts per call, counting 429 retries; each attempt reserves from the ledger. */
  maximumAttempts?: number;
}
export class RiotConnectionError extends Error {
  constructor() {
    super("Riot connection failed; saved data is unchanged.");
  }
}

/**
 * Sends Riot requests from the worker. Every attempt reserves from the persisted ledger first;
 * a request that cannot reserve waits briefly or is rescheduled, and is never sent early.
 */
export function riotClient(pool: Pool, options: RiotClientOptions) {
  const maximumWaitMs = options.maximumWaitMs ?? 15000;
  const maximumAttempts = options.maximumAttempts ?? 3;
  async function reserve(region: RiotRouting, method: string) {
    for (;;) {
      const until = await reserveRiotRequest(pool, region, method, options.clock());
      if (!until) return;
      const wait = until.valueOf() - options.clock().valueOf();
      if (wait > maximumWaitMs) throw new DeferredRequest(until);
      await options.pause(Math.max(0, wait));
    }
  }
  /**
   * GETs a path on a routing value. `method` names the Riot endpoint for its method limit, such as
   * "league-v4.challenger". Returns the final response, including a 429 after the last attempt.
   */
  return async function get(region: RiotRouting, method: string, path: string) {
    const routing = riotRoutingSchema.parse(region);
    if (!path.startsWith("/")) throw new Error("Riot paths are absolute.");
    for (let attempt = 1; ; attempt++) {
      await reserve(routing, method);
      let response: Response;
      try {
        response = await options.fetch(`https://${routing}.api.riotgames.com${path}`, {
          headers: { "X-Riot-Token": options.key },
          signal: AbortSignal.timeout(30000),
          redirect: "error",
        });
      } catch {
        throw new RiotConnectionError();
      }
      await observeRiotLimits(
        pool,
        routing,
        method,
        response.headers,
        response.status,
        options.clock(),
      );
      if (response.status !== 429 || attempt >= maximumAttempts) return response;
    }
  };
}
export type RiotGet = ReturnType<typeof riotClient>;
