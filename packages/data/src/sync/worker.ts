import { importProAccountLinks } from "../persistence/pro-accounts.js";
import { ProAccountImportError } from "../domain/pro-accounts.js";
import { resolve } from "node:path";
import { importReplayMetadata, ReplayImportError } from "../persistence/replays.js";
import { importReplayTrack, ReplayTrackImportError } from "../persistence/replay-tracks.js";
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
import { archiveApiDownload, archiveDownload, archiveFileId } from "../providers/oracle.js";
import {
  parseChampionCatalog,
  parseItemCatalog,
  parseMetadata,
  parseRuneCatalog,
  parseSpellCatalog,
  parseVersionCatalog,
  parseVersions,
} from "../providers/ddragon.js";
import { normalizePatch } from "../domain/patches.js";
import { ChampionMappingError, saveGameCatalog } from "../persistence/catalog.js";
import { recordOraclePatches, savePatchCatalog } from "../persistence/patches.js";
import { claim, enqueue, schedule } from "./queue.js";
import { RiotConnectionError, riotClient } from "./riot-client.js";
import { parseRiotMatch } from "../providers/riot-match.js";
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import { activeWinProbabilityModel, trainWinProbabilityModel } from "../persistence/wp-models.js";
import { scorePendingWpa } from "../persistence/wpa.js";
import { trainCheckpointModel } from "../persistence/pro-wp.js";
import { rebuildWpaAggregates } from "../persistence/wpa-leaderboards.js";
import {
  dirtyPatches,
  markAllDirty,
  markOracleYearDirty,
  rebuildPatch,
} from "../persistence/aggregates.js";
import {
  keptPatches,
  pruneBatch,
  pruneUnfetched,
  recordRetention,
  requeuePruned,
} from "../persistence/riot-retention.js";
import {
  markTimelineUnavailable,
  pendingTimelines,
  saveTimeline,
} from "../persistence/riot-timelines.js";
import {
  markMatchUnavailable,
  pendingMatches,
  saveRiotMatch,
} from "../persistence/riot-matches.js";
import {
  accountsToResolve,
  currentPatchKey,
  matchIdCount,
  playersToCrawl,
  recordCrawl,
  saveMatchIds,
  markLadderAttempt,
  recordLadderFailure,
  saveAccount,
  saveLadder,
} from "../persistence/riot.js";
import { DeferredRequest, observeQuota, reserveRequest } from "./quota.js";
import { resolveStored, saveCatalog, saveIdentityContext } from "../persistence/entities.js";
import { refreshDrafts } from "./drafts.js";
import { cacheCatalogImages } from "./catalog-images.js";
import { cacheImages, cacheMapImage } from "./images.js";
import { stageOracleArtifact } from "./artifacts.js";
import { importOracleArchive, retainOracleArtifacts } from "../persistence/archive.js";
import {
  riotKeyCheckResult,
  riotKeyCheckPath,
  riotKeyFingerprint,
  type RiotKeyConfig,
  type RiotPlatform,
  accountRoute,
  apexTiers,
  matchRoute,
  parseMatchIds,
  rankedSoloQueueId,
  riotRoutingSchema,
  parseAccount,
  parseLeagueList,
  soloQueue,
} from "../providers/riot.js";

export interface WorkerOptions {
  clock?: () => Date;
  fetch?: typeof fetch;
  token?: string;
  /** Optional Google Drive API key; downloads the same official file under the API's own quota. */
  driveApiKey?: string;
  currentFile?: string;
  importDirectory?: string;
  keepReplayFiles?: boolean;
  pause?: (milliseconds: number) => Promise<void>;
  /** Validated RIOT_API_KEY; absent when Riot is not configured. Never logged or stored. */
  riot?: RiotKeyConfig;
  /** Platforms selected with RIOT_PLATFORMS, validated at startup. */
  riotPlatforms?: readonly RiotPlatform[];
  /** Most match ids kept per region and patch (RIOT_MATCH_CAP). */
  riotMatchCap?: number;
  /** Patches before the current one whose solo-queue data is kept (RIOT_RETAIN_PATCHES). */
  riotRetainPatches?: number;
  /**
   * Win probability training: the fewest training matches (solo queue) and games (pro
   * checkpoints) to publish a model, and the seed.
   */
  winProbability?: { minimumMatches?: number; minimumProGames?: number; seed?: number };
}
class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
// Riot key checks and identity resolution report through their own status, not source_status.
// Riot jobs report through their own status tables; draft aggregation has no provider request.
const tracksSource = (r: SyncRequest) =>
  r.kind !== "resolve" &&
  r.kind !== "drafts" &&
  r.kind !== "pro-account-links" &&
  r.kind !== "replay-track" &&
  r.kind !== "replay-metadata" &&
  r.kind !== "aggregate" &&
  r.kind !== "wp-train" &&
  !r.kind.startsWith("riot-");
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
    if (options.driveApiKey) {
      try {
        return await request(archiveApiDownload(year, options.driveApiKey), false, 300000);
      } catch (error) {
        // An API refusal (quota, disabled API, invalid key) falls back to the public download.
        if (!(error instanceof ProviderError)) throw error;
      }
    }
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
    if (/<title>[^<]*Quota exceeded/i.test(html))
      throw new ProviderError(
        "Archive download quota exceeded; the official download will be retried later.",
        true,
      );
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
  const riotFingerprint = options.riot ? riotKeyFingerprint(options.riot.key) : null;
  let riotObserved = false;
  /** Records whether a key is configured; a new key restarts its expiry clock and is checked. */
  async function observeRiotKey() {
    if (riotObserved) return;
    if (!options.riot)
      await pool.query(
        `UPDATE riot_key_status SET configured=false,kind=NULL,fingerprint=NULL,set_at=NULL,
           state='missing',checked_at=NULL,
           detail='RIOT_API_KEY is not configured; Riot jobs are skipped.' WHERE id=true`,
      );
    else {
      const changed = await pool.query(
        `UPDATE riot_key_status SET configured=true,fingerprint=$1,set_at=$2,state='untested',
           checked_at=NULL,detail=NULL WHERE id=true AND fingerprint IS DISTINCT FROM $1`,
        [riotFingerprint, clock()],
      );
      await pool.query("UPDATE riot_key_status SET kind=$1 WHERE id=true", [options.riot.kind]);
      if (changed.rowCount) await enqueue(pool, { kind: "riot-key" }, clock());
    }
    riotObserved = true;
  }
  const riot = options.riot
    ? riotClient(pool, { key: options.riot.key, clock, fetch: fetcher, pause })
    : null;
  async function checkRiotKey(): Promise<number> {
    if (!riot) return 0;
    let response: Response;
    try {
      response = await riot("na1", "lol-status-v4.getPlatformData", riotKeyCheckPath);
    } catch (error) {
      if (error instanceof RiotConnectionError)
        throw new ProviderError("Riot connection failed; the key status is unchanged.", true);
      throw error;
    }
    const result = riotKeyCheckResult(response.status);
    if (result === "retry")
      throw new ProviderError(
        `Riot returned HTTP ${response.status}; the key status is unchanged.`,
        true,
      );
    await pool.query(
      "UPDATE riot_key_status SET state=$1,checked_at=$2,detail=$3 WHERE id=true AND fingerprint=$4",
      [
        result,
        clock(),
        result === "rejected" ? `Riot rejected the key (HTTP ${response.status}).` : null,
        riotFingerprint,
      ],
    );
    return 1;
  }
  /** Syncs each selected platform's apex tiers; a failed platform keeps its last ladder. */
  async function syncLadders(): Promise<number> {
    if (!riot) return 0;
    const failed: string[] = [];
    let total = 0;
    for (const platform of options.riotPlatforms ?? []) {
      await markLadderAttempt(pool, platform, clock());
      try {
        const entries = [];
        for (const { tier, path } of apexTiers) {
          const response = await riot(
            platform,
            `league-v4.${path}`,
            `/lol/league/v4/${path}/by-queue/${soloQueue}`,
          );
          if (!response.ok) throw new Error(`Riot returned HTTP ${response.status}.`);
          entries.push(...parseLeagueList(await response.json(), tier));
        }
        await saveLadder(pool, platform, entries, clock());
        total += entries.length;
      } catch (error) {
        if (error instanceof DeferredRequest) throw error;
        const detail =
          error instanceof z.ZodError
            ? "Riot returned an unexpected ladder."
            : error instanceof Error
              ? error.message
              : "Ladder refresh failed.";
        await recordLadderFailure(pool, platform, `${detail} The last ladder is kept.`);
        failed.push(platform);
      }
    }
    if (total) await enqueue(pool, { kind: "riot-accounts" }, clock());
    if (failed.length)
      throw new ProviderError(
        `Ladder refresh failed for ${failed.join(", ")}; their last ladders are kept.`,
        true,
      );
    return total;
  }
  /**
   * Resolves ladder players with no account or a check older than a week, a bounded batch per
   * run. A failed lookup leaves the stored account and its timestamps untouched.
   */
  async function resolveAccounts(): Promise<number> {
    if (!riot) return 0;
    const due = await accountsToResolve(pool, new Date(clock().valueOf() - 7 * 86400000), 250);
    let resolved = 0;
    let failures = 0;
    for (const { puuid, platform } of due) {
      try {
        const response = await riot(
          accountRoute(platform),
          "account-v1.getByPuuid",
          `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await saveAccount(pool, parseAccount(await response.json(), puuid), clock());
        resolved++;
      } catch (error) {
        if (error instanceof DeferredRequest) throw error;
        failures++;
      }
    }
    if (failures && !resolved)
      throw new ProviderError(
        `Riot account lookups failed (${failures}); saved accounts are unchanged.`,
        true,
      );
    return resolved;
  }
  /**
   * Pages ranked solo queue match ids for current ladder players, newest first, until each
   * region reaches its cap for the current patch. Progress is recorded per player, so an
   * interrupted crawl resumes, and a later crawl asks only for matches since the last one.
   */
  async function crawlMatchIds(): Promise<number> {
    if (!riot) return 0;
    const patchKey = await currentPatchKey(pool);
    if (!patchKey)
      throw new ProviderError("No patch catalog yet; refresh game metadata before crawling.");
    const cap = options.riotMatchCap ?? 2000;
    const now = clock();
    const players = await playersToCrawl(pool, new Date(now.valueOf() - 6 * 3600000), 100);
    const full = new Set<string>();
    let added = 0;
    for (const player of players) {
      const region = matchRoute(player.platform);
      if (full.has(region)) continue;
      const since = Math.max(player.crawledAt?.valueOf() ?? 0, clock().valueOf() - 14 * 86400000);
      let seen = 0;
      for (let start = 0; start < 500; start += 100) {
        const room = cap - (await matchIdCount(pool, region, patchKey));
        if (room <= 0) {
          full.add(region);
          break;
        }
        const query = new URLSearchParams({
          queue: String(rankedSoloQueueId),
          type: "ranked",
          startTime: String(Math.floor(since / 1000)),
          start: String(start),
          count: "100",
        });
        const response = await riot(
          region,
          "match-v5.getMatchIdsByPUUID",
          `/lol/match/v5/matches/by-puuid/${encodeURIComponent(player.puuid)}/ids?${query}`,
        );
        if (response.status === 400 || response.status === 404) break;
        if (!response.ok)
          throw new ProviderError(
            `Riot returned HTTP ${response.status} for match ids; crawl progress is kept.`,
            response.status === 429 || response.status >= 500,
          );
        const ids = parseMatchIds(await response.json());
        seen += ids.length;
        added += await saveMatchIds(
          pool,
          { puuid: player.puuid, platform: player.platform, region, patchKey },
          ids,
          room,
          clock(),
        );
        if (ids.length < 100) break;
      }
      // A player cut short by the cap is crawled first once there is room again.
      if (!full.has(region)) await recordCrawl(pool, player, seen, clock());
    }
    return added;
  }
  /**
   * Fetches queued match ids, a bounded batch per run, oldest first. Each payload is validated
   * before one transaction writes it. A 404 or an invalid payload is recorded and skipped; a
   * 429 or 5xx retries the job with earlier matches kept.
   */
  async function ingestMatches(): Promise<number> {
    if (!riot) return 0;
    let ingested = 0;
    for (const { matchId, region } of await pendingMatches(pool, 50)) {
      const response = await riot(
        riotRoutingSchema.parse(region),
        "match-v5.getMatch",
        `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
      );
      if (response.status === 404) {
        await markMatchUnavailable(pool, matchId, "missing", clock());
        continue;
      }
      if (!response.ok)
        throw new ProviderError(
          `Riot returned HTTP ${response.status} for a match; ingested matches are kept.`,
          response.status === 429 || response.status >= 500,
        );
      const payload: unknown = await response.json();
      let match;
      try {
        match = parseRiotMatch(payload, matchId);
      } catch {
        await markMatchUnavailable(pool, matchId, "invalid", clock());
        continue;
      }
      await saveRiotMatch(pool, match, payload, clock());
      ingested++;
    }
    // Refresh the affected patches' aggregates right after ingestion.
    if (ingested) await aggregate(false);
    return ingested;
  }
  /**
   * Fetches timelines for ingested matches, a bounded batch per run. Each timeline is validated
   * and written in one transaction; a 404 or an invalid timeline is recorded and skipped.
   */
  async function ingestTimelines(): Promise<number> {
    if (!riot) return 0;
    let ingested = 0;
    for (const { matchId, region } of await pendingTimelines(pool, 50)) {
      const response = await riot(
        riotRoutingSchema.parse(region),
        "match-v5.getTimeline",
        `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
      );
      if (response.status === 404) {
        await markTimelineUnavailable(pool, matchId, "missing", clock());
        continue;
      }
      if (!response.ok)
        throw new ProviderError(
          `Riot returned HTTP ${response.status} for a timeline; ingested timelines are kept.`,
          response.status === 429 || response.status >= 500,
        );
      let timeline;
      try {
        timeline = parseRiotTimeline(await response.json(), matchId);
      } catch {
        await markTimelineUnavailable(pool, matchId, "invalid", clock());
        continue;
      }
      try {
        await saveTimeline(pool, timeline, clock());
        ingested++;
      } catch (error) {
        // A timeline naming participants the ingested match does not have (foreign key).
        if ((error as { code?: string }).code !== "23503") throw error;
        await markTimelineUnavailable(pool, matchId, "invalid", clock());
      }
    }
    if (ingested) await aggregate(false);
    return ingested;
  }
  /**
   * Keeps solo-queue data for the current patch and the configured previous patches. Prunes in
   * bounded batches, and requeues pruned matches of kept patches so the match job backfills them.
   * Only riot_* match tables are touched; pro data is not.
   */
  async function applyRetention(): Promise<number> {
    const previous = options.riotRetainPatches ?? 2;
    const kept = await keptPatches(pool, previous);
    if (!kept.length) return 0;
    let pruned = 0;
    for (let batch = 0; batch < 50; batch++) {
      const count = await pruneBatch(pool, kept, 200);
      pruned += count;
      if (count < 200) break;
    }
    await pruneUnfetched(pool, kept, 10000);
    const backfilled = await requeuePruned(pool, kept, 1000);
    await recordRetention(pool, { previous, kept, pruned, backfilled }, clock());
    return pruned + backfilled;
  }
  /** Scores win probability added for matches the active model has not scored yet. */
  async function scoreActiveWpa() {
    const model = await activeWinProbabilityModel(pool);
    if (!model) return 0;
    const scored = await scorePendingWpa(pool, model, clock());
    // Leaderboards read the active model's aggregates; rebuild them when new games were scored
    // or the model has none yet.
    const built = await pool.query("SELECT 1 FROM wpa_aggregates WHERE model_id=$1 LIMIT 1", [
      model.id,
    ]);
    if (scored || !built.rowCount)
      await transaction(pool, (c) => rebuildWpaAggregates(c, model.id, clock()));
    return scored;
  }
  /** Rebuilds the aggregates of patches whose facts changed, one transaction per patch. */
  async function aggregate(rebuild: boolean): Promise<number> {
    if (rebuild) await markAllDirty(pool, clock());
    let rows = 0;
    for (const { source, patchKey } of await dirtyPatches(pool, 200))
      rows += await rebuildPatch(pool, source, patchKey, clock());
    await scoreActiveWpa();
    return rows;
  }
  async function perform(r: SyncRequest): Promise<number> {
    if (r.kind === "aggregate") return aggregate(r.rebuild ?? false);
    if (r.kind === "wp-train") {
      const trained = await trainWinProbabilityModel(pool, clock(), {
        minimumMatches: options.winProbability?.minimumMatches ?? 500,
        seed: options.winProbability?.seed ?? 20261116,
      });
      // A newly active model scores events from the start; the aggregate job keeps it current.
      if (trained.active) await scoreActiveWpa();
      const pro = await trainCheckpointModel(pool, clock(), {
        minimumGames: options.winProbability?.minimumProGames ?? 200,
        seed: options.winProbability?.seed ?? 20261116,
      });
      return Number(trained.active) + Number(pro.active);
    }
    if (r.kind === "riot-key") return checkRiotKey();
    if (r.kind === "riot-retention") return applyRetention();
    if (r.kind === "riot-timeline") return ingestTimelines();
    if (r.kind === "riot-match") return ingestMatches();
    if (r.kind === "riot-match-ids") return crawlMatchIds();
    if (r.kind === "riot-ladder") return syncLadders();
    if (r.kind === "riot-accounts") return resolveAccounts();
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
    if (r.kind === "pro-account-links") {
      try {
        return await importProAccountLinks(pool, r.file, clock());
      } catch (error) {
        throw new ProviderError(
          error instanceof ProAccountImportError
            ? error.message
            : "Pro account links could not be read or stored; saved links are unchanged.",
        );
      }
    }
    if (r.kind === "replay-metadata") {
      try {
        return await importReplayMetadata(pool, {
          file: r.file,
          ...(r.platform ? { platform: r.platform } : {}),
          directory: resolve(
            options.importDirectory ?? resolve(process.cwd(), ".local/imports"),
            "replays",
          ),
          keepFiles: options.keepReplayFiles ?? false,
          now: clock(),
        });
      } catch (error) {
        throw new ProviderError(
          error instanceof ReplayImportError
            ? error.message
            : "Replay metadata could not be read or stored; saved metadata is unchanged.",
        );
      }
    }
    if (r.kind === "replay-track") {
      try {
        return await importReplayTrack(pool, r.file, clock());
      } catch (error) {
        throw new ProviderError(
          error instanceof ReplayTrackImportError
            ? error.message
            : "Replay track could not be read or stored; saved tracks are unchanged.",
        );
      }
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
        await recordOraclePatches(pool, clock());
        await refreshDrafts(pool, clock, r.year);
        // Pro statistics read the derived drafts, so aggregate after deriving them.
        await markOracleYearDirty(pool, r.year, clock());
        await aggregate(false);
        await retainOracleArtifacts(pool, clock().getUTCFullYear());
        return result.games;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          error instanceof Error ? error.message : "Historical import failed validation.",
        );
      }
    }
    if (r.kind === "drafts") {
      const drafts = await refreshDrafts(pool, clock);
      await markOracleYearDirty(pool, null, clock());
      await aggregate(false);
      return drafts;
    }
    if (r.kind === "metadata") {
      const versions = parseVersionCatalog(
        await (await request("https://ddragon.leagueoflegends.com/api/versions.json")).json(),
      );
      const version = parseVersions(versions)[0]!;
      // The patch catalog is complete once versions.json validates; later metadata failures keep it.
      await savePatchCatalog(pool, versions, clock());
      const patchKey = normalizePatch(version)?.key;
      if (!patchKey)
        throw new ProviderError(`Data Dragon version ${version} is not a known patch.`);
      const file = async (name: string): Promise<unknown> =>
        (
          await request(
            `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/${name}.json`,
          )
        ).json();
      const [champion, item, runes, summoner] = [
        await file("champion"),
        await file("item"),
        await file("runesReforged"),
        await file("summoner"),
      ];
      const records = [
        { kind: "champion", document: parseMetadata(champion, version, "champion") },
        { kind: "item", document: parseMetadata(item, version, "item") },
      ];
      const catalog = {
        champions: parseChampionCatalog(champion, version),
        items: parseItemCatalog(item, version),
        runes: parseRuneCatalog(runes),
        spells: parseSpellCatalog(summoner, version),
      };
      await transaction(pool, async (c) => {
        for (const r of records)
          await c.query(
            "INSERT INTO metadata VALUES($1,$2,$3) ON CONFLICT(version,kind) DO UPDATE SET document=EXCLUDED.document",
            [version, r.kind, r.document],
          );
        await saveGameCatalog(c, patchKey, version, catalog, clock());
      });
      await cacheCatalogImages(pool, patchKey, (url) => request(url, false, 15000), clock);
      await cacheMapImage(pool, (url) => request(url, false, 15000), clock);
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
        await observeRiotKey();
        if (scheduleDue) await schedule(pool, clock(), options.currentFile);
        const job = await claim(pool, clock());
        if (!job) return { state: "idle" as const };
        const source = sourceOf(job.request);
        if (tracksSource(job.request))
          await pool.query("UPDATE source_status SET last_attempt=$2 WHERE source=$1", [
            source,
            clock(),
          ]);
        try {
          const records = await perform(job.request);
          await transaction(pool, async (c) => {
            if (tracksSource(job.request))
              await c.query(
                "UPDATE source_status SET last_success=$2,error=NULL,records=$3 WHERE source=$1",
                [source, clock(), records],
              );
            if (job.request.kind.startsWith("riot-"))
              await c.query(
                `INSERT INTO riot_job_status(kind,last_success,records) VALUES($1,$2,$3)
                 ON CONFLICT(kind) DO UPDATE SET last_success=EXCLUDED.last_success,
                   records=EXCLUDED.records`,
                [job.request.kind, clock(), records],
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
              : error instanceof ProviderError || error instanceof ChampionMappingError || deferred
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
            if (tracksSource(job.request))
              await c.query("UPDATE source_status SET error=$2 WHERE source=$1", [source, message]);
            if (job.request.kind.startsWith("riot-"))
              await c.query(
                `INSERT INTO riot_job_status(kind,last_error_at,error) VALUES($1,$2,$3)
                 ON CONFLICT(kind) DO UPDATE SET last_error_at=EXCLUDED.last_error_at,
                   error=EXCLUDED.error`,
                [job.request.kind, clock(), message],
              );
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
