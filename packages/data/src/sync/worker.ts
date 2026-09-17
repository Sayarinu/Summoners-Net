import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import type { Pool } from "pg";
import type { Source, SyncRequest } from "../domain/models.js";
import { transaction } from "../persistence/database.js";
import { digest, saveGames, saveMatches, saveRosters } from "../persistence/write.js";
import { parseMatches, parseTeams } from "../providers/pandascore.js";
import { archiveDownload, parseHistory } from "../providers/oracle.js";
import { parseMetadata, parseVersions } from "../providers/ddragon.js";
import { claim, schedule } from "./queue.js";
import { DeferredRequest, observeQuota, reserveRequest } from "./quota.js";

export interface WorkerOptions {
  clock?: () => Date;
  fetch?: typeof fetch;
  token?: string;
  currentFile?: string;
}
class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
const sourceOf = (r: SyncRequest): Source =>
  r.kind === "history" ? "oracle" : r.kind === "metadata" ? "ddragon" : "pandascore";
export function worker(pool: Pool, options: WorkerOptions) {
  const clock = options.clock ?? (() => new Date());
  const fetcher = options.fetch ?? fetch;
  async function request(url: string, panda = false): Promise<Response> {
    if (panda) {
      if (!options.token) throw new ProviderError("PANDASCORE_TOKEN is not configured.");
      await reserveRequest(pool, clock());
    }
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: panda ? { Authorization: `Bearer ${options.token}` } : {},
        signal: AbortSignal.timeout(60000),
        redirect: panda ? "error" : "follow",
      });
    } catch {
      throw new ProviderError("Provider connection failed; saved data is unchanged.", true);
    }
    if (panda) await observeQuota(pool, response.headers, response.status, clock());
    if (!response.ok)
      throw new ProviderError(
        `Provider returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    return response;
  }
  async function pandaPages(path: string) {
    const all: unknown[] = [];
    for (let page = 1; page <= 100; page++) {
      const url = new URL(`https://api.pandascore.co/lol/${path}`);
      url.searchParams.set("page[size]", "100");
      url.searchParams.set("page[number]", String(page));
      const response = await request(url.toString(), true);
      const body = z.array(z.unknown()).parse(await response.json());
      all.push(...body);
      // Never follow provider-supplied URLs with the credential. Reconstruct the next page.
      if (!/rel="next"/.test(response.headers.get("link") ?? "") && body.length < 100) return all;
    }
    throw new ProviderError(
      "Pagination exceeded the bounded 100-page import; saved data is unchanged.",
    );
  }
  async function perform(r: SyncRequest): Promise<number> {
    if (r.kind === "history") {
      let csv: string;
      if (r.file) {
        if ((await stat(r.file)).size > 256 * 1024 * 1024)
          throw new ProviderError("CSV exceeds 256 MiB");
        csv = await readFile(r.file, "utf8");
      } else {
        const response = await request(archiveDownload(r.year));
        if (response.headers.get("content-type")?.includes("text/html"))
          throw new ProviderError(
            "Archive returned HTML (download quota or confirmation). Import a local annual CSV.",
          );
        if (Number(response.headers.get("content-length")) > 256 * 1024 * 1024)
          throw new ProviderError("CSV exceeds 256 MiB");
        csv = await response.text();
      }
      const games = parseHistory(csv, r.year);
      await saveGames(pool, games, digest(csv), r.year);
      return games.length;
    }
    if (r.kind === "metadata") {
      const version = parseVersions(
        await (await request("https://ddragon.leagueoflegends.com/api/versions.json")).json(),
      )[0]!;
      const records: {
        kind: "champion" | "item";
        document: ReturnType<typeof parseMetadata>;
      }[] = [];
      for (const kind of ["champion", "item"] as const) {
        const raw: unknown = await (
          await request(
            `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/${kind}.json`,
          )
        ).json();
        records.push({ kind, document: parseMetadata(raw, version, kind) });
      }
      await transaction(pool, async (c) => {
        for (const r of records)
          await c.query(
            "INSERT INTO metadata VALUES($1,$2,$3) ON CONFLICT(version,kind) DO UPDATE SET document=EXCLUDED.document",
            [version, r.kind, r.document],
          );
      });
      return records.reduce((n, r) => n + Object.keys(r.document).length, 0);
    }
    if (r.kind === "rosters") {
      // Only identities observed in covered, recent/upcoming matches enter the roster refresh.
      const result = await pool.query<{ id: string }>(
        "SELECT DISTINCT t->>'sourceId' AS id FROM matches m CROSS JOIN LATERAL jsonb_array_elements(m.document->'teams') t WHERE starts_at >= $1::timestamptz-interval '180 days' ORDER BY id",
        [clock()],
      );
      const all: ReturnType<typeof parseTeams> = [];
      for (let i = 0; i < result.rows.length; i += 50) {
        const ids = result.rows.slice(i, i + 50).map((t) => t.id);
        const entries = parseTeams(await pandaPages(`teams?filter[id]=${ids.join(",")}`)).filter(
          (t) => ids.includes(t.team.sourceId),
        );
        all.push(...entries);
      }
      await saveRosters(pool, all, clock());
      return all.length;
    }
    const paths =
      r.kind === "running"
        ? ["matches/running"]
        : [
            "matches/upcoming",
            "matches/past?sort=-begin_at&range[begin_at]=" +
              new Date(clock().valueOf() - 30 * 86400000).toISOString() +
              "," +
              clock().toISOString(),
          ];
    const matches = [];
    for (const path of paths) matches.push(...parseMatches(await pandaPages(path), clock()));
    await saveMatches(pool, matches);
    return matches.length;
  }
  return async function runNext(scheduleDue = false) {
    const lock = await pool.connect();
    try {
      const acquired = await lock.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(9183275) AS locked",
      );
      if (!acquired.rows[0]!.locked) return { state: "busy" as const };
      try {
        if (scheduleDue) await schedule(pool, clock(), options.currentFile);
        const job = await claim(pool, clock());
        if (!job) return { state: "idle" as const };
        const source = sourceOf(job.request);
        await pool.query("UPDATE source_status SET last_attempt=$2 WHERE source=$1", [
          source,
          clock(),
        ]);
        try {
          const records = await perform(job.request);
          await transaction(pool, async (c) => {
            await c.query(
              "UPDATE source_status SET last_success=$2,error=NULL,records=$3 WHERE source=$1",
              [source, clock(), records],
            );
            await c.query(
              "UPDATE sync_jobs SET state='done',lease_until=NULL,error=NULL WHERE id=$1",
              [job.id],
            );
          });
          return { state: "done" as const, id: job.id, records };
        } catch (error) {
          const deferred = error instanceof DeferredRequest;
          const retry =
            deferred || (error instanceof ProviderError && error.retryable && job.attempts < 3);
          const message =
            error instanceof z.ZodError
              ? "Provider schema validation failed; saved data is unchanged."
              : error instanceof ProviderError || deferred
                ? error.message
                : job.request.kind === "history"
                  ? "Historical import failed validation or could not be read; saved data is unchanged."
                  : "Synchronization failed; saved data is unchanged.";
          const available = deferred
            ? error.until
            : new Date(clock().valueOf() + 60000 * 2 ** Math.min(job.attempts, 6));
          await transaction(pool, async (c) => {
            await c.query(
              "UPDATE sync_jobs SET state=$2,available_at=$3,lease_until=NULL,error=$4,attempts=attempts-$5 WHERE id=$1",
              [job.id, retry ? "queued" : "failed", available, message, deferred ? 1 : 0],
            );
            await c.query("UPDATE source_status SET error=$2 WHERE source=$1", [source, message]);
          });
          return {
            state: retry ? ("queued" as const) : ("failed" as const),
            id: job.id,
            error: message,
          };
        }
      } finally {
        await lock.query("SELECT pg_advisory_unlock(9183275)");
      }
    } finally {
      lock.release();
    }
  };
}
