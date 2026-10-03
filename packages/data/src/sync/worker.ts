import { setTimeout as pauseFor } from "node:timers/promises";
import { z } from "zod";
import type { Pool } from "pg";
import type { Source, SyncRequest } from "../domain/models.js";
import { transaction } from "../persistence/database.js";
import { saveMatches, saveRosters } from "../persistence/write.js";
import {
  parseMatches,
  parseTeams,
  parseCoveredLeagues,
  parseTournamentRosters,
} from "../providers/pandascore.js";
import { archiveDownload, archiveFileId } from "../providers/oracle.js";
import { parseMetadata, parseVersions } from "../providers/ddragon.js";
import { claim, schedule } from "./queue.js";
import { DeferredRequest, observeQuota, reserveRequest } from "./quota.js";
import { resolveStored, saveCatalog, saveIdentityContext } from "../persistence/entities.js";
import { cacheImages } from "./images.js";
import { stageOracleArtifact } from "./artifacts.js";
import { importOracleArchive, retainOracleArtifacts } from "../persistence/archive.js";

export interface WorkerOptions {
  clock?: () => Date;
  fetch?: typeof fetch;
  token?: string;
  currentFile?: string;
  importDirectory?: string;
  pause?: (milliseconds: number) => Promise<void>;
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
  const pause = options.pause ?? pauseFor;
  let lastPandaAttempt = 0;
  async function request(url: string, panda = false, timeoutMs = 60000): Promise<Response> {
    if (panda) {
      if (!options.token) throw new ProviderError("PANDASCORE_TOKEN is not configured.");
      // Space catalog/backfill requests as well as respecting the durable hourly ceiling.
      const delay = Math.min(1000, 1000 - (clock().valueOf() - lastPandaAttempt));
      if (delay > 0) await pause(delay);
      await reserveRequest(pool, clock());
      lastPandaAttempt = clock().valueOf();
    }
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: panda ? { Authorization: `Bearer ${options.token}` } : {},
        signal: AbortSignal.timeout(timeoutMs),
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
  async function archiveResponse(year: number): Promise<Response> {
    const response = await request(archiveDownload(year), false, 300000);
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) return response;
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("Archive returned an HTML/quota page.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16384) throw new ProviderError("Archive returned an oversized HTML page.");
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const html = Buffer.concat(chunks).toString("utf8");
    const form = html.match(
      /<form\b[^>]*action="([^"]+)"[^>]*method="get"[^>]*>([\s\S]*?)<\/form>/i,
    );
    const fields = new Map<string, string>();
    for (const input of form?.[2]?.matchAll(/<input\b[^>]*>/gi) ?? []) {
      const name = input[0].match(/\bname="([^"]+)"/i)?.[1];
      const value = input[0].match(/\bvalue="([^"]+)"/i)?.[1];
      if (name && value) fields.set(name, value);
    }
    const uuid = fields.get("uuid");
    if (
      !html.includes("Google Drive - Virus scan warning") ||
      form?.[1] !== "https://drive.usercontent.google.com/download" ||
      fields.get("id") !== archiveFileId(year) ||
      fields.get("export") !== "download" ||
      fields.get("confirm") !== "t" ||
      !uuid ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(uuid)
    )
      throw new ProviderError(
        "Archive returned an HTML/quota page; official download unavailable.",
      );
    const url = new URL("https://drive.usercontent.google.com/download");
    for (const name of ["id", "export", "confirm", "uuid"])
      url.searchParams.set(name, fields.get(name)!);
    return request(url.toString(), false, 300000);
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
    if (r.kind === "entity-rosters") {
      const tournaments = (
        await pool.query<{ id: string; first: Date; last: Date }>(
          `SELECT document->>'tournamentSourceId' AS id,min((document->>'startsAt')::timestamptz) AS first,max((document->>'startsAt')::timestamptz) AS last FROM identity_match_context WHERE year=$1 AND document->>'tournamentSourceId' IS NOT NULL AND document->>'startsAt' IS NOT NULL GROUP BY document->>'tournamentSourceId' ORDER BY id`,
          [r.year],
        )
      ).rows;
      if (!tournaments.length)
        throw new ProviderError(
          "Backfill fixture context for this year before tournament rosters.",
        );
      for (const tournament of tournaments) {
        const fresh = await pool.query(
          "SELECT 1 FROM identity_tournament_rosters WHERE tournament_id=$1 AND observed_at>$2::timestamptz-interval '1 day'",
          [tournament.id, clock()],
        );
        if (fresh.rowCount) continue;
        const teams = parseTournamentRosters(
          await (
            await request(`https://api.pandascore.co/tournaments/${tournament.id}/rosters`, true)
          ).json(),
        );
        const at = clock();
        const contexts = teams.map((team) => ({
          ...team,
          observedAt: at.toISOString(),
          tournamentId: tournament.id,
          playedAfter: new Date(tournament.first.valueOf() - 12 * 3600000).toISOString(),
          playedBefore: new Date(tournament.last.valueOf() + 12 * 3600000).toISOString(),
        }));
        await pool.query(
          "INSERT INTO identity_tournament_rosters VALUES($1,$2,$3,$4) ON CONFLICT(tournament_id) DO UPDATE SET document=EXCLUDED.document,observed_at=EXCLUDED.observed_at",
          [tournament.id, r.year, JSON.stringify(contexts), at],
        );
      }
      await resolveStored(pool, clock());
      await cacheImages(pool, fetcher, clock);
      return tournaments.length;
    }
    if (r.kind === "entity-history") {
      const leagueIds = parseCoveredLeagues(await pandaPages("leagues?sort=id"), r.year);
      if (!leagueIds.length)
        throw new ProviderError("No covered leagues in provider context; saved evidence retained.");
      const matches = parseMatches(
        await pandaPages(
          `matches/past?sort=begin_at&filter[league_id]=${leagueIds.join(",")}&range[begin_at]=${r.year}-01-01T00:00:00Z,${r.year}-12-31T23:59:59Z`,
        ),
        clock(),
      );
      if (!matches.length)
        throw new ProviderError(
          "No historical fixture context available for this year; saved evidence retained.",
        );
      await saveIdentityContext(pool, matches, r.year, clock());
      await resolveStored(pool, clock());
      await cacheImages(pool, fetcher, clock);
      return matches.length;
    }
    if (r.kind === "entities" || r.kind === "resolve") {
      if (r.kind === "entities") {
        const teams = parseTeams(await pandaPages("teams?sort=id"));
        if (!teams.length)
          throw new ProviderError("Empty entity catalog; previous context retained.");
        await saveCatalog(
          pool,
          teams.map((t) => ({ ...t, observedAt: clock().toISOString() })),
        );
      }
      const report = await resolveStored(pool, clock());
      await cacheImages(pool, fetcher, clock);
      return report.links;
    }
    if (r.kind === "history") {
      try {
        const common = {
          year: r.year,
          ...(options.importDirectory ? { directory: options.importDirectory } : {}),
        };
        const artifact = r.file
          ? await stageOracleArtifact({
              ...common,
              file: r.file,
              acquisitionMethod: r.method ?? "manual",
            })
          : await stageOracleArtifact({
              ...common,
              response: await archiveResponse(r.year),
            });
        const result = await importOracleArchive(pool, artifact, r.year, clock());
        await retainOracleArtifacts(pool, clock().getUTCFullYear());
        return result.games;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          error instanceof Error ? error.message : "Historical import failed validation.",
        );
      }
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
        if (job.request.kind !== "resolve")
          await pool.query("UPDATE source_status SET last_attempt=$2 WHERE source=$1", [
            source,
            clock(),
          ]);
        try {
          const records = await perform(job.request);
          await transaction(pool, async (c) => {
            if (job.request.kind !== "resolve")
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
          const detail =
            error instanceof z.ZodError
              ? "Provider schema validation failed; saved data is unchanged."
              : error instanceof ProviderError || deferred
                ? error.message
                : job.request.kind === "history"
                  ? "Historical import failed validation or could not be read; saved data is unchanged."
                  : "Synchronization failed; saved data is unchanged.";
          const message =
            job.request.kind === "entity-rosters"
              ? `Tournament roster refresh incomplete. Valid observations are retained for resume. ${detail}`
              : detail;
          const available = deferred
            ? error.until
            : new Date(clock().valueOf() + 60000 * 2 ** Math.min(job.attempts, 6));
          await transaction(pool, async (c) => {
            await c.query(
              "UPDATE sync_jobs SET state=$2,available_at=$3,lease_until=NULL,error=$4,attempts=attempts-$5 WHERE id=$1",
              [job.id, retry ? "queued" : "failed", available, message, deferred ? 1 : 0],
            );
            if (job.request.kind !== "resolve")
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
