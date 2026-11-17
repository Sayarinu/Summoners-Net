import { proAccountFixture, proAccountFixtureLink } from "../../tests/pro-account-fixtures.js";
import { roflFixture } from "../../tests/rofl-fixtures.js";
import { randomUUID } from "node:crypto";
import { mkdir, symlink, truncate } from "node:fs/promises";
import { parseReplayTrackFile, type ReplayTrack } from "../domain/replay-tracks.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createSync } from "./index.js";
import { createQueries } from "../index.js";
import { database, transaction, migrate } from "../persistence/database.js";
import {
  reserveRequest,
  observeQuota,
  DeferredRequest,
  reserveRiotRequest,
  observeRiotLimits,
} from "./quota.js";
import { riotClient } from "./riot-client.js";
import {
  account,
  currentLadder,
  ladderStatus,
  saveLadder,
  saveAccount,
  recordLadderFailure,
  saveMatchIds,
} from "../persistence/riot.js";
import { gunzipSync } from "node:zlib";
import { saveRiotMatch } from "../persistence/riot-matches.js";
import { pruneBatch } from "../persistence/riot-retention.js";
import { championOverview, championStats, tierList } from "../persistence/aggregates.js";
import { botLaneMatrix, championSynergies } from "../persistence/duos.js";
import { proChampionStats } from "../persistence/pro-stats.js";
import { matchFeatures } from "../persistence/wp-features.js";
import {
  activeWinProbabilityModel,
  trainWinProbabilityModel,
  winProbabilityModels,
} from "../persistence/wp-models.js";
import { soloGame } from "../persistence/solo-games.js";
import { soloGameMapEvents, soloGamePositions } from "../persistence/solo-game-positions.js";
import { matchWpa, scoreMatchWpa } from "../persistence/wpa.js";
import { wpaLeaderboard } from "../persistence/wpa-leaderboards.js";
import { proGameWinProbability, trainCheckpointModel } from "../persistence/pro-wp.js";
import { modelDiagnostics } from "../persistence/model-diagnostics.js";
import { trainOnDemand } from "./train-command.js";
import { firstTrainingDue } from "../persistence/wp-models.js";
import { tierFromDelta } from "../domain/champion-stats.js";
import { mapEventLimit, timelineMinuteLimit } from "../domain/solo-games.js";
import { saveTimeline } from "../persistence/riot-timelines.js";
import { parseRiotTimeline } from "../providers/riot-timeline.js";
import { parseRiotMatch } from "../providers/riot-match.js";
import { draftCsv } from "../../tests/draft-fixtures.js";
import { historyCsv, rawMatch, now } from "../../tests/fixtures.js";
import { archiveFileId } from "../providers/oracle.js";
import {
  listPatches,
  patchFor,
  savePatchCatalog,
  unresolvedPatches,
} from "../persistence/patches.js";
import {
  championCatalog,
  championForOracleName,
  unmappedOracleChampions,
} from "../persistence/catalog.js";
const env = new URL("../../../../.env", import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
const connection = process.env.TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== "/esportsviewer_test")
  throw new Error("Integration tests require TEST_DATABASE_URL targeting esportsviewer_test.");
const pool = database(connection);
const queries = createQueries(connection, () => now);
let instant = new Date(now);
let directory: string;
const fetcher = vi.fn<typeof fetch>();
const endpoint = (input: Parameters<typeof fetch>[0] | undefined) =>
  input instanceof Request ? input.url : (input?.toString() ?? "");
const sync = createSync(connection, {
  clock: () => instant,
  fetch: fetcher,
  pause: () => Promise.resolve(),
  token: "test-only-token",
});
const json = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json", ...headers },
  });
const mapBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNomrgAK2IYWhIAdr5swVmNv80AAAAASUVORK5CYII=",
  "base64",
);
const mapResponse = () => new Response(mapBytes, { headers: { "content-type": "image/png" } });
type DataDragonFile = "champion" | "item" | "runesReforged" | "summoner";
const dataDragonFixtures = Object.fromEntries(
  await Promise.all(
    (["champion", "item", "runesReforged", "summoner"] as const).map(async (name) => [
      name,
      JSON.parse(
        await readFile(new URL(`../../tests/ddragon/${name}.json`, import.meta.url), "utf8"),
      ) as unknown,
    ]),
  ),
) as Record<DataDragonFile, unknown>;
/** Serves Data Dragon from real, trimmed fixtures; a file override replaces one response. */
function serveDataDragon(
  versions: string[],
  overrides: Partial<Record<DataDragonFile | "map" | "icons", unknown>> = {},
) {
  fetcher.mockImplementation((input) => {
    const url = endpoint(input);
    if (url.endsWith("/img/map/map11.png"))
      return Promise.resolve(
        overrides.map instanceof Response ? overrides.map.clone() : mapResponse(),
      );
    if (url.includes("/img/"))
      return Promise.resolve(
        overrides.icons instanceof Response ? overrides.icons.clone() : mapResponse(),
      );
    if (url.endsWith("/api/versions.json")) return Promise.resolve(json(versions));
    const [, version, name] = url.match(/\/cdn\/([^/]+)\/data\/en_US\/(\w+)\.json$/) ?? [];
    const file = name as DataDragonFile;
    const body = file in overrides ? overrides[file] : dataDragonFixtures[file];
    if (body instanceof Response) return Promise.resolve(body);
    const value = JSON.stringify(body).replaceAll('"16.22.1"', JSON.stringify(version));
    return Promise.resolve(json(JSON.parse(value)));
  });
}
async function run(kind: unknown) {
  await sync.request(kind);
  return sync.runNext();
}
async function importCsv(csv = historyCsv(), year = 2026) {
  const file = join(directory, `${year}.csv`);
  await writeFile(file, csv);
  return run({ kind: "history", year, file });
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "summonersnet-test-"));
  await sync.migrate();
});
beforeEach(async () => {
  instant = new Date(now);
  fetcher.mockReset();
  fetcher.mockResolvedValue(json([]));
  await pool.query(
    "TRUNCATE matchup_aggregates,matchup_exclusions,pro_account_links,riot_ladder_snapshots,replay_metadata,replay_tracks,identity_tournament_rosters,identity_match_context,identity_catalog,identity_resolution_runs,image_assets,oracle_archive_participants,oracle_archive_games,participants,broadcasts,roster_observations,roster_snapshots,games,matches,competitions,source_mappings,identities,metadata,oracle_champion_names,catalog_champions,catalog_items,catalog_runes,catalog_summoner_spells,patch_sources,patches,imports,sync_jobs,sync_schedule,request_ledger,riot_request_ledger,riot_rate_limits,riot_rate_pauses,riot_ladder_entries,riot_ladder_status,riot_account_names,riot_accounts,riot_timeline_events,riot_timeline_frames,riot_match_payloads,riot_match_perks,riot_match_items,riot_match_participants,riot_match_bans,riot_match_objectives,riot_match_teams,riot_matches,riot_match_ids,riot_match_crawl,riot_job_status,champion_aggregates,champion_builds,champion_buckets,champion_duos,pro_champion_stats,pro_unmapped_drafts,wpa_aggregates,riot_wpa_participants,riot_wpa_events,riot_wp_features,wp_models,aggregate_dirty,blindability_scores RESTART IDENTITY CASCADE",
  );
  await pool.query(
    "UPDATE source_status SET last_success=NULL,last_attempt=NULL,error=NULL,records=0",
  );
  await pool.query("UPDATE quota_state SET cooldown_until=NULL");
  await pool.query(
    "UPDATE riot_key_status SET configured=false,kind=NULL,fingerprint=NULL,set_at=NULL,state='missing',checked_at=NULL,detail=NULL",
  );
  await pool.query(
    "UPDATE riot_retention SET previous_patches=NULL,kept_patches='{}',last_run_at=NULL,pruned_matches=0,backfilled_matches=0",
  );
});
afterAll(async () => {
  await sync.close();
  await queries.close();
  await pool.end();
  await rm(directory, { recursive: true, force: true });
});
describe("real PostgreSQL persistence through sync and query interfaces", () => {
  it("recovers reads after an idle database connection is terminated", async () => {
    const url = new URL(connection);
    url.searchParams.set("application_name", "summonersnet-recovery-test");
    const recovering = createQueries(url.toString());
    try {
      await recovering.ready();
      const terminated = await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='summonersnet-recovery-test'",
      );
      expect(terminated.rowCount).toBe(1);
      await vi.waitFor(async () => {
        await expect(recovering.ready()).resolves.toBeUndefined();
      });
    } finally {
      await recovering.close();
    }
  });
  it("prefers recent play and upcoming teams, while old imports stay searchable on bounded pages", async () => {
    await importCsv(
      historyCsv().replaceAll("Acceptance", "Zebra").replaceAll("Player", "Zebra Player"),
    );
    await importCsv(
      historyCsv({ id: "archive", year: 2014 })
        .replaceAll("Acceptance", "Archive")
        .replaceAll("Player", "Archived Player")
        .replaceAll(",10", ",old-10")
        .replaceAll(",11", ",old-11"),
      2014,
    );
    expect((await queries.directory("team", { pageSize: 2 })).items.map((i) => i.name)).toEqual([
      "Zebra Blue",
      "Zebra Red",
    ]);
    const older = await queries.directory("team", { pageSize: 2, page: 2 });
    expect(older.total).toBe(4);
    expect(older.items.map((i) => i.name)).toEqual(["Archive Blue", "Archive Red"]);
    expect((await queries.directory("team", { pageSize: 2, page: 3 })).items).toEqual([]);
    expect(
      (await queries.directory("player", { pageSize: 10 })).items.every((i) =>
        i.name.startsWith("Zebra"),
      ),
    ).toBe(true);
    expect((await queries.directory("player", { q: "Archived" })).total).toBe(10);
    expect((await queries.search({ q: "Archive" })).total).toBeGreaterThan(0);

    fetcher.mockResolvedValue(
      json([
        rawMatch(90, {
          begin_at: "2026-04-01T00:00:00Z",
          status: "not_started",
          opponents: [{ opponent: { id: 90, name: "Upcoming Team" } }],
        }),
      ]),
    );
    await run({ kind: "running" });
    fetcher.mockResolvedValue(
      json([
        {
          id: 90,
          name: "Upcoming Team",
          players: [{ id: 90, name: "Zzz Current Player", role: "mid" }],
        },
      ]),
    );
    await run({ kind: "rosters" });
    expect((await queries.directory("team", { pageSize: 3 })).items.map((i) => i.name)).toEqual([
      "Upcoming Team",
      "Zebra Blue",
      "Zebra Red",
    ]);
    expect((await queries.directory("player", { pageSize: 11 })).items[10]?.name).toBe(
      "Zzz Current Player",
    );

    const later = createQueries(connection, () => new Date("2026-04-02T12:00:00Z"));
    try {
      // A saved roster ages out even though the team's fixture is still recent.
      expect((await later.directory("player", { pageSize: 11 })).items[10]?.name).toMatch(
        /^Archived/,
      );
    } finally {
      await later.close();
    }
    const expired = createQueries(connection, () => new Date("2027-03-01T12:00:00Z"));
    try {
      expect((await expired.directory("team", { pageSize: 1 })).items[0]?.name).toBe(
        "Archive Blue",
      );
    } finally {
      await expired.close();
    }
  });
  it("opens with live matches, nearest scheduled matches, then recent results", async () => {
    fetcher.mockResolvedValue(
      json([
        rawMatch(1, {
          status: "not_started",
          begin_at: "2026-04-01T12:00:00Z",
          league: { id: 2, name: "LTA North" },
        }),
        rawMatch(2, { status: "finished", begin_at: "2026-02-28T12:00:00Z" }),
        rawMatch(3, { status: "not_started", begin_at: "2026-03-02T12:00:00Z" }),
        rawMatch(4, { status: "running", begin_at: "2026-03-01T11:00:00Z" }),
      ]),
    );
    expect((await run({ kind: "running" })).state).toBe("done");
    expect((await queries.matches()).items.map((m) => m.sourceId)).toEqual(["4", "3", "1", "2"]);
    expect((await queries.matches({ state: "scheduled" })).items.map((m) => m.sourceId)).toEqual([
      "3",
      "1",
    ]);
    expect((await queries.matches({ league: "LCS" })).items.map((m) => m.sourceId)).toEqual(["1"]);
    expect((await queries.matches({ league: "LCK" })).items.map((m) => m.sourceId)).toEqual([
      "4",
      "3",
      "2",
    ]);
  });
  it("migrates concurrently, rejects altered migration evidence and rolls back transactions", async () => {
    await Promise.all([sync.migrate(), migrate(pool)]);
    await expect(queries.ready()).resolves.toBeUndefined();
    await expect(
      transaction(pool, async (c) => {
        await c.query("INSERT INTO metadata VALUES('test','item','{}')");
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await queries.metadata()).toEqual([]);
    const old = await pool.query<{ hash: string }>(
      "UPDATE schema_migrations SET hash='altered' WHERE name='0002_search.sql' RETURNING hash",
    );
    expect(old.rowCount).toBe(1);
    await expect(sync.migrate()).rejects.toThrow("Applied migration changed");
    await pool.query("DELETE FROM schema_migrations WHERE name='0002_search.sql'");
    // Restore ledger without rerunning already-created indexes.
    const { readFile } = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    const sql = await readFile(
      new URL("../../migrations/0002_search.sql", import.meta.url),
      "utf8",
    );
    await pool.query("INSERT INTO schema_migrations(name,hash) VALUES('0002_search.sql',$1)", [
      createHash("sha256").update(sql).digest("hex"),
    ]);
  });
  it("imports idempotently, applies corrections atomically and retains data after malformed files", async () => {
    expect((await importCsv()).state).toBe("done");
    await pool.query(
      "UPDATE imports SET official_file_id=NULL,original_filename=NULL,byte_length=NULL,acquisition_method=NULL WHERE source='oracle' AND year=2026",
    );
    expect((await importCsv()).state).toBe("done");
    const provenance = await pool.query<{
      official_file_id: string;
      original_filename: string;
      byte_length: string;
      acquisition_method: string;
    }>(
      "SELECT official_file_id,original_filename,byte_length,acquisition_method FROM imports WHERE source='oracle' AND year=2026",
    );
    expect(provenance.rows[0]).toMatchObject({
      official_file_id: archiveFileId(2026),
      original_filename: "2026.csv",
      acquisition_method: "manual",
    });
    expect(Number(provenance.rows[0]?.byte_length)).toBeGreaterThan(0);
    expect((await queries.games()).total).toBe(1);
    const original = await queries.game("oracle:game:acceptance-game");
    expect(original?.participants).toHaveLength(12);
    expect((await importCsv(historyCsv({ kills: "9" }))).state).toBe("done");
    expect((await queries.game("oracle:game:acceptance-game"))?.participants[0]?.kills).toBe(9);
    const good = (await queries.status()).sources.find((s) => s.source === "oracle")!.lastSuccess;
    instant = new Date(now.valueOf() + 60000);
    expect((await importCsv("<html>quota exceeded")).state).toBe("failed");
    expect((await queries.game("oracle:game:acceptance-game"))?.participants[0]?.kills).toBe(9);
    expect((await queries.status()).sources.find((s) => s.source === "oracle")?.lastSuccess).toBe(
      good,
    );
    expect((await queries.status()).sources.find((s) => s.source === "oracle")?.error).toBeTypeOf(
      "string",
    );
    expect((await importCsv(historyCsv({ id: "partial", completeness: "partial" }))).state).toBe(
      "done",
    );
    expect((await queries.status()).history).toEqual([
      {
        year: 2026,
        games: 2,
        eligible: 1,
        latestGameAt: "2026-03-01T01:00:00.000Z",
      },
    ]);
  });
  it("archives every league, projects only curated coverage, and exposes provider-neutral history queries", async () => {
    const curated = historyCsv();
    const academy = historyCsv({ league: "LCKC" }).split("\n").slice(1).join("\n");
    expect((await importCsv(curated + academy)).state).toBe("done");
    expect((await queries.games()).total).toBe(1);
    const archive = await queries.historicalGames({ year: 2026, pageSize: 1 });
    expect(archive.total).toBe(2);
    expect(archive.items).toHaveLength(1);
    const crossLeague = await queries.historicalGames({ sourceLeague: "LCKC" });
    expect(crossLeague.items[0]?.sourceGameId).toBe("acceptance-game");
    expect((await queries.historicalGames({ sourceLeague: "LCKC" })).items[0]).toMatchObject({
      sourceLeague: "LCKC",
      competition: null,
    });
    const curatedArchive = (await queries.historicalGames({ competition: "LCK" })).items[0]!;
    expect(crossLeague.items[0]?.id).not.toBe(curatedArchive.id);
    const detail = await queries.historicalGame(curatedArchive.id);
    expect(detail?.participants).toHaveLength(12);
    expect(JSON.stringify(detail)).not.toContain("sourceRow");
    expect(
      (
        await queries.historicalSummary(
          { kind: "player", value: "Player Blue mid" },
          { sourceLeague: "LCK" },
        )
      ).games,
    ).toBe(1);
    const coverage = await queries.historicalCoverage();
    expect(coverage).toHaveLength(13);
    expect(coverage.find((entry) => entry.year === 2026)).toMatchObject({
      status: "complete",
      sourceRows: 24,
      games: 2,
      eligibleGames: 2,
      retainedFile: true,
    });
    expect(coverage.find((entry) => entry.year === 2014)).toMatchObject({
      status: "incomplete",
      artifactHash: null,
    });
  });
  it("bounds and filters SQL pages, timezone days, search and full-sample profile aggregates", async () => {
    await importCsv();
    await importCsv(historyCsv({ id: "other", kills: "7" }));
    await importCsv(historyCsv({ id: "older", year: 2024, league: "LEC" }), 2024);
    const page = await queries.games({ pageSize: 1, year: 2026 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect((await queries.games({ page: 3, pageSize: 1, year: 2026 })).total).toBe(2);
    expect((await queries.games({ year: 2026, league: "LPL" })).items).toEqual([]);
    expect((await queries.games({ date: "2026-02-28", timezone: "America/Phoenix" })).total).toBe(
      2,
    );
    expect((await queries.games({ date: "2026-03-01", timezone: "America/Phoenix" })).total).toBe(
      0,
    );
    expect((await queries.games({ q: "Player Blue mid" })).total).toBe(3);
    expect((await queries.games({ q: "%" })).total).toBe(0);
    const player = await queries.profile("oracle:player:10-mid", {
      year: 2026,
      pageSize: 1,
    });
    expect(player?.games.items).toHaveLength(1);
    expect(player?.summary).toMatchObject({
      eligibleGames: 2,
      resultGames: 2,
      wins: 2,
      winRate: 1,
      kda: 6.5,
      kdaGames: 2,
      champions: [{ name: "Ahri", games: 2 }],
    });
    expect((await queries.profile("oracle:team:10", { year: 2026 }))?.summary.eligibleGames).toBe(
      2,
    );
    expect(await queries.profile("missing")).toBeNull();
    expect(await queries.game("missing")).toBeNull();
    expect(await queries.match("missing")).toBeNull();
    expect((await queries.directory("player", { q: "mid" })).total).toBe(2);
    expect((await queries.search({ q: "Acceptance" })).total).toBe(3);
    expect((await queries.search({ q: "Player Blue" })).total).toBe(5);
    expect((await queries.search({ q: "%" })).total).toBe(0);
    expect((await queries.search()).total).toBe(0);
  });
  it("filters games and matches by their visible values through trigram indexes", async () => {
    fetcher.mockImplementation(() => Promise.resolve(json([rawMatch()])));
    const matchesRun = await run({ kind: "matches" });
    expect(matchesRun.state, matchesRun.error ?? "").toBe("done");
    await importCsv();
    await importCsv(historyCsv({ id: "older", year: 2024, league: "LEC" }), 2024);
    // Any value search finds exactly the rows the former whole-document search found.
    const legacy = async (table: "games" | "matches", q: string) =>
      (
        await pool.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM ${table} WHERE lower(document::text) LIKE $1`,
          [`%${q.toLowerCase()}%`],
        )
      ).rows[0]!.count;
    for (const q of ["Player Blue mid", "acceptance red", "LEC", "Ahri", "2024-", "Spring"]) {
      const games = (await queries.games({ q })).total;
      expect(games, q).toBe(await legacy("games", q));
      expect((await queries.matches({ q })).total, q).toBe(await legacy("matches", q));
      expect((await queries.profile("oracle:player:10-mid", { q }))?.games.total, q).toBe(games);
    }
    expect((await queries.games({ q: "Ahri" })).total).toBe(2);
    expect((await queries.matches({ q: "acceptance red" })).total).toBe(1);
    // JSON keys are not content: they no longer match every row.
    expect(await legacy("games", "participants")).toBe(2);
    expect((await queries.games({ q: "participants" })).total).toBe(0);
    expect((await queries.matches({ q: "broadcasts" })).total).toBe(0);
    await transaction(pool, async (client) => {
      await client.query("SET LOCAL enable_seqscan=off");
      for (const table of ["games", "matches"]) {
        const plan = await client.query<{ "QUERY PLAN": string }>(
          `EXPLAIN SELECT id FROM ${table} WHERE search_text LIKE '%acceptance%'`,
        );
        expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain(
          `${table}_search_text`,
        );
      }
    });
  });
  it("publishes source-neutral, stable profile slugs and resolves legacy source IDs", async () => {
    await importCsv();
    const team = (await queries.directory("team", { q: "Acceptance Blue" })).items[0]!;
    const player = (await queries.directory("player", { q: "Player Blue mid" })).items[0]!;
    expect(team.publicSlug).toBe("acceptance-blue");
    expect(player.publicSlug).toBe("player-blue-mid");
    expect((await queries.search({ q: "Acceptance Blue" })).items[0]).toMatchObject({
      publicSlug: "acceptance-blue",
    });
    expect((await queries.profile(team.publicSlug!, {}, "team"))?.identity.id).toBe(team.id);
    expect((await queries.profile(team.id))?.identity.publicSlug).toBe(team.publicSlug);
    expect((await queries.profile(player.publicSlug!, {}, "player"))?.identity.id).toBe(player.id);
    expect(await queries.profile(team.publicSlug!, {}, "player")).toBeNull();
    expect((await queries.games({ pageSize: 1 })).items[0]?.participants[0]?.team.publicSlug).toBe(
      "acceptance-blue",
    );
  });
  it("adds a short stable suffix only when two identities share a public name", async () => {
    for (const sourceId of ["twin-1", "twin-2"]) {
      const id = `oracle:team:${sourceId}`;
      await pool.query(
        "INSERT INTO identities(id,kind,name,source,source_id,document) VALUES($1,'team','Twin Club','oracle',$2,$3)",
        [
          id,
          sourceId,
          {
            id,
            source: "oracle",
            sourceId,
            kind: "team",
            name: "Twin Club",
            imageUrl: null,
            country: null,
            role: null,
          },
        ],
      );
    }
    const suffix = createHash("md5").update("oracle:team:twin-2").digest("hex").slice(0, 12);
    expect((await queries.profile("twin-club", {}, "team"))?.identity.id).toBe(
      "oracle:team:twin-1",
    );
    expect((await queries.profile(`twin-club-${suffix}`, {}, "team"))?.identity.id).toBe(
      "oracle:team:twin-2",
    );
    await pool.query("UPDATE identities SET name='Renamed Club' WHERE id='oracle:team:twin-1'");
    expect((await queries.profile("twin-club", {}, "team"))?.identity.publicSlug).toBe("twin-club");
  });
  it("keeps source identities distinct, replaces observed rosters, and commits all match pages together", async () => {
    fetcher.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : endpoint(input);
      if (url.includes("/teams"))
        return Promise.resolve(
          json([
            {
              id: 10,
              name: "Acceptance Blue",
              players: [{ id: 30, name: "Player Blue mid", role: "mid" }],
            },
          ]),
        );
      return Promise.resolve(json([rawMatch()]));
    });
    expect((await run({ kind: "matches" })).state).toBe("done");
    expect((await run({ kind: "rosters" })).state).toBe("done");
    await importCsv();
    expect((await queries.search({ q: "Player Blue mid" })).total).toBe(2);
    expect((await queries.profile("pandascore:team:10"))?.roster).toMatchObject([
      { player: { id: "pandascore:player:30" } },
    ]);
    expect((await queries.profile("pandascore:player:30"))?.roster).toHaveLength(1);
    expect((await queries.matches({ state: "final", year: 2026, q: "Blue" })).total).toBe(1);
    expect((await queries.matches({ state: "scheduled" })).total).toBe(0);
    expect((await queries.match("pandascore:match:1"))?.broadcasts).toHaveLength(2);
    instant = new Date(now.valueOf() + 1000);
    fetcher.mockResolvedValue(json([{ id: 10, name: "Acceptance Blue", players: [] }]));
    await run({ kind: "rosters" });
    expect((await queries.profile("pandascore:team:10"))?.roster).toEqual([]);
    fetcher
      .mockResolvedValueOnce(json([rawMatch(2)], { link: '<https://evil.test>; rel="next"' }))
      .mockResolvedValueOnce(json({ error: "schema" }));
    expect((await run({ kind: "running" })).state).toBe("failed");
    expect(await queries.match("pandascore:match:2")).toBeNull();
  });
  it("persists versioned metadata and preserves the last version on partial failure", async () => {
    serveDataDragon(["16.4.1", "lolpatch_7.20"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    expect(await queries.metadata("16.4.1")).toHaveLength(2);
    expect(await queries.metadata()).toHaveLength(2);
    serveDataDragon(["16.5.1"], { item: new Response("unavailable", { status: 503 }) });
    expect((await run({ kind: "metadata" })).state).toBe("queued");
    expect(await queries.metadata("16.5.1")).toEqual([]);
    expect(await queries.metadata()).toHaveLength(2);
  });
  it("builds the patch catalog, links Oracle patches and keeps it when Data Dragon fails", async () => {
    serveDataDragon(["16.4.1", "16.3.1", "16.3.2", "15.21.1", "lolpatch_7.20"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    let catalog = await listPatches(pool);
    expect(catalog.map((p) => [p.key, p.releaseOrder])).toEqual([
      ["16.4", 3],
      ["16.3", 2],
      ["15.21", 1],
    ]);
    expect(catalog[1]).toMatchObject({
      ddragonVersions: ["16.3.1", "16.3.2"],
      observedAt: now.toISOString(),
    });
    await importCsv();
    await importCsv(historyCsv({ id: "unknown-patch" }).replaceAll(",16.4,", ",16.99,"));
    await importCsv(historyCsv({ id: "label-patch" }).replaceAll(",16.4,", ",25.S1.1,"));
    expect(await patchFor(pool, "oracle", "16.4")).toBe("16.4");
    expect(await patchFor(pool, "ddragon", "16.3.2")).toBe("16.3");
    expect(await patchFor(pool, "oracle", "16.99")).toBeNull();
    expect(await patchFor(pool, "riot", "16.4")).toBeNull();
    expect(await unresolvedPatches(pool)).toEqual([
      { source: "ddragon", value: "lolpatch_7.20", reason: "unparseable" },
      { source: "oracle", value: "16.99", reason: "unknown" },
      { source: "oracle", value: "25.S1.1", reason: "unparseable" },
    ]);
    // Source strings stay as received on the game record.
    const stored = await pool.query<{ patch: string }>(
      "SELECT patch FROM oracle_archive_games ORDER BY patch",
    );
    expect(stored.rows.map((r) => r.patch)).toEqual(["16.4", "16.99", "25.S1.1"]);

    // A later catalog that adds a patch links the waiting Oracle string; absent patches are kept.
    instant = new Date(now.valueOf() + 86400000);
    serveDataDragon(["16.99.1", "16.4.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    expect(await patchFor(pool, "oracle", "16.99")).toBe("16.99");
    catalog = await listPatches(pool);
    expect(catalog.map((p) => p.key)).toEqual(["16.99", "16.4", "16.3", "15.21"]);
    expect(catalog.find((p) => p.key === "16.4")?.sourceStrings).toEqual([
      { source: "ddragon", value: "16.4.1" },
      { source: "oracle", value: "16.4" },
    ]);

    // A failed versions fetch leaves the catalog and its timestamps untouched.
    const success = (await queries.status()).sources.find(
      (s) => s.source === "ddragon",
    )?.lastSuccess;
    instant = new Date(now.valueOf() + 2 * 86400000);
    fetcher.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    expect((await run({ kind: "metadata" })).state).toBe("queued");
    expect(await listPatches(pool)).toEqual(catalog);
    expect((await queries.status()).sources.find((s) => s.source === "ddragon")?.lastSuccess).toBe(
      success,
    );
  });
});
it("stores the champion, item, rune and spell catalog per patch and maps Oracle champion names", async () => {
  serveDataDragon(["16.22.1", "16.21.1"]);
  expect((await run({ kind: "metadata" })).state).toBe("done");
  expect(await championCatalog(pool, "16.22")).toEqual([
    expect.objectContaining({ id: "Ahri", key: 103, name: "Ahri", image: "Ahri.png" }),
    expect.objectContaining({ id: "Nunu", key: 20, name: "Nunu & Willump", version: "16.22.1" }),
    expect.objectContaining({ id: "MonkeyKing", key: 62, name: "Wukong" }),
  ]);
  const count = async (table: string) =>
    (
      await pool.query<{ n: number }>(
        `SELECT count(*)::integer n FROM ${table} WHERE patch_key='16.22'`,
      )
    ).rows[0]!.n;
  expect(await count("catalog_items")).toBe(10);
  expect(
    (
      await pool.query(
        "SELECT tags,builds_from,builds_into,total_gold FROM catalog_items WHERE patch_key='16.22' AND item_id=3006",
      )
    ).rows[0],
  ).toEqual({
    tags: ["AttackSpeed", "Boots"],
    builds_from: [1001, 1042, 1042],
    builds_into: [3172],
    total_gold: 1100,
  });
  expect(await count("catalog_summoner_spells")).toBe(2);
  expect(
    (
      await pool.query(
        "SELECT rune_id,rune_key,tree_id,slot FROM catalog_runes WHERE patch_key='16.22' ORDER BY tree_id NULLS FIRST,slot,rune_id",
      )
    ).rows,
  ).toEqual([
    { rune_id: 8100, rune_key: "Domination", tree_id: null, slot: null },
    { rune_id: 8112, rune_key: "Electrocute", tree_id: 8100, slot: 0 },
    { rune_id: 8128, rune_key: "DarkHarvest", tree_id: 8100, slot: 0 },
    { rune_id: 8126, rune_key: "CheapShot", tree_id: 8100, slot: 1 },
    { rune_id: 8139, rune_key: "TasteOfBlood", tree_id: 8100, slot: 1 },
  ]);
  expect(
    (
      await pool.query(
        "SELECT spell_id,spell_key,name FROM catalog_summoner_spells ORDER BY spell_key",
      )
    ).rows,
  ).toEqual([
    { spell_id: "SummonerFlash", spell_key: 4, name: "Flash" },
    { spell_id: "SummonerDot", spell_key: 14, name: "Ignite" },
  ]);

  expect(await championForOracleName(pool, "Wukong")).toBe("MonkeyKing");
  expect(await championForOracleName(pool, "Nunu & Willump")).toBe("Nunu");
  expect(await championForOracleName(pool, "wukong")).toBeNull();
  await importCsv();
  await importCsv(historyCsv({ id: "unmapped" }).replaceAll(",Ahri,", ",Not A Champion,"));
  expect(await unmappedOracleChampions(pool)).toEqual([{ name: "Not A Champion", rows: 10 }]);

  // A failed file leaves the whole catalog, the mapping and their timestamps untouched.
  const before = await championCatalog(pool, "16.22");
  instant = new Date(now.valueOf() + 86400000);
  serveDataDragon(["16.23.1"], { runesReforged: new Response("unavailable", { status: 503 }) });
  expect((await run({ kind: "metadata" })).state).toBe("queued");
  expect(await championCatalog(pool, "16.23")).toEqual([]);
  expect(await championCatalog(pool, "16.22")).toEqual(before);
  instant = new Date(instant.valueOf() + 3600000);
  serveDataDragon(["16.23.1"], { summoner: { data: { SummonerFlash: { id: "SummonerFlash" } } } });
  expect((await run({ kind: "metadata" })).state).toBe("failed");
  expect(await championCatalog(pool, "16.23")).toEqual([]);

  // Two champions claiming one display name invalidate the mapping as a whole.
  instant = new Date(instant.valueOf() + 3600000);
  serveDataDragon(["16.23.1"], {
    champion: {
      data: {
        Ahri: { id: "Ahri", key: "103", name: "Ahri", image: { full: "Ahri.png" } },
        Wukong: { id: "Wukong", key: "999", name: "Wukong", image: { full: "Wukong.png" } },
      },
    },
  });
  const failed = await run({ kind: "metadata" });
  expect(failed.state).toBe("failed");
  expect("error" in failed ? failed.error : "").toContain("Wukong");
  expect(await championCatalog(pool, "16.23")).toEqual([]);
  expect(await championForOracleName(pool, "Wukong")).toBe("MonkeyKing");
});
describe("Riot request ledger", () => {
  const at = (ms: number) => new Date(now.valueOf() + ms);
  const ledger = async () =>
    (
      await pool.query<{ region: string; method: string; n: number }>(
        "SELECT region,method,count(*)::integer n FROM riot_request_ledger GROUP BY 1,2 ORDER BY 1,2",
      )
    ).rows;
  const limits = (app: string | null, method: string | null, extra: Record<string, string> = {}) =>
    new Headers({
      ...(app ? { "X-App-Rate-Limit": app } : {}),
      ...(method ? { "X-Method-Rate-Limit": method } : {}),
      ...extra,
    });
  it("reserves within the development defaults until Riot reports limits, recording nothing when blocked", async () => {
    for (let i = 0; i < 20; i++)
      expect(await reserveRiotRequest(pool, "euw1", "league-v4", now)).toBeNull();
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", now)).toEqual(at(1000));
    expect(await reserveRiotRequest(pool, "na1", "league-v4", now)).toBeNull();
    expect(await ledger()).toEqual([
      { region: "euw1", method: "league-v4", n: 20 },
      { region: "na1", method: "league-v4", n: 1 },
    ]);
    // The two-minute window still allows 80 more once the one-second window has passed.
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", at(1000))).toBeNull();
  });
  it("honours application and method limits from response headers per window", async () => {
    await observeRiotLimits(pool, "euw1", "match-v5", limits("2:1,3:10", "1:10"), 200, now);
    expect(await reserveRiotRequest(pool, "euw1", "match-v5", now)).toBeNull();
    // The method allows one per ten seconds; the application still has room for another.
    expect(await reserveRiotRequest(pool, "euw1", "match-v5", now)).toEqual(at(10000));
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", now)).toBeNull();
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", now)).toEqual(at(1000));
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", at(1000))).toBeNull();
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", at(2000))).toEqual(at(10000));
    // Later headers replace the reported limits; a malformed header keeps the last ones.
    await observeRiotLimits(pool, "euw1", "match-v5", limits("50:10", "garbage"), 200, at(2000));
    expect(
      (
        await pool.query(
          "SELECT method,window_seconds,limit_count FROM riot_rate_limits ORDER BY method,window_seconds",
        )
      ).rows,
    ).toEqual([
      { method: "", window_seconds: 10, limit_count: 50 },
      { method: "match-v5", window_seconds: 10, limit_count: 1 },
    ]);
    expect(await reserveRiotRequest(pool, "euw1", "league-v4", at(2000))).toBeNull();
  });
  it("pauses the method, or the whole region, for Retry-After on a 429", async () => {
    expect(
      await observeRiotLimits(
        pool,
        "kr",
        "match-v5",
        limits(null, null, { "Retry-After": "5", "X-Rate-Limit-Type": "method" }),
        429,
        now,
      ),
    ).toEqual(at(5000));
    expect(await reserveRiotRequest(pool, "kr", "match-v5", now)).toEqual(at(5000));
    expect(await reserveRiotRequest(pool, "kr", "league-v4", now)).toBeNull();
    expect(await reserveRiotRequest(pool, "kr", "match-v5", at(5000))).toBeNull();
    await observeRiotLimits(
      pool,
      "kr",
      "league-v4",
      limits(null, null, { "Retry-After": "30", "X-Rate-Limit-Type": "application" }),
      429,
      at(5000),
    );
    expect(await reserveRiotRequest(pool, "kr", "match-v5", at(6000))).toEqual(at(35000));
    // A 429 without Retry-After backs off for ten seconds.
    expect(await observeRiotLimits(pool, "jp1", "x", new Headers(), 429, now)).toEqual(at(10000));
  });
  it("lets only one of many concurrent reservations take the last slot", async () => {
    await observeRiotLimits(pool, "br1", "league-v4", limits("1:10", null), 200, now);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserveRiotRequest(pool, "br1", "league-v4", now)),
    );
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(await ledger()).toEqual([{ region: "br1", method: "league-v4", n: 1 }]);
  });
  it("sends through the client only after reserving, retrying a 429 and rescheduling long waits", async () => {
    const waits: number[] = [];
    const get = riotClient(pool, {
      key: "RGAPI-01234567-89ab-cdef-0123-456789abcdef",
      clock: () => instant,
      fetch: fetcher,
      pause: (ms) => {
        waits.push(ms);
        instant = new Date(instant.valueOf() + ms);
        return Promise.resolve();
      },
    });
    fetcher
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "Retry-After": "2", "X-Rate-Limit-Type": "method" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("{}", { status: 200, headers: { "X-App-Rate-Limit": "1:120" } }),
      );
    expect((await get("euw1", "league-v4", "/lol/league/v4/challengerleagues")).status).toBe(200);
    expect(waits).toEqual([2000]);
    expect(endpoint(fetcher.mock.calls[0]![0])).toBe(
      "https://euw1.api.riotgames.com/lol/league/v4/challengerleagues",
    );
    expect(await ledger()).toEqual([{ region: "euw1", method: "league-v4", n: 2 }]);
    // The application now allows one request per two minutes: too long to wait in the worker.
    await expect(get("euw1", "league-v4", "/lol/league/v4/challengerleagues")).rejects.toEqual(
      new DeferredRequest(new Date(instant.valueOf() + 120000)),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(get("xx1" as "na1", "league-v4", "/")).rejects.toThrow();
    // Each retried attempt reserves again; the last 429 is returned to the caller.
    fetcher.mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "1" } }));
    expect((await get("kr", "league-v4", "/lol/x")).status).toBe(429);
    expect((await ledger()).find((r) => r.region === "kr")?.n).toBe(3);
  });
});
describe("Riot apex ladders", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const ladder = JSON.parse(
    readFileSync(new URL("../../tests/riot/challenger-euw1.json", import.meta.url), "utf8"),
  ) as { tier: string; entries: { puuid: string; leaguePoints: number }[] };
  const league = (tier: string, entries: unknown[] = []) => json({ ...ladder, tier, entries });
  /** Serves each platform's tiers; `fail` maps "platform/tier path" to a failing response. */
  function serveLadders(fail: Record<string, () => Response> = {}) {
    fetcher.mockImplementation((input) => {
      const url = new URL(endpoint(input));
      const platform = url.hostname.split(".")[0]!;
      const path = url.pathname.split("/")[4]!;
      const failure = fail[`${platform}/${path}`];
      if (failure) return Promise.resolve(failure());
      if (path === "challengerleagues")
        return Promise.resolve(league("CHALLENGER", ladder.entries));
      if (path === "grandmasterleagues") return Promise.resolve(league("GRANDMASTER"));
      if (path === "masterleagues") return Promise.resolve(league("MASTER"));
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  }
  it("syncs every selected platform, keeping a failed platform's last ladder while others continue", async () => {
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
      riotPlatforms: ["euw1", "kr"],
    });
    try {
      serveLadders({ "kr/grandmasterleagues": () => new Response("", { status: 503 }) });
      await worker.request({ kind: "riot-ladder" });
      const first = await worker.runNext();
      expect(first).toMatchObject({ state: "queued" });
      expect("error" in first ? first.error : "").toContain("kr");
      expect((await currentLadder(pool, "euw1")).map((e) => [e.tier, e.leaguePoints])).toEqual([
        ["CHALLENGER", 1824],
        ["CHALLENGER", 1503],
      ]);
      expect(await currentLadder(pool, "kr")).toEqual([]);
      expect(await ladderStatus(pool)).toEqual([
        {
          platform: "euw1",
          lastSuccess: now.toISOString(),
          lastAttempt: now.toISOString(),
          entries: 2,
          error: null,
        },
        {
          platform: "kr",
          lastSuccess: null,
          lastAttempt: now.toISOString(),
          entries: 0,
          error: "Riot returned HTTP 503. The last ladder is kept.",
        },
      ]);
      // Every tier request reserved from the ledger, including the failed one.
      expect(
        (
          await pool.query<{ region: string; n: number }>(
            "SELECT region,count(*)::integer n FROM riot_request_ledger WHERE method LIKE 'league-v4.%' GROUP BY region ORDER BY region",
          )
        ).rows,
      ).toEqual([
        { region: "euw1", n: 3 },
        { region: "kr", n: 2 },
      ]);

      // Later, euw1 returns a malformed ladder and keeps its last one; kr succeeds.
      instant = new Date(now.valueOf() + 3600000);
      serveLadders({ "euw1/masterleagues": () => json({ tier: "MASTER", entries: "nope" }) });
      expect((await worker.runNext()).state).toBe("queued");
      expect(await currentLadder(pool, "kr")).toHaveLength(2);
      const euw = await currentLadder(pool, "euw1");
      expect(euw.every((e) => e.fetchedAt === now.toISOString())).toBe(true);
      expect((await ladderStatus(pool))[0]).toMatchObject({
        lastSuccess: now.toISOString(),
        lastAttempt: instant.toISOString(),
        error: "Riot returned an unexpected ladder. The last ladder is kept.",
      });

      // A player who left the apex tiers keeps their row but drops out of the current ladder.
      instant = new Date(now.valueOf() + 3 * 3600000);
      fetcher.mockImplementation((input) => {
        const path = new URL(endpoint(input)).pathname.split("/")[4]!;
        if (path === "challengerleagues")
          return Promise.resolve(league("CHALLENGER", ladder.entries.slice(0, 1)));
        return Promise.resolve(league(path === "grandmasterleagues" ? "GRANDMASTER" : "MASTER"));
      });
      expect((await worker.runNext()).state).toBe("done");
      expect(await currentLadder(pool, "euw1")).toHaveLength(1);
      expect(
        (
          await pool.query(
            "SELECT count(*)::integer n FROM riot_ladder_entries WHERE platform='euw1'",
          )
        ).rows[0],
      ).toEqual({ n: 2 });
    } finally {
      await worker.close();
    }
  });
  it("skips ladders without a key", async () => {
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      riotPlatforms: ["euw1"],
    });
    try {
      await worker.request({ kind: "riot-ladder" });
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 0 });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await worker.close();
    }
  });
});
describe("Riot accounts", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const puuids = ["a".repeat(78), "b".repeat(78), "c".repeat(78)];
  const entry = (puuid: string) => ({
    puuid,
    summonerId: null,
    tier: "MASTER" as const,
    rank: "I",
    leaguePoints: 10,
    wins: 1,
    losses: 1,
    leagueId: "league",
  });
  /** Answers account lookups from a name table; `fail` lists PUUIDs that get an HTTP 500. */
  function serveAccounts(names: Record<string, string>, fail: string[] = []) {
    fetcher.mockImplementation((input) => {
      const url = new URL(endpoint(input));
      const puuid = decodeURIComponent(url.pathname.split("/").pop()!);
      if (fail.includes(puuid)) return Promise.resolve(new Response("", { status: 500 }));
      return Promise.resolve(json({ puuid, gameName: names[puuid], tagLine: "EUW" }));
    });
  }
  it("resolves missing and stale ladder accounts by PUUID and keeps Riot ID history", async () => {
    await saveLadder(pool, "euw1", [entry(puuids[0]!), entry(puuids[1]!)], now);
    await saveLadder(pool, "kr", [entry(puuids[2]!)], now);
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
    });
    try {
      serveAccounts({ [puuids[0]!]: "First", [puuids[1]!]: "Second", [puuids[2]!]: "Third" });
      await worker.request({ kind: "riot-accounts" });
      // The first run also checks the newly observed key; account lookups are a separate job.
      while ((await worker.runNext()).state !== "idle");
      const lookups = fetcher.mock.calls
        .map(([input]) => new URL(endpoint(input)))
        .filter((u) => u.pathname.startsWith("/riot/account"));
      expect(lookups.map((u) => u.hostname.split(".")[0])).toEqual(["europe", "europe", "asia"]);
      expect(await account(pool, puuids[0]!)).toEqual({
        puuid: puuids[0],
        gameName: "First",
        tagLine: "EUW",
        firstSeenAt: now.toISOString(),
        seenAt: now.toISOString(),
        checkedAt: now.toISOString(),
        names: [
          {
            gameName: "First",
            tagLine: "EUW",
            firstSeenAt: now.toISOString(),
            lastSeenAt: now.toISOString(),
          },
        ],
      });
      expect(
        (
          await pool.query<{ n: number }>(
            "SELECT count(*)::integer n FROM riot_request_ledger WHERE method='account-v1.getByPuuid'",
          )
        ).rows[0]!.n,
      ).toBe(3);

      // Fresh accounts are not requested again.
      fetcher.mockClear();
      await worker.request({ kind: "riot-accounts" });
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 0 });
      expect(fetcher).not.toHaveBeenCalled();

      // A week later: one renamed account, and one failed lookup that leaves its account untouched.
      instant = new Date(now.valueOf() + 8 * 86400000);
      serveAccounts({ [puuids[0]!]: "Renamed", [puuids[2]!]: "Third" }, [puuids[1]!]);
      await worker.request({ kind: "riot-accounts" });
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 2 });
      const renamed = await account(pool, puuids[0]!);
      expect(renamed).toMatchObject({
        gameName: "Renamed",
        firstSeenAt: now.toISOString(),
        seenAt: instant.toISOString(),
      });
      expect(renamed?.names.map((n) => n.gameName)).toEqual(["First", "Renamed"]);
      expect(await account(pool, puuids[1]!)).toMatchObject({
        gameName: "Second",
        seenAt: now.toISOString(),
        checkedAt: now.toISOString(),
      });

      // When every lookup fails, the job is retried and nothing changes.
      instant = new Date(instant.valueOf() + 3600000);
      serveAccounts({}, [puuids[1]!]);
      await worker.request({ kind: "riot-accounts" });
      expect((await worker.runNext()).state).toBe("queued");
      expect(await account(pool, puuids[1]!)).toMatchObject({ checkedAt: now.toISOString() });
    } finally {
      await worker.close();
    }
  });
});
describe("Riot match id crawl", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const [p1, p2, p3, p4] = ["1", "2", "3", "4"].map((c) => c.repeat(78)) as [
    string,
    string,
    string,
    string,
  ];
  const entry = (puuid: string) => ({
    puuid,
    summonerId: null,
    tier: "CHALLENGER" as const,
    rank: "I",
    leaguePoints: 1000,
    wins: 1,
    losses: 1,
    leagueId: "league",
  });
  const page = (prefix: string, from: number, count: number) =>
    Array.from({ length: count }, (_, i) => `${prefix}_${from + i}`);
  /** Match id pages per PUUID; a function value answers with a Response instead. */
  function serveIds(pages: Record<string, string[][] | (() => Response)>) {
    fetcher.mockImplementation((input) => {
      const url = new URL(endpoint(input));
      if (!url.pathname.includes("/by-puuid/")) return Promise.resolve(json({}));
      const puuid = decodeURIComponent(url.pathname.split("/")[6]!);
      const answer = pages[puuid];
      if (typeof answer === "function") return Promise.resolve(answer());
      const index = Number(url.searchParams.get("start")) / 100;
      return Promise.resolve(json(answer?.[index] ?? []));
    });
  }
  const crawler = (cap: number) =>
    createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
      riotMatchCap: cap,
    });
  const stored = async () =>
    (
      await pool.query<{ match_id: string; region: string; first_seen_puuid: string }>(
        "SELECT match_id,region,first_seen_puuid FROM riot_match_ids ORDER BY match_id",
      )
    ).rows;
  const idRequests = () =>
    fetcher.mock.calls
      .map(([input]) => new URL(endpoint(input)))
      .filter((u) => u.pathname.includes("/ids"));
  it("stores each ranked match once per region, stops at the cap and resumes", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [entry(p1), entry(p2), entry(p3)], now);
    await saveLadder(pool, "kr", [entry(p4)], now);
    const worker = crawler(4);
    try {
      serveIds({
        [p1]: [["EUW1_1", "EUW1_2", "EUW1_3"]],
        [p2]: [["EUW1_2", "EUW1_3", "EUW1_4", "EUW1_5"]],
        [p3]: [["EUW1_6"]],
        [p4]: [page("KR", 0, 100), page("KR", 100, 1)],
      });
      await worker.request({ kind: "riot-match-ids" });
      while ((await worker.runNext()).state !== "idle");
      // p2's shared games are kept once; the cap of 4 leaves room for one new id, then stops.
      expect((await stored()).filter((m) => m.region === "europe")).toEqual([
        { match_id: "EUW1_1", region: "europe", first_seen_puuid: p1 },
        { match_id: "EUW1_2", region: "europe", first_seen_puuid: p1 },
        { match_id: "EUW1_3", region: "europe", first_seen_puuid: p1 },
        { match_id: "EUW1_4", region: "europe", first_seen_puuid: p2 },
      ]);
      // Asia has its own cap; the player's second page was requested and capped too.
      expect((await stored()).filter((m) => m.region === "asia")).toHaveLength(4);
      const requests = idRequests();
      expect(requests.every((u) => u.searchParams.get("queue") === "420")).toBe(true);
      expect(requests.every((u) => u.searchParams.get("type") === "ranked")).toBe(true);
      expect(requests[0]!.searchParams.get("startTime")).toBe(
        String(Math.floor((now.valueOf() - 14 * 86400000) / 1000)),
      );
      expect(requests.map((u) => u.hostname.split(".")[0])).not.toContain("euw1");
      expect(
        (
          await pool.query<{ n: number }>(
            "SELECT count(*)::integer n FROM riot_request_ledger WHERE method='match-v5.getMatchIdsByPUUID'",
          )
        ).rows[0]!.n,
      ).toBe(requests.length);
      // p3 was never reached, so it has no crawl record and goes first once there is room.
      const crawled = await pool.query<{ puuid: string }>(
        "SELECT puuid FROM riot_match_crawl ORDER BY puuid",
      );
      expect(crawled.rows.map((r) => r.puuid)).toEqual([p1, p2]);
    } finally {
      await worker.close();
    }
  });
  it("keeps progress when a crawl fails and resumes with only newer matches", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [entry(p1), entry(p2)], now);
    const worker = crawler(100);
    try {
      serveIds({ [p1]: [["EUW1_1"]], [p2]: () => new Response("", { status: 503 }) });
      await worker.request({ kind: "riot-match-ids" });
      let result = await worker.runNext();
      while (result.state === "done" && !("records" in result && result.records === 1))
        result = await worker.runNext();
      expect(result.state).toBe("queued");
      expect((await stored()).map((m) => m.match_id)).toEqual(["EUW1_1"]);

      // The retry crawls only p2; p1 is not due again for six hours.
      instant = new Date(now.valueOf() + 3600000);
      fetcher.mockClear();
      serveIds({ [p1]: [["EUW1_9"]], [p2]: [["EUW1_2"]] });
      expect((await worker.runNext()).state).toBe("done");
      expect(idRequests().map((u) => decodeURIComponent(u.pathname.split("/")[6]!))).toEqual([p2]);

      // Seven hours later p1 is due again and asked only for matches since its last crawl.
      instant = new Date(now.valueOf() + 7 * 3600000);
      fetcher.mockClear();
      await worker.request({ kind: "riot-match-ids" });
      // The key check queued on the first run is still waiting; drain both jobs.
      while ((await worker.runNext()).state !== "idle");
      const again = idRequests().find((u) => u.pathname.includes(p1))!;
      expect(again.searchParams.get("startTime")).toBe(String(Math.floor(now.valueOf() / 1000)));
      expect((await stored()).map((m) => m.match_id)).toEqual(["EUW1_1", "EUW1_2", "EUW1_9"]);
    } finally {
      await worker.close();
    }
  });
  it("waits for a patch catalog and skips without a key", async () => {
    await saveLadder(pool, "euw1", [entry(p1)], now);
    const worker = crawler(10);
    try {
      await worker.request({ kind: "riot-match-ids" });
      let result = await worker.runNext();
      while (result.state === "done") result = await worker.runNext();
      expect("error" in result ? result.error : "").toContain("patch catalog");
    } finally {
      await worker.close();
    }
    const keyless = createSync(connection, { clock: () => instant, fetch: fetcher });
    try {
      fetcher.mockClear();
      await keyless.request({ kind: "riot-match-ids" });
      expect(await keyless.runNext()).toMatchObject({ state: "done", records: 0 });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await keyless.close();
    }
  });
});
describe("Riot match details", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const match = JSON.parse(
    readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
  ) as {
    metadata: { matchId: string };
    info: Record<string, unknown> & { participants: Record<string, unknown>[] };
  };
  const ids = ["EUW1_7612345678", "EUW1_2", "EUW1_3", "EUW1_4"];
  const variant = (matchId: string, change: (m: typeof match) => void = () => {}) => {
    const copy = structuredClone(match);
    copy.metadata.matchId = matchId;
    change(copy);
    return copy;
  };
  function serveMatches(byId: Record<string, unknown>) {
    fetcher.mockImplementation((input) => {
      const url = new URL(endpoint(input));
      if (!url.pathname.startsWith("/lol/match/v5/matches/")) return Promise.resolve(json({}));
      const matchId = decodeURIComponent(url.pathname.split("/").pop()!);
      const body = byId[matchId];
      if (body instanceof Response) return Promise.resolve(body);
      return Promise.resolve(body ? json(body) : new Response("", { status: 404 }));
    });
  }
  const states = async () =>
    Object.fromEntries(
      (
        await pool.query<{ match_id: string; fetch_state: string }>(
          "SELECT match_id,fetch_state FROM riot_match_ids ORDER BY match_id",
        )
      ).rows.map((r) => [r.match_id, r.fetch_state]),
    );
  const ingest = async (worker: ReturnType<typeof createSync>) => {
    await worker.request({ kind: "riot-match" });
    let result = await worker.runNext();
    while (result.state !== "idle") {
      const next = await worker.runNext();
      if (next.state === "idle") break;
      result = next;
    }
    return result;
  };
  it("ingests queued matches with Riot identifiers, re-ingests in place and keeps missing fields null", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      ids,
      10,
      now,
    );
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
    });
    try {
      serveMatches({
        [ids[0]!]: match,
        // A partial payload: one participant without statistics, perks or a first item.
        [ids[1]!]: variant(ids[1]!, (m) => {
          for (const field of ["kills", "deaths", "perks", "item0", "win"])
            delete m.info.participants[0]![field];
        }),
        // An unknown patch, and one that fails validation.
        [ids[2]!]: variant(ids[2]!, (m) => {
          m.info.gameVersion = "16.23.741.1200";
        }),
        [ids[3]!]: variant(ids[3]!, (m) => {
          m.info.participants = "not a list" as never;
        }),
      });
      await ingest(worker);
      expect(await states()).toEqual({
        EUW1_2: "fetched",
        EUW1_3: "fetched",
        EUW1_4: "invalid",
        EUW1_7612345678: "fetched",
      });
      const row = (
        await pool.query<Record<string, unknown>>(
          "SELECT queue_id,game_version,patch_key,duration_seconds,remake,platform_id FROM riot_matches WHERE match_id=$1",
          [ids[0]],
        )
      ).rows[0];
      expect(row).toEqual({
        queue_id: 420,
        game_version: "16.22.734.5521",
        patch_key: "16.22",
        duration_seconds: 1834,
        remake: false,
        platform_id: "EUW1",
      });
      const count = async (table: string, matchId = ids[0]) =>
        (
          await pool.query<{ n: number }>(
            `SELECT count(*)::integer n FROM ${table} WHERE match_id=$1`,
            [matchId],
          )
        ).rows[0]!.n;
      expect(await count("riot_match_participants")).toBe(10);
      expect(await count("riot_match_items")).toBe(40);
      expect(await count("riot_match_perks")).toBe(60);
      expect(await count("riot_match_teams")).toBe(2);
      expect(await count("riot_match_objectives")).toBe(16);
      expect(await count("riot_match_bans")).toBe(2);
      expect(
        (
          await pool.query(
            "SELECT puuid,champion_id,side,win,summoner1_id,summoner2_id FROM riot_match_participants WHERE match_id=$1 AND participant_id=1",
            [ids[0]],
          )
        ).rows[0],
      ).toEqual({
        puuid: "a".repeat(78),
        champion_id: 103,
        side: "blue",
        win: true,
        summoner1_id: 4,
        summoner2_id: 14,
      });
      // Missing statistics stay null rather than becoming zero.
      expect(
        (
          await pool.query(
            "SELECT kills,deaths,win,assists FROM riot_match_participants WHERE match_id=$1 AND participant_id=1",
            [ids[1]],
          )
        ).rows[0],
      ).toEqual({ kills: null, deaths: null, win: null, assists: 5 });
      expect(await count("riot_match_perks", ids[1])).toBe(54);
      // The raw payload is kept compressed inside the package.
      const stored = (
        await pool.query<{ payload: Buffer }>(
          "SELECT payload FROM riot_match_payloads WHERE match_id=$1",
          [ids[0]],
        )
      ).rows[0]!.payload;
      expect(JSON.parse(gunzipSync(stored).toString("utf8"))).toEqual(match);
      // Every match request reserved from the ledger.
      expect(
        (
          await pool.query<{ n: number }>(
            "SELECT count(*)::integer n FROM riot_request_ledger WHERE method='match-v5.getMatch'",
          )
        ).rows[0]!.n,
      ).toBe(4);

      // The unknown version stays null and is reported, then links once the catalog has it.
      expect(
        (await pool.query("SELECT patch_key FROM riot_matches WHERE match_id=$1", [ids[2]]))
          .rows[0],
      ).toEqual({ patch_key: null });
      expect(await unresolvedPatches(pool)).toContainEqual({
        source: "riot",
        value: "16.23.741.1200",
        reason: "unknown",
      });
      await savePatchCatalog(pool, ["16.23.1", "16.22.1"], instant);
      expect(
        (await pool.query("SELECT patch_key FROM riot_matches WHERE match_id=$1", [ids[2]]))
          .rows[0],
      ).toEqual({ patch_key: "16.23" });

      // Re-ingesting replaces the facts instead of duplicating them.
      instant = new Date(now.valueOf() + 3600000);
      await pool.query("UPDATE riot_match_ids SET fetch_state='pending' WHERE match_id=$1", [
        ids[0],
      ]);
      serveMatches({
        [ids[0]!]: variant(ids[0]!, (m) => {
          m.info.participants[0]!.kills = 11;
          m.info.participants[0]!.item1 = 0;
        }),
      });
      await ingest(worker);
      expect(await count("riot_match_participants")).toBe(10);
      expect(await count("riot_match_items")).toBe(39);
      expect(
        (
          await pool.query(
            "SELECT kills FROM riot_match_participants WHERE match_id=$1 AND participant_id=1",
            [ids[0]],
          )
        ).rows[0],
      ).toEqual({ kills: 11 });
      expect(
        (await pool.query("SELECT fetched_at FROM riot_matches WHERE match_id=$1", [ids[0]]))
          .rows[0],
      ).toEqual({ fetched_at: instant });
    } finally {
      await worker.close();
    }
  });
  it("marks a match Riot no longer has, and retries a transient failure keeping earlier matches", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      ids.slice(0, 3),
      10,
      now,
    );
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
    });
    try {
      // Ids are fetched in order: EUW1_2 is gone, EUW1_3 succeeds, then the last one fails.
      serveMatches({ [ids[2]!]: variant(ids[2]!), [ids[0]!]: new Response("", { status: 503 }) });
      await ingest(worker);
      expect(await states()).toEqual({
        EUW1_2: "missing",
        EUW1_3: "fetched",
        EUW1_7612345678: "pending",
      });
      expect(
        (
          await pool.query<{ state: string; error: string }>(
            "SELECT state,error FROM sync_jobs WHERE request->>'kind'='riot-match'",
          )
        ).rows,
      ).toEqual([
        {
          state: "queued",
          error: "Riot returned HTTP 503 for a match; ingested matches are kept.",
        },
      ]);
    } finally {
      await worker.close();
    }
  });
  describe("draining the queue", () => {
    const backlog = Array.from({ length: 7 }, (_, i) => `EUW1_80000000${i}`);
    const queue = () =>
      saveMatchIds(
        pool,
        { puuid: "b".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
        backlog,
        10,
        now,
      );
    const worker = (riotRun: { maxItems?: number; maxMs?: number }) =>
      createSync(connection, {
        clock: () => instant,
        fetch: fetcher,
        pause: () => Promise.resolve(),
        riot: { key, kind: "development" },
        riotRun,
      });
    const fetched = async () => Object.values(await states()).filter((s) => s === "fetched").length;
    const jobs = async () =>
      (
        await pool.query<{ kind: string; state: string }>(
          "SELECT request->>'kind' AS kind,state FROM sync_jobs WHERE request->>'kind'<>'riot-key' ORDER BY id",
        )
      ).rows.map((r) => `${r.kind}:${r.state}`);
    beforeEach(async () => {
      await savePatchCatalog(pool, ["16.22.1"], now);
      await queue();
      serveMatches(Object.fromEntries(backlog.map((id) => [id, variant(id)])));
    });
    it("drains a backlog in bounded runs that requeue behind other due jobs", async () => {
      const w = worker({ maxItems: 3 });
      try {
        await w.request({ kind: "riot-match" });
        await w.request({ kind: "aggregate" });
        expect(await w.runNext()).toMatchObject({ state: "done", records: 3 });
        expect(await fetched()).toBe(3);
        // Aggregates for the ingested games are rebuilt with the run.
        expect(
          (await pool.query("SELECT 1 FROM champion_aggregates WHERE source='solo' LIMIT 1"))
            .rowCount,
        ).toBe(1);
        // The run yielded: the aggregate job queued before the continuation runs first.
        expect(await jobs()).toEqual(["riot-match:done", "aggregate:queued", "riot-match:queued"]);
        while ((await w.runNext()).state !== "idle");
        // Two more bounded runs drained the rest; the last found nothing left and did not requeue.
        expect(await jobs()).toEqual([
          "riot-match:done",
          "aggregate:done",
          "riot-match:done",
          "riot-match:done",
        ]);
        expect(await fetched()).toBe(7);
      } finally {
        await w.close();
      }
    });
    it("yields after the time limit by the injected clock", async () => {
      const served = fetcher.getMockImplementation()!;
      fetcher.mockImplementation((input, init) => {
        instant = new Date(instant.valueOf() + 100_000);
        return served(input, init);
      });
      const w = worker({ maxMs: 250_000 });
      try {
        await w.request({ kind: "riot-match" });
        expect(await w.runNext()).toMatchObject({ state: "done", records: 3 });
        expect(await jobs()).toEqual(["riot-match:done", "riot-match:queued"]);
      } finally {
        await w.close();
      }
    });
    it("keeps items fetched before a mid-run deferral and resumes when capacity frees up", async () => {
      const served = fetcher.getMockImplementation()!;
      let calls = 0;
      // Count match requests only; the worker's key check makes its own.
      fetcher.mockImplementation((input, init) =>
        endpoint(input).includes("/lol/match/v5/") && ++calls === 3
          ? Promise.resolve(
              new Response("", {
                status: 429,
                headers: { "Retry-After": "120", "X-Rate-Limit-Type": "application" },
              }),
            )
          : served(input, init),
      );
      const w = worker({});
      try {
        await w.request({ kind: "riot-match" });
        expect((await w.runNext()).state).toBe("queued");
        expect(await fetched()).toBe(2);
        expect(
          (await pool.query("SELECT 1 FROM champion_aggregates WHERE source='solo' LIMIT 1"))
            .rowCount,
        ).toBe(1);
        const job = (
          await pool.query<{ available_at: Date }>(
            "SELECT available_at FROM sync_jobs WHERE state='queued' AND request->>'kind'='riot-match'",
          )
        ).rows[0]!;
        // Nothing more is sent until the paused window ends.
        expect(job.available_at.valueOf()).toBeGreaterThanOrEqual(instant.valueOf() + 100_000);
        expect(calls).toBe(3);
        while ((await w.runNext()).state !== "idle");
        expect(calls).toBe(3);
        instant = new Date(job.available_at);
        expect(await w.runNext()).toMatchObject({ state: "done", records: 5 });
        expect(await fetched()).toBe(7);
      } finally {
        await w.close();
      }
    });
  });
});
describe("Riot match timelines", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const read = (name: string) =>
    JSON.parse(readFileSync(new URL(`../../tests/riot/${name}`, import.meta.url), "utf8")) as {
      metadata: { matchId: string };
      info: Record<string, unknown>;
    };
  const matchPayload = read("match-euw1.json");
  const timeline = read("timeline-euw1.json");
  const ids = ["EUW1_7612345678", "EUW1_2", "EUW1_3", "EUW1_4"];
  async function ingestMatch(matchId: string) {
    const copy = structuredClone(matchPayload);
    copy.metadata.matchId = matchId;
    await saveRiotMatch(pool, parseRiotMatch(copy, matchId), copy, now);
  }
  const withId = (matchId: string, change: (t: typeof timeline) => void = () => {}) => {
    const copy = structuredClone(timeline);
    copy.metadata.matchId = matchId;
    change(copy);
    return copy;
  };
  it("stores frames and events linked to match participants, with missing coordinates null", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      ids,
      10,
      now,
    );
    for (const id of ids) await ingestMatch(id);
    const bodies: Record<string, unknown> = {
      [ids[0]!]: timeline,
      // A partial frame and an extra purchase event.
      [ids[1]!]: withId(ids[1]!, (t) => {
        const frames = t.info.frames as {
          events: Record<string, unknown>[];
          participantFrames: unknown;
        }[];
        frames[0]!.events.push({
          type: "ITEM_PURCHASED",
          timestamp: 3000,
          participantId: 9,
          itemId: 1,
        });
        frames[1]!.participantFrames = { "1": { participantId: 1 } };
      }),
      [ids[2]!]: withId(ids[2]!, (t) => {
        t.info.frames = "nope";
      }),
    };
    fetcher.mockImplementation((input) => {
      const url = new URL(endpoint(input));
      if (!url.pathname.endsWith("/timeline")) return Promise.resolve(json({}));
      const matchId = decodeURIComponent(url.pathname.split("/")[5]!);
      const body = bodies[matchId];
      return Promise.resolve(body ? json(body) : new Response("", { status: 404 }));
    });
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
    });
    try {
      await worker.request({ kind: "riot-timeline" });
      while ((await worker.runNext()).state !== "idle");
    } finally {
      await worker.close();
    }
    expect(
      Object.fromEntries(
        (
          await pool.query<{ match_id: string; timeline_state: string }>(
            "SELECT match_id,timeline_state FROM riot_matches ORDER BY match_id",
          )
        ).rows.map((r) => [r.match_id, r.timeline_state]),
      ),
    ).toEqual({
      EUW1_2: "fetched",
      EUW1_3: "invalid",
      EUW1_4: "missing",
      EUW1_7612345678: "fetched",
    });
    const frames = await pool.query(
      "SELECT minute,x,y,level,total_gold FROM riot_timeline_frames WHERE match_id=$1 AND participant_id=3 ORDER BY minute",
      [ids[0]],
    );
    expect(frames.rows).toEqual([
      { minute: 0, x: 800, y: 700, level: 1, total_gold: 500 },
      { minute: 1, x: 810, y: 700, level: 2, total_gold: 900 },
      { minute: 2, x: null, y: null, level: 3, total_gold: 1300 },
    ]);
    // A partial frame keeps its unknown statistics null.
    expect(
      (
        await pool.query(
          "SELECT x,total_gold,level FROM riot_timeline_frames WHERE match_id=$1 AND minute=1 AND participant_id=1",
          [ids[1]],
        )
      ).rows,
    ).toEqual([{ x: null, total_gold: null, level: null }]);
    expect(
      (
        await pool.query(
          "SELECT type,participant_id,victim_id,x,y,assisting_participant_ids FROM riot_timeline_events WHERE match_id=$1 AND type IN ('CHAMPION_KILL','WARD_PLACED','BUILDING_KILL') ORDER BY seq",
          [ids[0]],
        )
      ).rows,
    ).toEqual([
      {
        type: "WARD_PLACED",
        participant_id: 5,
        victim_id: null,
        x: null,
        y: null,
        assisting_participant_ids: null,
      },
      {
        type: "CHAMPION_KILL",
        participant_id: 2,
        victim_id: 7,
        x: 7200,
        y: 7100,
        assisting_participant_ids: [1, 4],
      },
      {
        type: "BUILDING_KILL",
        participant_id: null,
        victim_id: null,
        x: 8955,
        y: 8510,
        assisting_participant_ids: [1],
      },
    ]);
    // Reads by champion and patch: Ahri's (champion 103) skill-ups on patch 16.22.
    expect(
      (
        await pool.query(
          `SELECT e.match_id,e.skill_slot FROM riot_timeline_events e
           JOIN riot_match_participants p ON p.match_id=e.match_id AND p.participant_id=e.participant_id
           JOIN riot_matches m ON m.match_id=e.match_id
           WHERE p.champion_id=103 AND m.patch_key='16.22' AND e.type='SKILL_LEVEL_UP' ORDER BY e.match_id`,
        )
      ).rows,
    ).toEqual([
      { match_id: "EUW1_2", skill_slot: 1 },
      { match_id: "EUW1_7612345678", skill_slot: 1 },
    ]);
    expect(
      (
        await pool.query<{ n: number }>(
          "SELECT count(*)::integer n FROM riot_request_ledger WHERE method='match-v5.getTimeline'",
        )
      ).rows[0]!.n,
    ).toBe(4);
  });
  it("rejects a timeline whose participants are not in the ingested match and retries transient failures", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      ids.slice(0, 2),
      10,
      now,
    );
    await ingestMatch(ids[0]!);
    // EUW1_2's match has only participants 1-5.
    const partial = structuredClone(matchPayload);
    partial.metadata.matchId = ids[1]!;
    (partial.info as { participants: unknown[] }).participants.splice(5);
    await saveRiotMatch(pool, parseRiotMatch(partial, ids[1]!), partial, now);
    fetcher.mockImplementation((input) => {
      const matchId = decodeURIComponent(new URL(endpoint(input)).pathname.split("/")[5] ?? "");
      if (matchId === ids[1]) return Promise.resolve(json(withId(ids[1])));
      if (matchId === ids[0]) return Promise.resolve(new Response("", { status: 503 }));
      return Promise.resolve(json({}));
    });
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
    });
    try {
      await worker.request({ kind: "riot-timeline" });
      while ((await worker.runNext()).state !== "idle");
    } finally {
      await worker.close();
    }
    expect(
      (await pool.query("SELECT match_id,timeline_state FROM riot_matches ORDER BY match_id")).rows,
    ).toEqual([
      { match_id: "EUW1_2", timeline_state: "invalid" },
      { match_id: "EUW1_7612345678", timeline_state: "pending" },
    ]);
    expect(
      (await pool.query("SELECT count(*)::integer n FROM riot_timeline_frames")).rows[0],
    ).toEqual({ n: 0 });
    expect(
      (await pool.query("SELECT state FROM sync_jobs WHERE request->>'kind'='riot-timeline'")).rows,
    ).toEqual([{ state: "queued" }]);
  });
});
describe("Solo-queue retention", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const matchPayload = JSON.parse(
    readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
  ) as { metadata: { matchId: string }; info: { gameVersion: string } };
  const timeline = JSON.parse(
    readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
  ) as { metadata: { matchId: string } };
  const versions: Record<string, string> = {
    EUW1_22: "16.22.734.1",
    EUW1_21: "16.21.700.1",
    EUW1_20: "16.20.690.1",
    EUW1_19: "16.19.680.1",
    EUW1_99: "17.1.1.1",
  };
  const payload = (matchId: string) => {
    const copy = structuredClone(matchPayload);
    copy.metadata.matchId = matchId;
    copy.info.gameVersion = versions[matchId]!;
    return copy;
  };
  const sync = (retain: number) =>
    createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      riot: { key, kind: "development" },
      riotRetainPatches: retain,
    });
  const drain = async (
    worker: ReturnType<typeof createSync>,
    kind: "riot-retention" | "riot-match",
  ) => {
    await worker.request({ kind });
    while ((await worker.runNext()).state !== "idle");
  };
  const states = async () =>
    (
      await pool.query<{ match_id: string; fetch_state: string; pruned_patch_key: string | null }>(
        "SELECT match_id,fetch_state,pruned_patch_key FROM riot_match_ids ORDER BY match_id",
      )
    ).rows;
  it("prunes matches of older patches in batches, keeps pro data, and backfills when widened", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1", "16.20.1", "16.19.1"], now);
    await importCsv();
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      Object.keys(versions),
      10,
      now,
    );
    // An id crawled while 16.19 was current, never fetched.
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.19" },
      ["EUW1_5"],
      10,
      now,
    );
    for (const id of Object.keys(versions)) {
      const body = payload(id);
      await saveRiotMatch(pool, parseRiotMatch(body, id), body, now);
    }
    const timelineBody = structuredClone(timeline);
    timelineBody.metadata.matchId = "EUW1_20";
    await saveTimeline(pool, parseRiotTimeline(timelineBody, "EUW1_20"), now);
    const oracleGames = async () =>
      (await pool.query<{ n: number }>("SELECT count(*)::integer n FROM oracle_archive_games"))
        .rows[0]!.n;
    const proBefore = await oracleGames();

    // Bounded batches: one at a time.
    expect(await pruneBatch(pool, ["16.22", "16.21", "16.20"], 1)).toBe(1);
    expect(await pruneBatch(pool, ["16.22", "16.21", "16.20"], 1)).toBe(0);

    const narrow = sync(1);
    try {
      await drain(narrow, "riot-retention");
    } finally {
      await narrow.close();
    }
    expect(await states()).toEqual([
      { match_id: "EUW1_19", fetch_state: "pruned", pruned_patch_key: "16.19" },
      { match_id: "EUW1_20", fetch_state: "pruned", pruned_patch_key: "16.20" },
      { match_id: "EUW1_21", fetch_state: "fetched", pruned_patch_key: null },
      { match_id: "EUW1_22", fetch_state: "fetched", pruned_patch_key: null },
      { match_id: "EUW1_5", fetch_state: "pruned", pruned_patch_key: null },
      // An unknown version may be newer than the catalog, so it is kept.
      { match_id: "EUW1_99", fetch_state: "fetched", pruned_patch_key: null },
    ]);
    const remaining = async (table: string) =>
      (await pool.query<{ n: number }>(`SELECT count(DISTINCT match_id)::integer n FROM ${table}`))
        .rows[0]!.n;
    expect(await remaining("riot_matches")).toBe(3);
    expect(await remaining("riot_match_participants")).toBe(3);
    expect(await remaining("riot_match_payloads")).toBe(3);
    expect(await remaining("riot_timeline_frames")).toBe(0);
    expect(await remaining("riot_timeline_events")).toBe(0);
    expect(await oracleGames()).toBe(proBefore);
    const storage = (await queries.status()).riotStorage;
    expect(storage).toMatchObject({
      previousPatches: 1,
      keptPatches: ["16.22", "16.21"],
      lastRunAt: now.toISOString(),
      prunedMatches: 1,
      backfilledMatches: 0,
    });
    expect(storage.patches.map((p) => [p.patchKey, p.matches])).toEqual([
      [null, 1],
      ["16.22", 1],
      ["16.21", 1],
    ]);
    expect(storage.patches.every((p) => p.estimatedBytes > 0)).toBe(true);

    // Widening to two previous patches refetches 16.20 through the ledger; 16.19 stays pruned.
    instant = new Date(now.valueOf() + 86400000);
    fetcher.mockImplementation((input) => {
      const matchId = decodeURIComponent(new URL(endpoint(input)).pathname.split("/").pop()!);
      return Promise.resolve(versions[matchId] ? json(payload(matchId)) : json({}));
    });
    const wide = sync(2);
    try {
      await drain(wide, "riot-retention");
      expect((await queries.status()).riotStorage.backfilledMatches).toBe(1);
      await drain(wide, "riot-match");
    } finally {
      await wide.close();
    }
    expect((await states()).find((s) => s.match_id === "EUW1_20")).toEqual({
      match_id: "EUW1_20",
      fetch_state: "fetched",
      pruned_patch_key: null,
    });
    expect((await states()).find((s) => s.match_id === "EUW1_19")?.fetch_state).toBe("pruned");
    expect(
      (
        await pool.query<{ n: number }>(
          "SELECT count(*)::integer n FROM riot_request_ledger WHERE method='match-v5.getMatch'",
        )
      ).rows[0]!.n,
    ).toBe(1);
  });
});
describe("Riot crawl status", () => {
  it("reports quota per region and method, including pauses, and Riot job outcomes", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    const entry = (puuid: string) => ({
      puuid,
      summonerId: null,
      tier: "MASTER" as const,
      rank: "I",
      leaguePoints: 1,
      wins: 1,
      losses: 1,
      leagueId: "l",
    });
    await saveLadder(pool, "euw1", [entry("a".repeat(78)), entry("b".repeat(78))], now);
    await saveLadder(pool, "kr", [entry("c".repeat(78))], now);
    const crawl = { puuid: "a".repeat(78), platform: "euw1", region: "europe" };
    await saveMatchIds(
      pool,
      { ...crawl, patchKey: "16.22" },
      ["EUW1_1", "EUW1_2", "EUW1_3"],
      10,
      now,
    );
    await saveMatchIds(pool, { ...crawl, patchKey: "16.21" }, ["EUW1_9"], 10, now);
    const match = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    match.metadata.matchId = "EUW1_1";
    await saveRiotMatch(pool, parseRiotMatch(match, "EUW1_1"), match, now);
    await pool.query("UPDATE riot_matches SET timeline_state='fetched' WHERE match_id='EUW1_1'");
    await observeRiotLimits(
      pool,
      "europe",
      "match-v5.getMatch",
      new Headers({ "X-Method-Rate-Limit": "2000:10" }),
      200,
      now,
    );
    await reserveRiotRequest(pool, "europe", "match-v5.getMatch", now);
    await reserveRiotRequest(pool, "europe", "match-v5.getMatch", now);
    await observeRiotLimits(
      pool,
      "kr",
      "league-v4.masterleagues",
      new Headers({ "Retry-After": "30", "X-Rate-Limit-Type": "method" }),
      429,
      now,
    );
    // A keyless retention run succeeds; a crawl without a catalog would fail. Record both.
    await sync.request({ kind: "riot-retention" });
    expect((await sync.runNext()).state).toBe("done");
    await pool.query("TRUNCATE patches CASCADE");
    const failing = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      riot: { key: "RGAPI-01234567-89ab-cdef-0123-456789abcdef", kind: "development" },
    });
    try {
      await failing.request({ kind: "riot-match-ids" });
      while ((await failing.runNext()).state !== "idle");
    } finally {
      await failing.close();
    }
    const { riotCrawl } = await queries.status();
    expect(riotCrawl.quota).toEqual([
      {
        region: "europe",
        method: "",
        windows: [
          { limit: 20, windowSeconds: 1, used: 2 },
          { limit: 100, windowSeconds: 120, used: 2 },
        ],
        pausedUntil: null,
      },
      {
        region: "europe",
        method: "match-v5.getMatch",
        windows: [{ limit: 2000, windowSeconds: 10, used: 2 }],
        pausedUntil: null,
      },
      // A 429 pause shows even before any limit for the method is known.
      {
        region: "kr",
        method: "league-v4.masterleagues",
        windows: [],
        pausedUntil: new Date(now.valueOf() + 30000).toISOString(),
      },
      // The key check the crawl worker made when it started.
      {
        region: "na1",
        method: "",
        windows: [
          { limit: 20, windowSeconds: 1, used: 1 },
          { limit: 100, windowSeconds: 120, used: 1 },
        ],
        pausedUntil: null,
      },
      { region: "na1", method: "lol-status-v4.getPlatformData", windows: [], pausedUntil: null },
    ]);
    expect(
      riotCrawl.jobs.map((j) => [j.kind, Boolean(j.lastSuccess), Boolean(j.lastErrorAt)]),
    ).toEqual([
      ["riot-key", true, false],
      ["riot-match-ids", false, true],
      ["riot-retention", true, false],
    ]);
    expect(riotCrawl.jobs[1]!.error).toContain("patch catalog");
  });
  it("shows crawl progress per region and patch, including a ladder region not yet crawled", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    const entry = (puuid: string) => ({
      puuid,
      summonerId: null,
      tier: "MASTER" as const,
      rank: "I",
      leaguePoints: 1,
      wins: 1,
      losses: 1,
      leagueId: "l",
    });
    await saveLadder(pool, "euw1", [entry("a".repeat(78)), entry("b".repeat(78))], now);
    await saveLadder(pool, "kr", [entry("c".repeat(78))], now);
    const crawl = { puuid: "a".repeat(78), platform: "euw1", region: "europe" };
    await saveMatchIds(
      pool,
      { ...crawl, patchKey: "16.22" },
      ["EUW1_1", "EUW1_2", "EUW1_3"],
      10,
      now,
    );
    await saveMatchIds(pool, { ...crawl, patchKey: "16.21" }, ["EUW1_9"], 10, now);
    const match = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    match.metadata.matchId = "EUW1_1";
    await saveRiotMatch(pool, parseRiotMatch(match, "EUW1_1"), match, now);
    await pool.query("UPDATE riot_matches SET timeline_state='fetched' WHERE match_id='EUW1_1'");
    expect((await queries.status()).riotCrawl.progress).toEqual([
      {
        region: "europe",
        patchKey: "16.22",
        ladderPlayers: 2,
        matchIds: 3,
        matches: 1,
        timelines: 1,
      },
      {
        region: "europe",
        patchKey: "16.21",
        ladderPlayers: 2,
        matchIds: 1,
        matches: 0,
        timelines: 0,
      },
      {
        region: "asia",
        patchKey: "16.22",
        ladderPlayers: 1,
        matchIds: 0,
        matches: 0,
        timelines: 0,
      },
    ]);
  });
});
describe("Champion aggregates", () => {
  const match = JSON.parse(
    readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
  ) as {
    metadata: { matchId: string };
    info: { participants: Record<string, unknown>[] };
  };
  const ladderEntry = (puuid: string, tier: "CHALLENGER" | "MASTER") => ({
    puuid,
    summonerId: null,
    tier,
    rank: "I",
    leaguePoints: 1,
    wins: 1,
    losses: 1,
    leagueId: "l",
  });
  const [challenger, master] = ["x".repeat(78), "y".repeat(78)];
  async function ingest(
    matchId: string,
    seenBy: string,
    change: (m: typeof match) => void = () => {},
  ) {
    await saveMatchIds(
      pool,
      { puuid: seenBy, platform: "euw1", region: "europe", patchKey: "16.22" },
      [matchId],
      10,
      now,
    );
    const copy = structuredClone(match);
    copy.metadata.matchId = matchId;
    change(copy);
    await saveRiotMatch(pool, parseRiotMatch(copy, matchId), copy, now);
  }
  const aggregates = async (where: string) =>
    (
      await pool.query<Record<string, unknown>>(
        `SELECT tier,role,games,result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate
         FROM champion_aggregates WHERE ${where} ORDER BY tier,role`,
      )
    ).rows;
  const runAggregate = async (rebuild = false) => {
    await sync.request(rebuild ? { kind: "aggregate", rebuild } : { kind: "aggregate" });
    let result = await sync.runNext();
    while (result.state !== "idle") result = await sync.runNext();
  };
  it("builds solo-queue aggregates that match hand counts, with null rates for empty samples", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    await saveLadder(
      pool,
      "euw1",
      [ladderEntry(challenger, "CHALLENGER"), ladderEntry(master, "MASTER")],
      now,
    );
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
    });
    await ingest("EUW1_3", master, (m) => {
      delete m.info.participants[0]!.win;
    });
    // A remake does not count.
    await ingest("EUW1_4", challenger, (m) => {
      m.info.participants[3]!.gameEndedInEarlySurrender = true;
    });
    // An empty patch with nothing to count.
    await pool.query("INSERT INTO aggregate_dirty VALUES('solo','16.21',$1)", [now]);
    await runAggregate();
    // Ahri (103), always mid for the winning blue side in the fixture.
    expect(await aggregates("source='solo' AND champion_key=103")).toEqual([
      {
        tier: "CHALLENGER",
        role: "ALL",
        games: 2,
        result_games: 2,
        wins: 1,
        bans: 0,
        slice_games: 2,
        win_rate: 0.5,
        pick_rate: 1,
        ban_rate: 0,
      },
      {
        tier: "CHALLENGER",
        role: "MIDDLE",
        games: 2,
        result_games: 2,
        wins: 1,
        bans: null,
        slice_games: 2,
        win_rate: 0.5,
        pick_rate: 1,
        ban_rate: null,
      },
      // One game whose result Riot omitted: no win rate rather than 0%.
      {
        tier: "MASTER",
        role: "ALL",
        games: 1,
        result_games: 0,
        wins: 0,
        bans: 0,
        slice_games: 1,
        win_rate: null,
        pick_rate: 1,
        ban_rate: 0,
      },
      {
        tier: "MASTER",
        role: "MIDDLE",
        games: 1,
        result_games: 0,
        wins: 0,
        bans: null,
        slice_games: 1,
        win_rate: null,
        pick_rate: 1,
        ban_rate: null,
      },
    ]);
    // Champion 238 is banned by both teams in every game but never picked; a ban counts once per game.
    expect(await aggregates("source='solo' AND champion_key=238")).toEqual([
      {
        tier: "CHALLENGER",
        role: "ALL",
        games: 0,
        result_games: 0,
        wins: 0,
        bans: 2,
        slice_games: 2,
        win_rate: null,
        pick_rate: 0,
        ban_rate: 1,
      },
      {
        tier: "MASTER",
        role: "ALL",
        games: 0,
        result_games: 0,
        wins: 0,
        bans: 1,
        slice_games: 1,
        win_rate: null,
        pick_rate: 0,
        ban_rate: 1,
      },
    ]);
    expect((await aggregates("source='solo' AND patch_key='16.22'")).length).toBe(42);
    expect(await aggregates("patch_key='16.21'")).toEqual([]);
    expect((await pool.query("SELECT count(*)::integer n FROM aggregate_dirty")).rows[0]).toEqual({
      n: 0,
    });

    // Reads sum over tiers in SQL and carry sample counts on every rate.
    const all = await championStats(pool, { role: "MIDDLE" });
    expect(all).toMatchObject({ source: "solo", patch: "16.22", sliceGames: 3 });
    expect(all.rows.find((r) => r.championKey === 103)).toMatchObject({
      games: 3,
      wins: 1,
      winRate: { value: 0.5, sampleCount: 2 },
      pickRate: { value: 1, sampleCount: 3 },
      banRate: { value: null, sampleCount: 0 },
    });
    const masters = await queries.championStats({ tier: "MASTER", champion: 238 });
    expect(masters.rows).toEqual([
      expect.objectContaining({
        championKey: 238,
        games: 0,
        winRate: { value: null, sampleCount: 0, lower: null, upper: null },
        banRate: { value: 1, sampleCount: 1 },
      }),
    ]);
    expect(await championStats(pool, { patch: "16.21" })).toEqual({
      source: "solo",
      patch: "16.21",
      sliceGames: 0,
      rows: [],
    });
    expect(await championStats(pool, { source: "pro" })).toEqual({
      source: "pro",
      patch: null,
      sliceGames: 0,
      rows: [],
    });
    await expect(championStats(pool, { role: "SUPPORT" as "UTILITY" })).rejects.toThrow();
  });
  it("serves a tier list sorted and paginated in SQL, with names, samples and facets", async () => {
    serveDataDragon(["16.22.1", "16.21.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(
      pool,
      "euw1",
      [ladderEntry(challenger, "CHALLENGER"), ladderEntry(master, "MASTER")],
      now,
    );
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
    });
    await ingest("EUW1_3", master, (m) => {
      delete m.info.participants[0]!.win;
    });
    await runAggregate();
    const list = await tierList(pool, {});
    expect(list).toMatchObject({ patch: "16.22", sliceGames: 3 });
    expect(list.facets).toEqual({
      patches: ["16.22"],
      regions: ["europe"],
      tiers: ["CHALLENGER", "MASTER"],
    });
    // Eleven champions (ten picked, one only banned), sorted by games, then key.
    expect(list.page.total).toBe(11);
    expect(list.page.items[0]).toMatchObject({
      championKey: 64,
      name: null,
      games: 3,
      sample: "hidden",
    });
    const ahri = list.page.items.find((r) => r.championKey === 103)!;
    expect(ahri).toMatchObject({
      championId: "Ahri",
      name: "Ahri",
      games: 3,
      wins: 1,
      winRate: { value: 0.5, sampleCount: 2 },
      pickRate: { value: 1, sampleCount: 3 },
      banRate: { value: 0, sampleCount: 3 },
      sample: "hidden",
    });
    expect(ahri.winRate.lower).toBeLessThan(0.5);
    expect(list.page.items.at(-1)).toMatchObject({
      championKey: 238,
      games: 0,
      winRate: { value: null },
    });

    // Win rate ascending keeps unknown win rates last; descending puts winners first.
    const ascending = await tierList(pool, { sort: "winRate", order: "asc" });
    expect(ascending.page.items[0]!.winRate.value).toBe(0);
    expect(ascending.page.items.at(-1)!.winRate.value).toBeNull();
    const descending = await tierList(pool, { sort: "winRate" });
    expect(descending.page.items[0]!.winRate.value).toBe(1);
    expect((await tierList(pool, { sort: "banRate" })).page.items[0]!.championKey).toBe(238);

    // Role, tier and page filters.
    const mid = await tierList(pool, { role: "MIDDLE", tier: "MASTER" });
    expect(mid.sliceGames).toBe(1);
    // Both mid laners of the one master-tier game: Ahri's result is unknown, Yasuo lost.
    expect(mid.page.items.map((r) => [r.championKey, r.games, r.winRate.value])).toEqual([
      [103, 1, null],
      [157, 1, 0],
    ]);
    expect((await tierList(pool, { page: 2 })).page).toMatchObject({
      items: [],
      total: 0,
      page: 2,
    });
    expect(await tierList(pool, { source: "pro" })).toMatchObject({
      patch: null,
      page: { total: 0 },
    });
    await expect(tierList(pool, { sort: "name" as "games" })).rejects.toThrow();
    expect((await queries.tierList({ patch: "16.21" })).page.total).toBe(0);
  });
  it("gives a champion overview with a shrunk-rate tier and a trend with gaps", async () => {
    serveDataDragon(["16.22.1", "16.21.1", "16.20.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(
      pool,
      "euw1",
      [ladderEntry(challenger, "CHALLENGER"), ladderEntry(master, "MASTER")],
      now,
    );
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
    });
    await ingest("EUW1_3", master, (m) => {
      delete m.info.participants[0]!.win;
    });
    await ingest("EUW1_4", challenger, (m) => {
      (m.info as unknown as { gameVersion: string }).gameVersion = "16.21.700.1";
    });
    await runAggregate();
    const ahri = (await championOverview(pool, { champion: "Ahri" }))!;
    expect(ahri).toMatchObject({
      // The metadata job caches catalog icons locally.
      champion: {
        id: "Ahri",
        key: 103,
        name: "Ahri",
        imageUrl: expect.stringMatching(/^\/api\/images\/[a-f0-9]{64}$/) as string,
      },
      patch: "16.22",
      sliceGames: 3,
      games: 3,
      winRate: { value: 0.5, sampleCount: 2 },
      pickRate: { value: 1, sampleCount: 3 },
      banRate: { value: 0, sampleCount: 3 },
    });
    expect(ahri.winRate.lower).toBeLessThan(0.5);
    expect(ahri.shrunkWinRate.sampleCount).toBe(2);
    expect(ahri.tier).toBe(tierFromDelta(ahri.shrunkWinRate.value! - ahri.baseline!));
    // 16.20 is in the catalog but has no games: a gap, not zero.
    expect(ahri.trend).toEqual([
      { patch: "16.20", games: 0, winRate: { value: null, sampleCount: 0 } },
      { patch: "16.21", games: 1, winRate: { value: 1, sampleCount: 1 } },
      { patch: "16.22", games: 3, winRate: { value: 0.5, sampleCount: 2 } },
    ]);
    // Filters apply to the rates, the prior and the trend alike.
    const master16 = (await championOverview(pool, {
      champion: "Ahri",
      tier: "MASTER",
      role: "MIDDLE",
    }))!;
    expect(master16).toMatchObject({
      sliceGames: 1,
      games: 1,
      winRate: { value: null, sampleCount: 0 },
      shrunkWinRate: { value: null, sampleCount: 0 },
      tier: null,
    });
    // With a retention setting the trend spans the kept patches.
    await pool.query("UPDATE riot_retention SET kept_patches='{16.22,16.21}'");
    expect((await championOverview(pool, { champion: "Ahri" }))!.trend.map((t) => t.patch)).toEqual(
      ["16.21", "16.22"],
    );
    // No pro data yet: unknown rather than zero; an unknown champion is not found.
    expect(await queries.championOverview({ champion: "Ahri", source: "pro" })).toMatchObject({
      patch: null,
      games: 0,
      winRate: { value: null },
      pickRate: { value: null },
      tier: null,
    });
    expect(await championOverview(pool, { champion: "NotAChampion" })).toBeNull();
  });
  it("derives builds from timeline purchases, ignoring undone purchases and sales", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
    });
    await ingest("EUW1_3", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: { frames: { events: Record<string, unknown>[] }[] };
    };
    const buy = (seconds: number, itemId: number) => ({
      type: "ITEM_PURCHASED",
      timestamp: seconds * 1000,
      participantId: 1,
      itemId,
    });
    const withEvents = (matchId: string, events: Record<string, unknown>[]) => {
      const copy = structuredClone(timeline);
      copy.metadata.matchId = matchId;
      copy.info.frames[2]!.events.push(...events);
      return copy;
    };
    // The fixture opens with Doran's Ring and a potion whose purchase is undone.
    await saveTimeline(
      pool,
      parseRiotTimeline(
        withEvents("EUW1_1", [buy(600, 3020), buy(900, 4645), buy(1200, 3089), buy(1500, 3157)]),
        "EUW1_1",
      ),
      now,
    );
    await saveTimeline(
      pool,
      parseRiotTimeline(
        withEvents("EUW1_2", [
          buy(600, 3020),
          buy(900, 4645),
          buy(1000, 3089),
          { type: "ITEM_UNDO", timestamp: 1005000, participantId: 1, beforeId: 3089, afterId: 0 },
          buy(1010, 3135),
          { type: "ITEM_SOLD", timestamp: 1100000, participantId: 1, itemId: 1056 },
          buy(1500, 3157),
        ]),
        "EUW1_2",
      ),
      now,
    );
    // EUW1_3 has no timeline, so it contributes no builds.
    await runAggregate();
    expect(
      (
        await pool.query(
          "SELECT kind,build,games,result_games,wins FROM champion_builds WHERE champion_key=103 AND kind NOT IN ('runes','keystone','shards','spells') AND kind NOT LIKE 'skill%' ORDER BY kind,build",
        )
      ).rows,
    ).toEqual([
      { kind: "boots", build: "3020", games: 2, result_games: 2, wins: 1 },
      { kind: "path", build: "4645,3089,3157", games: 1, result_games: 1, wins: 1 },
      { kind: "path", build: "4645,3135,3157", games: 1, result_games: 1, wins: 0 },
      { kind: "slot1", build: "4645", games: 2, result_games: 2, wins: 1 },
      { kind: "slot2", build: "3089", games: 1, result_games: 1, wins: 1 },
      { kind: "slot2", build: "3135", games: 1, result_games: 1, wins: 0 },
      { kind: "slot3", build: "3157", games: 2, result_games: 2, wins: 1 },
      { kind: "start", build: "1056", games: 2, result_games: 2, wins: 1 },
    ]);
    const overview = (await championOverview(pool, { champion: "Ahri", role: "MIDDLE" }))!;
    expect(overview.builds!.slot1).toEqual([
      {
        items: [
          {
            kind: "item",
            id: 4645,
            catalogId: "4645",
            name: "Shadowflame",
            imageUrl: expect.stringMatching(/^\/api\/images\/[a-f0-9]{64}$/) as string,
          },
        ],
        games: 2,
        pickRate: { value: null, sampleCount: 0 },
        // Two results are below the minimum sample, so the win rate is not shown.
        winRate: { value: null, sampleCount: 2 },
        sample: "hidden",
      },
    ]);
    expect(overview.builds!.boots[0]!.items[0]).toMatchObject({
      id: 3020,
      name: "Sorcerer's Shoes",
    });
    expect(overview.builds!.path.map((p) => p.items.map((i) => i.id))).toEqual([
      [4645, 3089, 3157],
      [4645, 3135, 3157],
    ]);
    expect((await championOverview(pool, { champion: "Ahri", source: "pro" }))!.builds).toBeNull();
  });
  it("counts rune pages, keystones, stat shards and spell pairs from every game", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    // No rune data at all: no page, keystone or shards, but the spells still count.
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
      delete m.info.participants[0]!.perks;
    });
    await ingest("EUW1_3", challenger, (m) => {
      m.info.participants[0]!.summoner2Id = 12;
    });
    await ingest("EUW1_4", challenger, (m) => {
      m.info.participants[3]!.gameEndedInEarlySurrender = true;
    });
    await runAggregate();
    expect(
      (
        await pool.query(
          `SELECT kind,build,games,result_games,wins FROM champion_builds
           WHERE champion_key=103 AND kind IN ('runes','keystone','shards','spells') ORDER BY kind,build`,
        )
      ).rows,
    ).toEqual([
      { kind: "keystone", build: "8112", games: 2, result_games: 2, wins: 2 },
      {
        kind: "runes",
        build: "8100,8112,8139,8138,8135,8200,8226,8210",
        games: 2,
        result_games: 2,
        wins: 2,
      },
      { kind: "shards", build: "5005,5008,5001", games: 2, result_games: 2, wins: 2 },
      { kind: "spells", build: "4,12", games: 1, result_games: 1, wins: 1 },
      { kind: "spells", build: "4,14", games: 2, result_games: 2, wins: 1 },
    ]);
    const builds = (await championOverview(pool, { champion: "Ahri", role: "MIDDLE" }))!.builds!;
    expect(builds.keystone[0]!.items).toEqual([
      expect.objectContaining({ kind: "rune", id: 8112, name: "Electrocute" }),
    ]);
    expect(builds.spells[0]).toMatchObject({
      items: [
        { kind: "spell", id: 4, catalogId: "SummonerFlash", name: "Flash" },
        { kind: "spell", id: 14, catalogId: "SummonerDot", name: "Ignite" },
      ],
      games: 2,
      // Three Ahri games are below the minimum sample: both rates stay unknown.
      pickRate: { value: null, sampleCount: 3 },
      winRate: { value: null, sampleCount: 2 },
    });
    // Data Dragon has no stat shard entries, so they keep their ids without names.
    expect(builds.shards[0]!.items.map((i) => [i.kind, i.id, i.name])).toEqual([
      ["shard", 5005, null],
      ["shard", 5008, null],
      ["shard", 5001, null],
    ]);
  });
  it("derives skill orders and counts games whose skill-ups do not decide one", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: { frames: { events: Record<string, unknown>[] }[] };
    };
    const save = async (matchId: string, slots: number[]) => {
      const copy = structuredClone(timeline);
      copy.metadata.matchId = matchId;
      // The fixture already levels Ahri's Q at 2.1 seconds.
      copy.info.frames[2]!.events.push(
        ...slots.map((skillSlot, i) => ({
          type: "SKILL_LEVEL_UP",
          timestamp: 200000 + i * 60000,
          participantId: 1,
          skillSlot,
          levelUpType: "NORMAL",
        })),
      );
      await saveTimeline(pool, parseRiotTimeline(copy, matchId), now);
    };
    await save("EUW1_1", [3, 2, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2]);
    await save("EUW1_2", []);
    await runAggregate();
    expect(
      (
        await pool.query(
          `SELECT kind,build,games FROM champion_builds WHERE champion_key=103
           AND kind LIKE 'skill%' ORDER BY kind,build`,
        )
      ).rows,
    ).toEqual([
      { kind: "skillmax", build: "1,3,2", games: 1 },
      { kind: "skillmax_incomplete", build: "0", games: 1 },
      { kind: "skills", build: "1,3,2", games: 1 },
      { kind: "skills_incomplete", build: "0", games: 1 },
    ]);
    const builds = (await championOverview(pool, { champion: "Ahri", role: "MIDDLE" }))!.builds!;
    expect(builds.skills[0]!.items.map((i) => [i.kind, i.id, i.name])).toEqual([
      ["skill", 1, "Q"],
      ["skill", 3, "E"],
      ["skill", 2, "W"],
    ]);
    expect(builds.skillmax[0]).toMatchObject({
      games: 1,
      winRate: { value: null, sampleCount: 1 },
    });
    expect(builds.excluded).toEqual({ skills: 1, skillmax: 1 });
  });
  it("buckets win rate by game length and by gold and level lead over the lane opponent", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
      (m.info as unknown as { gameDuration: number }).gameDuration = 1100;
    });
    // Sixteen one-minute frames; Ahri (1) and the red mid laner (6) differ at 10 and 15.
    const state = (minute: number, participantId: number) => {
      const special: Record<string, [number, number]> = {
        "10:1": [4000, 8],
        "10:6": [3200, 7],
        "15:1": [6000, 10],
        "15:6": [7600, 11],
      };
      const [totalGold, level] = special[`${minute}:${participantId}`] ?? [
        500 + minute * 300,
        1 + minute,
      ];
      return { participantId, totalGold, level, position: { x: 1000, y: 1000 } };
    };
    const timeline = {
      metadata: { matchId: "EUW1_1" },
      info: {
        frames: Array.from({ length: 16 }, (_, minute) => ({
          timestamp: minute * 60000,
          participantFrames: Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [String(i + 1), state(minute, i + 1)]),
          ),
          events: [],
        })),
      },
    };
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    expect(
      (
        await pool.query(
          "SELECT kind,bucket,games,result_games,wins FROM champion_buckets WHERE champion_key=103 ORDER BY kind,bucket",
        )
      ).rows,
    ).toEqual([
      { kind: "gold10", bucket: 3, games: 1, result_games: 1, wins: 1 },
      { kind: "gold15", bucket: 0, games: 1, result_games: 1, wins: 1 },
      // 18.3 minutes and 30.6 minutes.
      { kind: "length", bucket: 0, games: 1, result_games: 1, wins: 0 },
      { kind: "length", bucket: 3, games: 1, result_games: 1, wins: 1 },
      { kind: "level10", bucket: 3, games: 1, result_games: 1, wins: 1 },
      { kind: "level15", bucket: 1, games: 1, result_games: 1, wins: 1 },
    ]);
    // The red mid laner sees the mirror image.
    expect(
      (
        await pool.query(
          "SELECT kind,bucket FROM champion_buckets WHERE champion_key=157 AND kind<>'length' ORDER BY kind",
        )
      ).rows,
    ).toEqual([
      { kind: "gold10", bucket: 1 },
      { kind: "gold15", bucket: 4 },
      { kind: "level10", bucket: 1 },
      { kind: "level15", bucket: 3 },
    ]);
    const buckets = (await championOverview(pool, { champion: "Ahri", role: "MIDDLE" }))!.buckets!;
    expect(buckets.length.map((b) => b.games)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(buckets.length[1]).toEqual({
      index: 1,
      label: "20–25 min",
      games: 0,
      winRate: { value: null, sampleCount: 0 },
    });
    // One game is below the minimum sample: a count but no rate.
    expect(buckets.gold10[3]).toMatchObject({
      label: "Ahead 500–1,500",
      games: 1,
      winRate: { value: null, sampleCount: 1 },
    });
    expect((await championOverview(pool, { champion: "Ahri", source: "pro" }))!.buckets).toBeNull();
  });
  it("counts teammate pairs, scores synergies against expectations and builds the bot-lane matrix", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    // Blue side: Ahri, Lee Sin, Garen, Jinx, Thresh; red side: Yasuo, Kha'Zix, Darius, Jhin, Leona.
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger, (m) => {
      m.info.participants[0]!.win = false;
    });
    await ingest("EUW1_3", challenger, (m) => {
      m.info.participants[2]!.win = false;
    });
    await runAggregate();
    const pair = async (a: number, b: number) =>
      (
        await pool.query<Record<string, unknown>>(
          "SELECT role,ally_role,games,result_games,wins FROM champion_duos WHERE champion_key=$1 AND ally_key=$2",
          [a, b],
        )
      ).rows;
    // Each pair is stored from both sides, with each side's own result.
    expect(await pair(103, 412)).toEqual([
      { role: "MIDDLE", ally_role: "UTILITY", games: 3, result_games: 3, wins: 2 },
    ]);
    expect(await pair(412, 103)).toEqual([
      { role: "UTILITY", ally_role: "MIDDLE", games: 3, result_games: 3, wins: 3 },
    ]);
    expect(await pair(103, 157)).toEqual([]);
    expect((await pool.query("SELECT count(*)::integer n FROM champion_duos")).rows[0]).toEqual({
      n: 40,
    });

    // Garen lost one of his games, so the Ahri and Garen pair is expected to win less: the
    // highest (least negative) delta. Small samples keep the shown values unknown.
    const byDelta = await championSynergies(pool, {
      championKey: 103,
      patch: "16.22",
      role: "MIDDLE",
      sort: "delta",
      page: 1,
    });
    expect(byDelta.page.total).toBe(4);
    expect(byDelta.page.items[0]).toMatchObject({
      allyKey: 86,
      allyRole: "TOP",
      games: 3,
      winRate: { value: null, sampleCount: 3 },
      delta: { value: null, sampleCount: 3 },
    });
    expect(byDelta.page.items[0]!.expected).toBeCloseTo(2 / 3 + 2 / 3 - 0.5);
    expect(byDelta.page.items.find((r) => r.allyKey === 222)!.expected).toBe(1);
    expect(
      (
        await championSynergies(pool, {
          championKey: 103,
          patch: "16.22",
          role: "MIDDLE",
          sort: "games",
          page: 2,
        })
      ).page,
    ).toMatchObject({ items: [], total: 0, page: 2 });

    const matrix = await botLaneMatrix(pool, { patch: "16.22" });
    expect(matrix.carries.map((c) => c.key)).toEqual([202, 222]);
    expect(matrix.supports.map((c) => c.key)).toEqual([89, 412]);
    expect(matrix.cells).toEqual([
      { carry: 202, support: 89, games: 3, winRate: { value: null, sampleCount: 3 } },
      { carry: 222, support: 412, games: 3, winRate: { value: null, sampleCount: 3 } },
    ]);
    const overview = (await championOverview(pool, {
      champion: "Ahri",
      role: "MIDDLE",
      synergySort: "winRate",
    }))!;
    expect(overview.synergies!.sort).toBe("winRate");
    expect(overview.botLane!.cells).toHaveLength(2);
    expect(
      (await championOverview(pool, { champion: "Ahri", source: "pro" }))!.synergies,
    ).toBeNull();
  });
  it("aggregates pro draft use per champion and league, reporting unmapped names", async () => {
    serveDataDragon(["16.4.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    // Ahri is red's mid in every fixture draft, picked before blue's mid; red loses.
    await importCsv(draftCsv({ id: "draft-1", league: "LCK" }));
    await importCsv(draftCsv({ id: "draft-2", league: "LCK", unknownResult: true }), 2026);
    await importCsv(draftCsv({ id: "draft-3", league: "LEC", firstSide: "red" }), 2026);
    const rows = (
      await pool.query(
        `SELECT league,league_games,picks,bans,result_picks,wins,red_picks,blue_picks,blind_picks,
           counter_picks FROM pro_champion_stats WHERE champion_key=103 ORDER BY league`,
      )
    ).rows;
    expect(rows).toEqual([
      {
        league: "LCK",
        league_games: 2,
        picks: 2,
        bans: 0,
        result_picks: 1,
        wins: 0,
        red_picks: 2,
        blue_picks: 0,
        blind_picks: 2,
        counter_picks: 0,
      },
      {
        league: "LEC",
        league_games: 1,
        picks: 1,
        bans: 0,
        result_picks: 1,
        wins: 0,
        red_picks: 1,
        blue_picks: 0,
        blind_picks: 1,
        counter_picks: 0,
      },
    ]);
    const all = await proChampionStats(pool, { championKey: 103 });
    expect(all).toMatchObject({
      patch: "16.4",
      leagues: ["LCK", "LEC"],
      games: 3,
      picks: 3,
      presence: { value: 1, sampleCount: 3 },
      banRate: { value: 0, sampleCount: 3 },
      winRate: { value: 0, sampleCount: 2 },
      sides: [
        { side: "blue", picks: 0, winRate: { value: null, sampleCount: 0 } },
        { side: "red", picks: 3, winRate: { value: 0, sampleCount: 2 } },
      ],
      blindRate: { value: 1, sampleCount: 3 },
      counterRate: { value: 0, sampleCount: 3 },
    });
    // Names the catalog does not map are reported with their counts, never matched loosely.
    expect(all.unmapped).toContainEqual({ name: "Nautilus", picks: 3, bans: 0 });
    expect(all.unmapped).toContainEqual({ name: "Kalista", picks: 0, bans: 3 });
    expect(all.unmapped.map((u) => u.name)).not.toContain("Ahri");
    expect((await proChampionStats(pool, { championKey: 103, league: "LEC" })).games).toBe(1);
    // A champion with no pro games has counts of zero and unknown rates.
    expect(await proChampionStats(pool, { championKey: 62 })).toMatchObject({
      games: 3,
      picks: 0,
      presence: { value: 0, sampleCount: 3 },
      winRate: { value: null, sampleCount: 0 },
      blindRate: { value: null, sampleCount: 0 },
    });
    expect((await championOverview(pool, { champion: "Ahri", league: "LCK" }))!.pro).toMatchObject({
      league: "LCK",
      games: 2,
    });
    expect(await proChampionStats(pool, { championKey: 103, patch: "16.22" })).toMatchObject({
      games: 0,
      presence: { value: null, sampleCount: 0 },
    });
  });
  it("stores versioned win probability features reproducible from frames and events", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: { frames: { participantFrames: Record<string, unknown> }[] };
    };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    const stored = async () =>
      (
        await pool.query<Record<string, unknown>>(
          `SELECT minute,version,gold_diff,xp_diff,cs_diff,blue_kills,red_kills,red_towers,
             blue_dragons->>'FIRE_DRAGON' AS blue_fire,blue_soul,blue_win
           FROM riot_wp_features WHERE match_id='EUW1_1' ORDER BY minute`,
        )
      ).rows;
    expect(await stored()).toEqual([
      {
        minute: 0,
        version: 1,
        gold_diff: 0,
        xp_diff: 0,
        cs_diff: 0,
        blue_kills: 0,
        red_kills: 0,
        red_towers: 0,
        blue_fire: "0",
        blue_soul: false,
        blue_win: true,
      },
      {
        minute: 1,
        version: 1,
        gold_diff: 0,
        xp_diff: 0,
        cs_diff: 0,
        blue_kills: 0,
        red_kills: 0,
        red_towers: 0,
        blue_fire: "0",
        blue_soul: false,
        blue_win: true,
      },
      {
        minute: 2,
        version: 1,
        gold_diff: 0,
        xp_diff: 0,
        cs_diff: 0,
        blue_kills: 1,
        red_kills: 0,
        red_towers: 0,
        blue_fire: "1",
        blue_soul: false,
        blue_win: true,
      },
    ]);
    // Reproducible from the stored facts; a full rerun computes nothing twice.
    expect((await matchFeatures(pool, "EUW1_1"))[2]).toMatchObject({ blue: { kills: 1 } });
    await runAggregate(true);
    expect(await stored()).toHaveLength(3);

    // A replaced timeline with a missing frame recomputes, leaving that minute's differences null.
    delete timeline.info.frames[1]!.participantFrames["7"];
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    expect((await stored())[1]).toMatchObject({
      minute: 1,
      gold_diff: null,
      xp_diff: null,
      cs_diff: null,
    });
  });
  it("trains, stores and activates win probability models, keeping the active one on a small sample", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    const ids = Array.from({ length: 20 }, (_, i) => `EUW1_${100 + i}`);
    for (const id of ids) await ingest(id, challenger);
    // Synthetic stored features: blue wins exactly the games where it leads in gold.
    await pool.query(
      `INSERT INTO riot_wp_features(match_id,version,minute,timestamp_ms,gold_diff,xp_diff,cs_diff,
         blue_kills,red_kills,blue_towers,red_towers,blue_inhibitors,red_inhibitors,blue_barons,
         red_barons,blue_elders,red_elders,blue_dragons,red_dragons,blue_soul,red_soul,blue_win,
         computed_at)
       SELECT m.id,1,minute,minute*60000,lead*minute,0,0,0,0,0,0,0,0,0,0,0,0,'{}','{}',false,false,
         lead>0,$2
       FROM unnest($1::text[]) WITH ORDINALITY AS m(id,n)
       CROSS JOIN LATERAL (SELECT CASE WHEN n%2=0 THEN 400 ELSE -400 END AS lead) l
       CROSS JOIN generate_series(1,10) minute`,
      [ids, now],
    );
    const trainer = (minimumMatches: number) =>
      createSync(connection, {
        clock: () => instant,
        fetch: fetcher,
        winProbability: { minimumMatches, seed: 11 },
      });
    const first = trainer(10);
    try {
      await first.request({ kind: "wp-train" });
      expect(await first.runNext()).toMatchObject({ state: "done", records: 1 });
    } finally {
      await first.close();
    }
    const active = (await activeWinProbabilityModel(pool))!;
    expect(active).toMatchObject({
      modelVersion: 1,
      featureVersion: 1,
      patchWindow: ["16.22"],
      seed: 11,
      trainMatches: 16,
      trainRows: 160,
      evalMatches: 4,
      evalRows: 40,
      status: "active",
    });
    expect(active.coefficients.features[1]).toBe("goldDiff");
    expect(active.coefficients.weights[1]).toBeGreaterThan(0);
    expect(active.brier).toBeLessThan(0.25);
    expect(active.bins).toHaveLength(10);

    // Too small a sample: stored as rejected; the previous model stays active.
    instant = new Date(now.valueOf() + 86400000);
    const strict = trainer(100);
    try {
      await strict.request({ kind: "wp-train" });
      expect(await strict.runNext()).toMatchObject({ state: "done", records: 0 });
    } finally {
      await strict.close();
    }
    const [rejected, kept] = await winProbabilityModels(pool);
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("16 training matches") as string,
    });
    expect(kept!.id).toBe(active.id);
    expect((await activeWinProbabilityModel(pool))!.id).toBe(active.id);
    // The same seed and data reproduce the same coefficients.
    expect(rejected!.coefficients).toEqual(active.coefficients);
  });
  /** Stored matches with synthetic features: blue wins exactly the games where it leads in gold. */
  async function trainingGames(ids: string[]) {
    for (const id of ids) await ingest(id, challenger);
    await pool.query(
      `INSERT INTO riot_wp_features(match_id,version,minute,timestamp_ms,gold_diff,xp_diff,cs_diff,
         blue_kills,red_kills,blue_towers,red_towers,blue_inhibitors,red_inhibitors,blue_barons,
         red_barons,blue_elders,red_elders,blue_dragons,red_dragons,blue_soul,red_soul,blue_win,
         computed_at)
       SELECT m.id,1,minute,minute*60000,lead*minute,0,0,0,0,0,0,0,0,0,0,0,0,'{}','{}',false,false,
         lead>0,$2
       FROM unnest($1::text[]) WITH ORDINALITY AS m(id,n)
       CROSS JOIN LATERAL (SELECT CASE WHEN n%2=0 THEN 400 ELSE -400 END AS lead) l
       CROSS JOIN generate_series(1,10) minute`,
      [ids, now],
    );
  }
  const games = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => `EUW1_${from + i}`);
  it("trains the first model as soon as the stored sample reaches the minimum", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    const worker = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      winProbability: { minimumMatches: 16, seed: 11 },
    });
    const queued = async () =>
      Number(
        (
          await pool.query<{ n: string }>(
            "SELECT count(*) AS n FROM sync_jobs WHERE request->>'kind'='wp-train' AND state='queued'",
          )
        ).rows[0]!.n,
      );
    const aggregateJob = async () => {
      await worker.request({ kind: "aggregate" });
      expect((await worker.runNext()).state).toBe("done");
    };
    try {
      // 15 games leave 12 training matches after the holdout: not enough yet.
      await trainingGames(games(200, 15));
      await aggregateJob();
      expect(await queued()).toBe(0);
      // 20 games leave exactly 16: the aggregate run queues training.
      await trainingGames(games(300, 5));
      await aggregateJob();
      expect(await queued()).toBe(1);
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 1 });
      expect((await activeWinProbabilityModel(pool))!.trainMatches).toBe(16);
      // With an active model, later runs leave training to the daily schedule.
      await aggregateJob();
      expect(await queued()).toBe(0);
    } finally {
      await worker.close();
    }
    // A rejected attempt is not repeated until the sample grows.
    await pool.query("UPDATE wp_models SET status='rejected'");
    expect(await firstTrainingDue(pool, 16)).toBe(false);
    await trainingGames(games(400, 1));
    expect(await firstTrainingDue(pool, 16)).toBe(true);
    expect(await firstTrainingDue(pool, 18)).toBe(false);
  });
  it("trains on demand and reports each model published or rejected", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await trainingGames(games(500, 20));
    const command = async (minimumMatches: number) => {
      const worker = createSync(connection, {
        clock: () => instant,
        fetch: fetcher,
        winProbability: { minimumMatches, seed: 11 },
      });
      const lines: string[] = [];
      try {
        const done = await trainOnDemand(worker, queries, (line) => lines.push(line));
        return { done, lines };
      } finally {
        await worker.close();
      }
    };
    const published = await command(10);
    expect(published.done).toBe(true);
    expect(published.lines[0]).toMatch(/^Queued wp-train job \d+\.$/);
    expect(published.lines[1]).toMatch(
      /^Solo queue model #1 published: 16 training games \(160 states\), Brier score 0\.\d{3}\.$/,
    );
    expect(published.lines[2]).toBe(
      "Pro checkpoint model #2 rejected: Only 0 training games; at least 200 are needed. There is no active model yet.",
    );
    const rejected = await command(100);
    expect(rejected.lines[1]).toBe(
      "Solo queue model #3 rejected: Only 16 training matches; at least 100 are needed. The active model stays #1.",
    );
    expect((await activeWinProbabilityModel(pool))!.id).toBe(1);
    // A busy queue reports that a running worker will train instead.
    const lock = await pool.connect();
    try {
      await lock.query("SELECT pg_advisory_lock(9183275)");
      const busy = await command(10);
      expect(busy).toEqual({
        done: false,
        lines: [
          expect.stringMatching(/^Queued wp-train job/) as string,
          "Another worker is running; it will train the model when it reaches the job.",
        ],
      });
    } finally {
      await lock.query("SELECT pg_advisory_unlock(9183275)");
      lock.release();
    }
  });
  it("scores a solo game's win probability per minute with the active model, with gaps and markers", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    const before = (await queries.soloGame("EUW1_1"))!;
    expect(before.winProbability).toMatchObject({ model: null, points: [] });
    expect(before.winProbability.reason).toMatch(/No win probability model is active/);
    expect(before.participants[0]).toMatchObject({
      championKey: 103,
      championId: "Ahri",
      championName: "Ahri",
      side: "blue",
    });

    await trainWinProbabilityModel(pool, now, { minimumMatches: 1, seed: 3 });
    const game = (await soloGame(pool, "EUW1_1"))!;
    expect(game.winProbability.model).toMatchObject({ modelVersion: 1, featureVersion: 1 });
    expect(game.winProbability.reason).toBeNull();
    // The 30-minute game has stored features for minutes 0-2 only: the rest are gaps.
    expect(game.winProbability.points).toHaveLength(31);
    const scored = game.winProbability.points.filter((p) => p.blueWinProbability !== null);
    expect(scored.map((p) => p.minute)).toEqual([0, 1, 2]);
    expect(scored.every((p) => p.blueWinProbability! > 0 && p.blueWinProbability! < 1)).toBe(true);
    expect(game.winProbability.markers.map((m) => [m.minute, m.team, m.kind, m.label])).toEqual([
      [1, "blue", "kill", "Blue kill"],
      [1, "blue", "dragon", "Blue: Fire Dragon"],
      [2, "blue", "tower", "Blue takes a tower"],
    ]);
    // Without a timeline there is nothing to score, and the page is told why.
    expect((await soloGame(pool, "EUW1_2"))!.winProbability.reason).toMatch(
      /timeline has not been stored/,
    );
    expect(await soloGame(pool, "EUW1_999")).toBeNull();
    await expect(soloGame(pool, "not a match")).rejects.toThrow();
  });
  it("reads one game's per-minute positions with gaps for missing frames, bounded in minutes", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    // Participant 2 lacks the minute 1 frame; participant 3's minute 2 frame has no coordinates.
    await pool.query(
      "DELETE FROM riot_timeline_frames WHERE match_id='EUW1_1' AND participant_id=2 AND minute=1",
    );
    await pool.query(
      "UPDATE riot_timeline_frames SET x=NULL,y=NULL WHERE match_id='EUW1_1' AND participant_id=3 AND minute=2",
    );
    const game = (await queries.soloGamePositions("EUW1_1"))!;
    expect(game).toMatchObject({ matchId: "EUW1_1", timelineState: "fetched", truncated: false });
    expect(game.tracks.map((t) => t.participantId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(game.tracks[0]!.frames).toEqual([
      { minute: 0, timestampMs: 0, x: 600, y: 500 },
      { minute: 1, timestampMs: 60022, x: 610, y: 500 },
      { minute: 2, timestampMs: 120022, x: 620, y: 500 },
    ]);
    expect(game.tracks[1]!.frames[1]).toEqual({ minute: 1, timestampMs: null, x: null, y: null });
    expect(game.tracks[2]!.frames[2]).toEqual({ minute: 2, timestampMs: 120022, x: null, y: null });
    // Frames past the minute limit are not read, and the result says so.
    await pool.query(
      `INSERT INTO riot_timeline_frames(match_id,participant_id,minute,timestamp_ms,x,y)
       VALUES ('EUW1_1',1,$1,$2,100,100)`,
      [timelineMinuteLimit + 1, (timelineMinuteLimit + 1) * 60000],
    );
    const bounded = (await soloGamePositions(pool, "EUW1_1"))!;
    expect(bounded.truncated).toBe(true);
    expect(bounded.tracks.every((t) => t.frames.length === 3)).toBe(true);
    // A game without a stored timeline has participants but no frames.
    const pending = (await soloGamePositions(pool, "EUW1_2"))!;
    expect(pending.timelineState).toBe("pending");
    expect(pending.tracks).toHaveLength(10);
    expect(pending.tracks.every((t) => t.frames.length === 0)).toBe(true);
    expect(await soloGamePositions(pool, "EUW1_999")).toBeNull();
    await expect(soloGamePositions(pool, "not a match")).rejects.toThrow();
  });
  it("reads one game's kills, objectives and wards for the map, keeping missing coordinates null", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    await ingest("EUW1_2", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    const game = (await queries.soloGameMapEvents("EUW1_1"))!;
    expect(game.truncated).toBe(false);
    expect(
      game.events.map((e) => [e.kind, e.timestampMs, e.side, e.participantId, e.x, e.y, e.label]),
    ).toEqual([
      ["ward", 65000, "blue", 5, null, null, "Ward placed (Yellow Trinket)"],
      ["kill", 98000, "blue", 2, 7200, 7100, "Champion kill"],
      ["objective", 110000, "blue", 2, 9866, 4414, "Fire Dragon"],
      ["objective", 125000, "blue", null, 8955, 8510, "Tower destroyed (Mid Lane)"],
    ]);
    expect(game.events[1]!.victimId).toBe(7);
    // An execution has no champion killer: the side is the victim's opponent.
    await pool.query(
      `INSERT INTO riot_timeline_events(match_id,seq,type,timestamp_ms,victim_id,x,y)
       VALUES ('EUW1_1',100,'CHAMPION_KILL',129000,7,NULL,NULL)`,
    );
    expect((await soloGameMapEvents(pool, "EUW1_1"))!.events.at(-1)).toMatchObject({
      kind: "kill",
      side: "blue",
      participantId: null,
      x: null,
    });
    // Reads are bounded per game, and the result says when events were left out.
    await pool.query(
      `INSERT INTO riot_timeline_events(match_id,seq,type,timestamp_ms,participant_id,ward_type)
       SELECT 'EUW1_1',1000+n,'WARD_PLACED',130000,6,'CONTROL_WARD' FROM generate_series(1,$1) n`,
      [mapEventLimit],
    );
    const bounded = (await soloGameMapEvents(pool, "EUW1_1"))!;
    expect(bounded.truncated).toBe(true);
    expect(bounded.events).toHaveLength(mapEventLimit);
    expect(bounded.events.at(-1)).toMatchObject({
      side: "red",
      label: "Ward placed (Control Ward)",
    });
    expect(await soloGameMapEvents(pool, "EUW1_2")).toEqual({ events: [], truncated: false });
    expect(await soloGameMapEvents(pool, "EUW1_999")).toBeNull();
    await expect(soloGameMapEvents(pool, "not a match")).rejects.toThrow();
  });
  it("stores win probability added per event and participant for each model", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    // Training publishes a model and scores the stored games with it.
    const trainer = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      winProbability: { minimumMatches: 1, seed: 5 },
    });
    try {
      await trainer.request({ kind: "wp-train" });
      expect((await trainer.runNext()).state).toBe("done");
    } finally {
      await trainer.close();
    }
    const first = (await activeWinProbabilityModel(pool))!;
    const scored = await matchWpa(pool, "EUW1_1", first.id);
    expect(scored.events.map((e) => [e.type, e.team])).toEqual([
      ["CHAMPION_KILL", "blue"],
      ["ELITE_MONSTER_KILL", "blue"],
      ["BUILDING_KILL", "blue"],
    ]);
    const kill = scored.events[0]!;
    expect(kill.delta).not.toBeNull();
    expect(kill.participants.map((p) => [p.participantId, p.role])).toEqual([
      [7, "victim"],
      [2, "killer"],
      [1, "assister"],
      [4, "assister"],
    ]);
    expect(kill.participants.find((p) => p.role === "victim")!.value).toBeCloseTo(-kill.delta!);
    // The tower was taken by minions: a team value and the assister's share, no taker.
    expect(scored.events[2]!.participants.map((p) => p.role)).toEqual(["assister"]);

    // Rescoring with the same model replaces its rows; a new model keeps the old model's values.
    await scoreMatchWpa(pool, "EUW1_1", first, now);
    expect((await matchWpa(pool, "EUW1_1", first.id)).events).toEqual(scored.events);
    instant = new Date(now.valueOf() + 86400000);
    await trainWinProbabilityModel(pool, instant, { minimumMatches: 1, seed: 6 });
    const second = (await activeWinProbabilityModel(pool))!;
    await runAggregate();
    expect((await matchWpa(pool, "EUW1_1", second.id)).events).toHaveLength(3);
    expect((await matchWpa(pool, "EUW1_1", first.id)).events).toHaveLength(3);
    expect(
      (
        await pool.query<{ n: number }>(
          "SELECT count(DISTINCT model_id)::integer n FROM riot_wpa_events",
        )
      ).rows[0]!.n,
    ).toBe(2);
  });
  it("aggregates win probability added per champion, player and role into leaderboards", async () => {
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    const timeline = JSON.parse(
      readFileSync(new URL("../../tests/riot/timeline-euw1.json", import.meta.url), "utf8"),
    ) as { metadata: { matchId: string } };
    timeline.metadata.matchId = "EUW1_1";
    await saveTimeline(pool, parseRiotTimeline(timeline, "EUW1_1"), now);
    await runAggregate();
    expect((await wpaLeaderboard(pool)).model).toBeNull();
    await trainWinProbabilityModel(pool, now, { minimumMatches: 1, seed: 5 });
    await runAggregate();
    const model = (await activeWinProbabilityModel(pool))!;
    const scored = await matchWpa(pool, "EUW1_1", model.id);
    const share = (participantId: number) =>
      scored.events
        .flatMap((e) => e.participants)
        .filter((p) => p.participantId === participantId)
        .reduce((n, p) => n + p.value, 0);
    const rows = async (kind: string) =>
      (
        await pool.query<{ subject: string; games: number; total: number }>(
          "SELECT subject,games,total FROM wpa_aggregates WHERE model_id=$1 AND kind=$2 ORDER BY subject",
          [model.id, kind],
        )
      ).rows;
    // Every participant counts a game, with zero when they had no share.
    expect(await rows("champion")).toHaveLength(10);
    const ahri = (await rows("champion")).find((r) => r.subject === "103")!;
    expect(ahri.games).toBe(1);
    expect(ahri.total).toBeCloseTo(share(1));
    expect((await rows("champion")).find((r) => r.subject === "86")!.total).toBe(0);
    expect((await rows("role")).map((r) => [r.subject, r.games])).toEqual([
      ["BOTTOM", 2],
      ["JUNGLE", 2],
      ["MIDDLE", 2],
      ["TOP", 2],
      ["UTILITY", 2],
    ]);
    expect((await rows("player")).find((r) => r.subject === "a".repeat(78))!.total).toBeCloseTo(
      share(1),
    );
    // One game is below the minimum sample: counts show, values do not.
    const board = await wpaLeaderboard(pool, { kind: "champion" });
    expect(board).toMatchObject({
      patch: "16.22",
      patches: ["16.22"],
      model: { id: model.id, modelVersion: 1 },
    });
    expect(board.page.items.find((r) => r.subject === "103")).toMatchObject({
      name: "Ahri",
      championId: "Ahri",
      games: 1,
      perGame: { value: null, sampleCount: 1 },
    });

    // Larger synthetic samples check sorting, names and pages in SQL, in percentage points.
    await pool.query("DELETE FROM wpa_aggregates WHERE model_id=$1 AND kind='player'", [model.id]);
    await pool.query(
      `INSERT INTO wpa_aggregates(model_id,patch_key,kind,subject,games,total,built_at) VALUES
       ($1,'16.22','player','p1',100,1.0,$2),($1,'16.22','player','p2',20,0.6,$2),($1,'16.22','player','p3',60,-0.3,$2)`,
      [model.id, now],
    );
    await pool.query(
      "INSERT INTO riot_accounts(puuid,game_name,tag_line,first_seen_at,seen_at,checked_at) VALUES('p1','Top Laner','NA1',$1,$1,$1)",
      [now],
    );
    const perGame = await wpaLeaderboard(pool, { kind: "player" });
    expect(perGame.page.items.map((r) => [r.subject, r.name])).toEqual([
      ["p2", null],
      ["p1", "Top Laner#NA1"],
      ["p3", null],
    ]);
    expect(perGame.page.items[0]!.perGame.value).toBeCloseTo(3);
    expect(perGame.page.items[0]!.total.value).toBeCloseTo(60);
    expect(
      (await wpaLeaderboard(pool, { kind: "player", sort: "total" })).page.items[0]!.subject,
    ).toBe("p1");
    expect(
      (await wpaLeaderboard(pool, { kind: "player", sort: "games" })).page.items.map(
        (r) => r.subject,
      ),
    ).toEqual(["p1", "p3", "p2"]);
    expect((await wpaLeaderboard(pool, { kind: "player", page: 2 })).page).toMatchObject({
      items: [],
      total: 0,
    });
    // Only the active model is read: a newer model without aggregates yet shows nothing.
    await trainWinProbabilityModel(pool, new Date(now.valueOf() + 1000), {
      minimumMatches: 1,
      seed: 9,
    });
    expect((await wpaLeaderboard(pool, { kind: "player" })).page.total).toBe(0);
    await expect(wpaLeaderboard(pool, { kind: "team" as "role" })).rejects.toThrow();
  });
  it("trains a separate pro checkpoint model and scores a pro game's four checkpoints", async () => {
    const ids = ["g1", "g2", "g3", "g4", "g5", "g6"];
    for (const id of ids) await importCsv(historyCsv({ id }));
    // Checkpoints on each blue team row: blue leads and wins the odd games, trails and loses the rest.
    for (const [n, id] of ids.entries()) {
      const lead = n % 2 === 0 ? 1500 : -1500;
      const statistics = Object.fromEntries(
        [10, 15, 20, 25].flatMap((m) => [
          [`golddiffat${m}`, (lead * m) / 10],
          [`xpdiffat${m}`, lead / 2],
          [`csdiffat${m}`, lead / 100],
          [`killsat${m}`, lead > 0 ? 4 : 2],
          [`opp_killsat${m}`, lead > 0 ? 2 : 4],
        ]),
      );
      if (id === "g6") delete statistics.golddiffat25;
      await pool.query(
        `UPDATE oracle_archive_participants SET statistics=statistics||$2::jsonb,result=$3
         WHERE game_id=(SELECT id FROM oracle_archive_games WHERE source_game_id=$1)
           AND position='team' AND side='blue'`,
        [id, JSON.stringify(statistics), lead > 0],
      );
    }
    expect((await proGameWinProbability(pool, "oracle:game:g1")).reason).toMatch(
      /No pro win probability model/,
    );
    await trainCheckpointModel(pool, now, { minimumGames: 2, seed: 4 });
    const model = (await activeWinProbabilityModel(pool, "pro-checkpoints"))!;
    expect(model).toMatchObject({
      kind: "pro-checkpoints",
      patchWindow: ["2026"],
      status: "active",
    });
    expect(model.coefficients.features).toEqual([
      "minute",
      "goldDiff",
      "xpDiff",
      "csDiff",
      "killDiff",
      "goldDiffByMinute",
    ]);
    // The timeline model is a separate kind and is untouched.
    expect(await activeWinProbabilityModel(pool)).toBeNull();
    const ahead = await proGameWinProbability(pool, "oracle:game:g1");
    expect(ahead.model).toMatchObject({ id: model.id, years: ["2026"] });
    expect(ahead.points.map((p) => p.minute)).toEqual([10, 15, 20, 25]);
    expect(ahead.points.every((p) => p.blueWinProbability! > 0.5)).toBe(true);
    expect(
      (await proGameWinProbability(pool, "oracle:game:g2")).points[0]!.blueWinProbability,
    ).toBeLessThan(0.5);
    // A missing checkpoint is a gap.
    expect((await queries.proGameWinProbability("oracle:game:g6")).points[3]).toEqual({
      minute: 25,
      blueWinProbability: null,
    });
    // A game without checkpoints gets no chart.
    await importCsv(historyCsv({ id: "plain" }));
    expect(await proGameWinProbability(pool, "oracle:game:plain")).toMatchObject({
      points: [],
      reason: expect.stringContaining("no checkpoint data") as string,
    });
    // Too few games: stored as rejected, the active checkpoint model stays.
    await trainCheckpointModel(pool, now, { minimumGames: 100, seed: 4 });
    expect((await activeWinProbabilityModel(pool, "pro-checkpoints"))!.id).toBe(model.id);
  });
  it("lists stored models of both kinds with calibration and named feature weights", async () => {
    expect(await modelDiagnostics(pool)).toEqual({ models: [], selected: null });
    const bins = Array.from({ length: 10 }, (_, i) => ({
      lower: i / 10,
      upper: (i + 1) / 10,
      count: i === 7 ? 40 : 0,
      predicted: i === 7 ? 0.74 : null,
      observed: i === 7 ? 0.7 : null,
    }));
    const insert = (kind: string, status: string, window: string[], features: string[]) =>
      pool.query(
        `INSERT INTO wp_models(kind,model_version,feature_version,patch_window,seed,train_matches,train_rows,
           eval_matches,eval_rows,coefficients,brier,bins,status,reason,trained_at)
         VALUES($1,1,1,$2,7,800,24000,200,6000,$3,0.181,$4,$5,$6,$7)`,
        [
          kind,
          window,
          JSON.stringify({ intercept: 0.02, weights: features.map((_, i) => i / 10), features }),
          JSON.stringify(bins),
          status,
          status === "rejected" ? "Only 12 training matches; at least 500 are needed." : null,
          now,
        ],
      );
    await insert("timeline", "retired", ["16.21"], ["minute", "goldDiff"]);
    await insert("timeline", "active", ["16.22", "16.21"], ["minute", "goldDiff", "dragonDiff"]);
    await insert("pro-checkpoints", "active", ["2025", "2026"], ["minute", "killDiff"]);
    await insert("timeline", "rejected", ["16.22"], ["minute"]);
    const diagnostics = await queries.modelDiagnostics();
    expect(diagnostics.models.map((m) => [m.id, m.kind, m.status])).toEqual([
      [4, "timeline", "rejected"],
      [3, "pro-checkpoints", "active"],
      [2, "timeline", "active"],
      [1, "timeline", "retired"],
    ]);
    expect(diagnostics.models[0]!.reason).toMatch(/12 training matches/);
    // The active timeline model is shown by default, with plain feature names and its bins.
    expect(diagnostics.selected).toMatchObject({
      id: 2,
      window: ["16.22", "16.21"],
      trainMatches: 800,
      evalMatches: 200,
      brier: 0.181,
      intercept: 0.02,
      weights: [
        { feature: "minute", label: "Game time (per 30 minutes)", weight: 0 },
        { feature: "goldDiff", label: "Gold difference (per 5,000)", weight: 0.1 },
        { feature: "dragonDiff", label: "Dragon difference (per 4)", weight: 0.2 },
      ],
    });
    expect(diagnostics.selected!.bins[7]).toEqual({
      lower: 0.7,
      upper: 0.8,
      count: 40,
      predicted: 0.74,
      observed: 0.7,
    });
    expect((await modelDiagnostics(pool, 3)).selected).toMatchObject({
      kind: "pro-checkpoints",
      window: ["2025", "2026"],
    });
    expect((await modelDiagnostics(pool, 99)).selected).toBeNull();
  });
  it("builds pro aggregates separately, rebuilds only affected patches and reruns from stored facts", async () => {
    serveDataDragon(["16.4.1", "16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await importCsv();
    await runAggregate();
    // The fixture game: Ahri in all ten positions, blue side wins.
    expect(
      await aggregates("source='pro' AND champion_key=103 AND role IN ('ALL','MIDDLE')"),
    ).toEqual([
      {
        tier: "PRO",
        role: "ALL",
        games: 10,
        result_games: 10,
        wins: 5,
        bans: 0,
        slice_games: 1,
        win_rate: 0.5,
        pick_rate: 10,
        ban_rate: 0,
      },
      {
        tier: "PRO",
        role: "MIDDLE",
        games: 2,
        result_games: 2,
        wins: 1,
        bans: null,
        slice_games: 1,
        win_rate: 0.5,
        pick_rate: 2,
        ban_rate: null,
      },
    ]);
    const proBuilt = (
      await pool.query("SELECT DISTINCT built_at FROM champion_aggregates WHERE source='pro'")
    ).rows;

    // A new solo match marks only its own patch.
    instant = new Date(now.valueOf() + 3600000);
    await saveLadder(pool, "euw1", [ladderEntry(challenger, "CHALLENGER")], now);
    await ingest("EUW1_1", challenger);
    expect((await pool.query("SELECT source,patch_key FROM aggregate_dirty")).rows).toEqual([
      { source: "solo", patch_key: "16.22" },
    ]);
    await runAggregate();
    expect(
      (await pool.query("SELECT DISTINCT built_at FROM champion_aggregates WHERE source='pro'"))
        .rows,
    ).toEqual(proBuilt);
    const solo = await championStats(pool, { source: "solo" });
    const pro = await championStats(pool, {
      source: "pro",
      region: "LCK",
      tier: "PRO",
      queue: "pro",
    });
    expect([solo.patch, pro.patch]).toEqual(["16.22", "16.4"]);

    // A full rerun from stored facts reproduces the same numbers.
    const before = await aggregates("true");
    await pool.query("DELETE FROM champion_aggregates");
    await runAggregate(true);
    expect(await aggregates("true")).toEqual(before);
  });
});
describe("Riot API key", () => {
  const key = "RGAPI-01234567-89ab-cdef-0123-456789abcdef";
  const riotSync = (riot?: { key: string; kind: "development" | "production" }) =>
    createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      ...(riot ? { riot } : {}),
    });
  const riotKey = async () => (await queries.status()).riotKey;
  it("skips Riot jobs with a clear status when no key is configured, leaving other sources alone", async () => {
    const worker = riotSync();
    try {
      await worker.request({ kind: "riot-key" });
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 0 });
      expect(fetcher).not.toHaveBeenCalled();
      expect(await riotKey()).toMatchObject({
        state: "missing",
        detail: "RIOT_API_KEY is not configured; Riot jobs are skipped.",
        expiresAt: null,
      });
      expect((await queries.status()).sources.every((s) => s.lastAttempt === null)).toBe(true);
    } finally {
      await worker.close();
    }
  });
  it("checks a new key once, records the result and dates the development key reminder", async () => {
    const worker = riotSync({ key, kind: "development" });
    try {
      fetcher.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      expect(await worker.runNext()).toMatchObject({ state: "done", records: 1 });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(endpoint(url)).toBe("https://na1.api.riotgames.com/lol/status/v4/platform-data");
      expect(init?.headers).toEqual({ "X-Riot-Token": key });
      expect((await pool.query("SELECT region,method FROM riot_request_ledger")).rows).toEqual([
        { region: "na1", method: "lol-status-v4.getPlatformData" },
      ]);
      expect(await riotKey()).toEqual({
        state: "valid",
        kind: "development",
        setAt: now.toISOString(),
        checkedAt: now.toISOString(),
        detail: null,
        expiresAt: new Date(now.valueOf() + 86400000).toISOString(),
      });
      const stored = await pool.query<{ row: string }>(
        "SELECT row_to_json(r)::text AS row FROM riot_key_status r",
      );
      expect(stored.rows[0]!.row).not.toContain(key);

      // A transient failure keeps the last result; a rejection is recorded with its time.
      instant = new Date(now.valueOf() + 3600000);
      fetcher.mockResolvedValueOnce(new Response("busy", { status: 503 }));
      await worker.request({ kind: "riot-key" });
      expect((await worker.runNext()).state).toBe("queued");
      expect(await riotKey()).toMatchObject({ state: "valid", checkedAt: now.toISOString() });
      instant = new Date(now.valueOf() + 30 * 3600000);
      fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 }));
      expect((await worker.runNext()).state).toBe("done");
      expect(await riotKey()).toMatchObject({
        state: "rejected",
        checkedAt: instant.toISOString(),
        detail: "Riot rejected the key (HTTP 401).",
      });
    } finally {
      await worker.close();
    }
    // Restarting with the same key keeps its set time; a new key restarts the reminder.
    const same = riotSync({ key, kind: "development" });
    try {
      expect((await same.runNext()).state).toBe("idle");
      expect(await riotKey()).toMatchObject({ state: "rejected", setAt: now.toISOString() });
    } finally {
      await same.close();
    }
    const replaced = riotSync({ key: key.replace("0123-4567", "0123-9999"), kind: "production" });
    try {
      fetcher.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      expect((await replaced.runNext()).state).toBe("done");
      expect(await riotKey()).toMatchObject({
        state: "valid",
        kind: "production",
        setAt: instant.toISOString(),
        expiresAt: null,
      });
    } finally {
      await replaced.close();
    }
  });
});
it("counts eligible team games even when team summary rows are missing, and counts champion games once", async () => {
  const csv = historyCsv()
    .split("\n")
    .filter((line) => !line.includes(",team,"))
    .join("\n");
  await importCsv(csv);
  const profile = await queries.profile("oracle:team:10");
  expect(profile?.summary).toEqual({
    eligibleGames: 1,
    resultGames: 0,
    wins: 0,
    winRate: null,
    kda: null,
    kdaGames: 0,
    champions: [{ name: "Ahri", games: 1, wins: 1, resultGames: 1 }],
  });
});
it("keeps a distinct correction upload queued behind another file for the same year", async () => {
  const first = await sync.request({ kind: "history", year: 2026, file: "/first.csv" });
  const second = await sync.request({ kind: "history", year: 2026, file: "/second.csv" });
  expect(first).not.toBe(second);
});
it("rolls back an entire correction if participant persistence fails", async () => {
  await importCsv();
  await pool.query(
    "CREATE FUNCTION reject_test_participant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_test_write BEFORE INSERT ON participants FOR EACH ROW EXECUTE FUNCTION reject_test_participant()",
  );
  try {
    expect((await importCsv(historyCsv({ kills: "9" }))).state).toBe("failed");
    expect((await queries.game("oracle:game:acceptance-game"))?.participants[0]?.kills).toBe(5);
  } finally {
    await pool.query("DROP TRIGGER reject_test_write ON participants");
    await pool.query("DROP FUNCTION reject_test_participant()");
  }
});
describe("durable synchronization and request budgeting", () => {
  it("shows the most recent 30 job requests in numeric creation order", async () => {
    const ids: string[] = [];
    for (let year = 2014; year < 2046; year++)
      ids.push(await sync.request({ kind: "history", year }));
    const status = await queries.status();
    expect(status.jobs.map((job) => job.id)).toEqual(ids.reverse().slice(0, 30));
  });
  it("deduplicates simultaneous requests, coordinates workers and recovers expired leases after restart", async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, () => sync.request({ kind: "running" })),
    );
    expect(new Set(ids).size).toBe(1);
    const held = await pool.connect();
    await held.query("SELECT pg_advisory_lock(9183275)");
    expect(await sync.runNext()).toEqual({ state: "busy" });
    await held.query("SELECT pg_advisory_unlock(9183275)");
    held.release();
    await pool.query("UPDATE sync_jobs SET state='running',lease_until=$1", [
      new Date(now.valueOf() - 1),
    ]);
    const restarted = createSync(connection, {
      clock: () => now,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      token: "test",
    });
    try {
      expect((await restarted.runNext()).state).toBe("done");
    } finally {
      await restarted.close();
    }
    expect(await sync.runNext()).toEqual({ state: "idle" });
    await sync.runNext(true);
    const first = (await queries.status()).jobs.length;
    await sync.runNext(true);
    expect((await queries.status()).jobs.length).toBe(first);
    instant = new Date(now.valueOf() + 121000);
    await sync.runNext(true);
    expect((await queries.status()).jobs.length).toBeGreaterThan(first);
  });
  it("never exceeds 600 across concurrent reservations and process restart", async () => {
    await pool.query(
      "INSERT INTO request_ledger(requested_at) SELECT $1 FROM generate_series(1,598)",
      [now],
    );
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => reserveRequest(pool, now)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await queries.status()).pandaRequests).toBe(600);
    expect((await run({ kind: "running" })).state).toBe("queued");
    expect(fetcher).not.toHaveBeenCalled();
    const other = database(connection);
    try {
      await expect(reserveRequest(other, now)).rejects.toBeInstanceOf(DeferredRequest);
      await reserveRequest(other, new Date(now.valueOf() + 3600000));
    } finally {
      await other.end();
    }
  });
  it("counts retries, respects headers and retains observations on 401/429/5xx", async () => {
    fetcher.mockResolvedValueOnce(json([rawMatch()]));
    await run({ kind: "running" });
    const original = await queries.match("pandascore:match:1");
    fetcher.mockResolvedValue(
      new Response("secret upstream body", {
        status: 429,
        headers: {
          "retry-after": "120",
          "x-rate-limit-remaining": "0",
          "x-rate-limit-reset": String(now.valueOf() / 1000 + 3600),
        },
      }),
    );
    expect((await run({ kind: "running" })).state).toBe("queued");
    expect((await queries.status()).pandaRequests).toBe(2);
    expect((await queries.status()).cooldownUntil).toBe(
      new Date(now.valueOf() + 3600000).toISOString(),
    );
    instant = new Date(now.valueOf() + 3600001);
    fetcher.mockResolvedValue(new Response("bad", { status: 503 }));
    expect((await sync.runNext()).state).toBe("queued");
    instant = new Date(instant.valueOf() + 300000);
    expect((await sync.runNext()).state).toBe("failed");
    expect(await queries.match("pandascore:match:1")).toEqual(original);
    fetcher.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    expect((await run({ kind: "running" })).state).toBe("failed");
    await observeQuota(
      pool,
      new Headers({
        "retry-after": new Date(instant.valueOf() + 120000).toUTCString(),
      }),
      200,
      instant,
    );
    await observeQuota(
      pool,
      new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "bad" }),
      200,
      instant,
    );
    await expect(reserveRequest(pool, instant)).rejects.toBeInstanceOf(DeferredRequest);
  });
  it("reports missing credentials, transport failure and blocked archives without secret errors", async () => {
    const missing = createSync(connection, {
      clock: () => now,
      fetch: fetcher,
      pause: () => Promise.resolve(),
    });
    try {
      await missing.request({ kind: "running" });
      expect((await missing.runNext()).state).toBe("failed");
    } finally {
      await missing.close();
    }
    fetcher.mockRejectedValue(new Error("https://host?token=should-not-escape"));
    const failure = await run({ kind: "running" });
    expect(failure.state).toBe("queued");
    expect(JSON.stringify(await queries.status())).not.toContain("should-not-escape");
    fetcher.mockResolvedValue(new Response("quota", { headers: { "content-type": "text/html" } }));
    expect((await run({ kind: "history", year: 2014 })).state).toBe("failed");
    fetcher.mockResolvedValue(
      new Response(historyCsv({ year: 2024 }), {
        headers: { "content-type": "text/csv" },
      }),
    );
    expect((await run({ kind: "history", year: 2024 })).state).toBe("done");
    expect((await run({ kind: "history", year: 2099 })).state).toBe("failed");
  });
  it("downloads through the Drive API when configured and retries quota-blocked public downloads", async () => {
    const quota = () =>
      new Response(
        "<!DOCTYPE html><html><head><title>Google Drive - Quota exceeded</title></head></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    fetcher.mockResolvedValue(quota());
    const blocked = await run({ kind: "history", year: 2026 });
    expect(blocked.state).toBe("queued");
    expect(blocked.state === "queued" && blocked.error).toContain("quota");

    const keyed = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      pause: () => Promise.resolve(),
      driveApiKey: "test-only-drive-key",
    });
    try {
      fetcher.mockReset();
      fetcher.mockResolvedValueOnce(
        new Response(historyCsv(), { headers: { "content-type": "text/csv" } }),
      );
      instant = new Date(now.valueOf() + 3600000);
      expect((await keyed.runNext()).state).toBe("done");
      const api = new URL(endpoint(fetcher.mock.calls[0]?.[0]));
      expect(`${api.origin}${api.pathname}`).toBe(
        `https://www.googleapis.com/drive/v3/files/${archiveFileId(2026)}`,
      );
      expect(api.searchParams.get("alt")).toBe("media");

      // An API refusal falls back to the public download; the key never reaches saved status.
      fetcher.mockReset();
      fetcher.mockResolvedValueOnce(new Response("{}", { status: 403 }));
      fetcher.mockResolvedValueOnce(quota());
      await keyed.request({ kind: "history", year: 2026 });
      expect((await keyed.runNext()).state).toBe("queued");
      expect(endpoint(fetcher.mock.calls[1]?.[0])).toContain("drive.google.com/uc");
      expect(JSON.stringify(await queries.status())).not.toContain("test-only-drive-key");
      expect((await queries.historicalCoverage()).find((entry) => entry.year === 2026)?.games).toBe(
        1,
      );
    } finally {
      await keyed.close();
    }
  });
  it("follows only the manifest-matched official Drive virus-scan confirmation", async () => {
    const id = archiveFileId(2026);
    const warning = (fileId: string, action = "https://drive.usercontent.google.com/download") =>
      `<!doctype html><title>Google Drive - Virus scan warning</title><form action="${action}" method="get"><input type="hidden" name="id" value="${fileId}"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="73d17514-beb7-46dc-81b1-b5420daa7356"></form>`;
    fetcher.mockResolvedValueOnce(
      new Response(warning(id), { headers: { "content-type": "text/html" } }),
    );
    fetcher.mockResolvedValueOnce(
      new Response(historyCsv(), { headers: { "content-type": "text/csv" } }),
    );
    expect((await run({ kind: "history", year: 2026 })).state).toBe("done");
    expect(endpoint(fetcher.mock.calls[1]?.[0])).toContain(`id=${id}`);
    expect(endpoint(fetcher.mock.calls[1]?.[0])).toContain("drive.usercontent.google.com/download");
    expect((await queries.historicalCoverage()).find((entry) => entry.year === 2026)?.games).toBe(
      1,
    );

    fetcher.mockReset();
    fetcher.mockResolvedValue(
      new Response(warning("unexpected", "https://attacker.example/download"), {
        headers: { "content-type": "text/html" },
      }),
    );
    expect((await run({ kind: "history", year: 2026 })).state).toBe("failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await queries.historicalCoverage()).find((entry) => entry.year === 2026)?.games).toBe(
      1,
    );
  });
});

describe("resolved profiles and local image persistence", () => {
  it("backfills free fixture evidence separately from schedules and resolves retired teams without current rosters", async () => {
    await importCsv();
    await importCsv(
      historyCsv({ id: "second" })
        .replaceAll("2026-03-01 01:00:00", "2026-03-02 01:00:00")
        .replaceAll(",11,", ",12,")
        .replaceAll("Acceptance Red", "Acceptance Green"),
    );
    fetcher.mockImplementation((input) =>
      Promise.resolve(
        endpoint(input).includes("/leagues")
          ? json([
              { id: 1, name: "LCK" },
              { id: 2, name: "LCK Challengers" },
            ])
          : json([
              rawMatch(1),
              rawMatch(2, {
                begin_at: "2026-03-02T01:00:00Z",
                opponents: [
                  { opponent: { id: 10, name: "Acceptance Blue" } },
                  { opponent: { id: 21, name: "Acceptance Green" } },
                ],
              }),
            ]),
      ),
    );
    expect((await run({ kind: "entity-history", year: 2026 })).state).toBe("done");
    expect((await queries.profile("pandascore:team:10"))?.summary.eligibleGames).toBe(2);
    expect((await queries.profile("pandascore:team:10"))?.resolution).toMatchObject([
      { method: "fixtures", matchedFixtures: 2 },
    ]);
    expect((await queries.matches()).total).toBe(0);
    expect(endpoint(fetcher.mock.calls[1]?.[0])).toContain("filter%5Bleague_id%5D=1");
    fetcher.mockResolvedValue(json([]));
    expect((await run({ kind: "entity-history", year: 2025 })).state).toBe("failed");
    expect((await queries.profile("pandascore:team:10"))?.summary.eligibleGames).toBe(2);
  });
  const portrait = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGOYsmjDTHyYYWQoAABhNp/B8kBP7wAAAABJRU5ErkJggg==",
    "base64",
  );
  const imageUrl = "https://cdn-api.pandascore.co/images/test.png";
  function catalog() {
    return [
      {
        id: 10,
        name: "Acceptance Blue",
        image_url: imageUrl,
        players: ["top", "jng", "mid", "bot", "sup"].map((role, index) => ({
          id: 30 + index,
          name: `Player Blue ${role}`,
          role,
          image_url: imageUrl,
        })),
      },
      { id: 999, name: "Unrelated Academy", players: [] },
    ];
  }
  function provider() {
    fetcher.mockImplementation((input, init) => {
      const url = endpoint(input);
      if (url.includes("cdn-api")) {
        expect(init?.headers).toBeUndefined();
        expect(init?.redirect).toBe("error");
        return Promise.resolve(
          new Response(portrait, { headers: { "content-type": "image/png" } }),
        );
      }
      if (url.includes("/teams")) return Promise.resolve(json(catalog()));
      return Promise.resolve(json([rawMatch()]));
    });
  }
  it("gives a newly linked canonical profile the clean slug when its provider copy arrived first", async () => {
    provider();
    expect((await run({ kind: "matches" })).state).toBe("done");
    expect((await run({ kind: "rosters" })).state).toBe("done");
    expect((await queries.profile("pandascore:team:10"))?.identity.publicSlug).toBe(
      "acceptance-blue",
    );
    await importCsv();
    expect((await queries.profile("oracle:team:10"))?.identity.publicSlug).not.toBe(
      "acceptance-blue",
    );
    expect((await run({ kind: "entities" })).state).toBe("done");
    expect((await queries.profile("pandascore:team:10"))?.identity.publicSlug).toBe(
      "acceptance-blue",
    );
    expect((await queries.profile("acceptance-blue", {}, "team"))?.identity.id).toBe(
      "oracle:team:10",
    );
  });
  it("reprocesses retained originals without network requests and shares transparent renditions across all queries", async () => {
    await importCsv();
    provider();
    await run({ kind: "entities" });
    const subject = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "black" },
    })
      .png()
      .toBuffer();
    const original = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "white" },
    })
      .composite([{ input: subject, left: 4, top: 4 }])
      .png()
      .toBuffer();
    const sourceHash = createHash("sha256").update(original).digest("hex");
    // Model a retained asset from before the rendition migration.
    await pool.query("INSERT INTO image_assets VALUES($1,'image/png',$2)", [sourceHash, original]);
    await pool.query(
      "UPDATE identity_images SET asset_hash=$1 WHERE identity_id='pandascore:player:32'",
      [sourceHash],
    );
    fetcher.mockClear();
    expect((await run({ kind: "resolve" })).state).toBe("done");
    expect(fetcher).not.toHaveBeenCalled();
    const profile = (await queries.profile("pandascore:player:32"))!;
    const image = profile.identity.imageUrl!;
    expect(image).not.toContain(sourceHash);
    const rendered = (await queries.image(image.split("/").at(-1)!))!;
    const pixels = await sharp(rendered.bytes).raw().toBuffer();
    expect(pixels[3]).toBe(0);
    expect(pixels[(8 * 16 + 8) * 4 + 3]).toBe(255);
    expect((await queries.image(sourceHash))?.bytes).toEqual(new Uint8Array(original));
    expect((await queries.directory("player", { q: "Player Blue mid" })).items[0]?.imageUrl).toBe(
      image,
    );
    expect((await queries.search({ q: "Player Blue mid" })).items[0]?.imageUrl).toBe(image);
    expect(profile.roster[0]?.player.imageUrl).toBe(image);
    expect(
      (await queries.game("oracle:game:acceptance-game"))?.participants.find(
        (p) => p.player?.sourceId === "10-mid",
      )?.player?.imageUrl,
    ).toBe(image);

    const malformed = Buffer.from([255, 216, 255]);
    const malformedHash = createHash("sha256").update(malformed).digest("hex");
    await pool.query("INSERT INTO image_assets VALUES($1,'image/jpeg',$2)", [
      malformedHash,
      malformed,
    ]);
    await pool.query(
      "UPDATE identity_images SET asset_hash=$1 WHERE identity_id='pandascore:player:30'",
      [malformedHash],
    );
    await run({ kind: "resolve" });
    expect((await queries.entityStatus()).images.failed).toBe(1);
    expect((await queries.image(malformedHash))?.bytes).toEqual(new Uint8Array(malformed));
    expect((await queries.profile("pandascore:player:32"))?.identity.imageUrl).toBe(image);
  });
  it("links corroborated sources, combines samples and rosters, deduplicates paginated alias search, and serves cached images after restart", async () => {
    await importCsv();
    provider();
    expect((await run({ kind: "entities" })).state).toBe("done");
    const profile = await queries.profile("pandascore:player:32");
    expect(profile?.identity).toMatchObject({
      id: "oracle:player:10-mid",
      entityId: "oracle:player:10-mid",
      sourceCount: 2,
      imageSource: "PandaScore",
    });
    expect(profile?.sources).toHaveLength(2);
    expect(profile?.summary.eligibleGames).toBe(1);
    expect(profile?.roster).toHaveLength(1);
    expect(profile?.resolution?.[0]?.gameId).toMatch(/^oracle:archive:[a-f0-9]{64}$/);
    expect(profile?.resolution?.[0]?.matchedPlayers).toBe(5);
    expect((await queries.profile("oracle:team:10"))?.roster).toHaveLength(5);
    expect((await queries.directory("team")).total).toBe(2);
    expect((await queries.directory("team", { q: "Academy" })).total).toBe(0);
    expect((await queries.search({ q: "Player Blue mid" })).items).toHaveLength(1);
    expect(
      (await queries.directory("player", { q: "Player Blue", pageSize: 2, page: 3 })).items,
    ).toHaveLength(1);
    expect(
      (await queries.directory("player", { q: "Player Blue", pageSize: 2, page: 4 })).total,
    ).toBe(5);
    const oldImage = profile!.identity.imageUrl!;
    const hash = oldImage.split("/").at(-1)!;
    expect((await queries.image(hash))?.bytes).toEqual(new Uint8Array(portrait));
    expect(await queries.image("0".repeat(64))).toBeNull();
    await expect(queries.image("bad")).rejects.toThrow();
    const restarted = createQueries(connection);
    try {
      expect((await restarted.profile("oracle:player:10-mid"))?.identity.imageUrl).toBe(oldImage);
    } finally {
      await restarted.close();
    }
    expect(
      (await queries.game("oracle:game:acceptance-game"))?.participants.find(
        (p) => p.player?.id === "oracle:player:10-mid",
      )?.player?.imageUrl,
    ).toBe(oldImage);
    expect((await queries.entityStatus()).counts.find((c) => c.kind === "player")).toMatchObject({
      identities: 10,
      linked: 5,
      images: 5,
    });
    expect(
      fetcher.mock.calls.filter((c) => endpoint(c[0]).includes("api.pandascore.co/lol")),
    ).toHaveLength(1);
    expect((await queries.status()).pandaRequests).toBe(1);
    const calls = fetcher.mock.calls.length;
    expect((await run({ kind: "resolve" })).state).toBe("done");
    expect(fetcher.mock.calls).toHaveLength(calls);
  });
  it("retains images after missing URLs, invalid content and partial provider failure; resolves corrections without rewriting source IDs", async () => {
    await importCsv();
    provider();
    await run({ kind: "entities" });
    const before = await queries.profile("oracle:player:10-mid");
    instant = new Date(now.valueOf() + 8 * 86400000);
    fetcher.mockResolvedValue(
      new Response("<html>unavailable</html>", { headers: { "content-type": "text/html" } }),
    );
    expect((await run({ kind: "resolve" })).state).toBe("done");
    expect((await queries.profile("oracle:player:10-mid"))?.identity.imageUrl).toBe(
      before?.identity.imageUrl,
    );
    expect((await queries.entityStatus()).images.failed).toBe(6);
    fetcher.mockResolvedValue(
      json(
        catalog().map((t) => ({
          ...t,
          image_url: null,
          players: t.players.map((p) => ({ ...p, image_url: null })),
        })),
      ),
    );
    expect((await run({ kind: "entities" })).state).toBe("done");
    expect((await queries.profile("oracle:player:10-mid"))?.identity.imageUrl).toBe(
      before?.identity.imageUrl,
    );
    fetcher
      .mockResolvedValueOnce(json(catalog(), { link: '<https://untrusted>; rel="next"' }))
      .mockResolvedValueOnce(json({ error: "broken schema" }));
    expect((await run({ kind: "entities" })).state).toBe("failed");
    expect((await queries.profile("oracle:player:10-mid"))?.summary).toEqual(before?.summary);
    // A correction invalidating the one corroborating lineup removes the derived links, not the sources.
    await importCsv(
      historyCsv()
        .replaceAll("Player Blue mid", "Different Player")
        .replaceAll("Player Blue jng", "Different Jungler")
        .replaceAll("Player Blue top", "Different Top"),
    );
    expect((await run({ kind: "resolve" })).state).toBe("done");
    expect((await queries.profile("pandascore:player:32"))?.sources).toHaveLength(1);
    expect((await queries.profile("oracle:player:10-mid"))?.summary.eligibleGames).toBe(1);
  });
});
it("links retired players using period-bounded tournament rosters without replacing current observations, and resumes saved tournament work", async () => {
  await importCsv();
  expect((await run({ kind: "entity-rosters", year: 2026 })).state).toBe("failed");
  fetcher.mockImplementation((input) =>
    Promise.resolve(
      endpoint(input).includes("/leagues")
        ? json([{ id: 1, name: "LCK" }])
        : json([
            rawMatch(1, { tournament: { id: 100, name: "Spring" } }),
            rawMatch(2, {
              tournament: { id: 101, name: "Spring playoffs" },
              begin_at: "2026-03-03T01:00:00Z",
            }),
          ]),
    ),
  );
  await run({ kind: "entity-history", year: 2026 });
  const roster = {
    type: "Team",
    rosters: [
      {
        id: 10,
        name: "Acceptance Blue",
        players: ["top", "jng", "mid", "bot", "sup"].map((role, index) => ({
          id: 30 + index,
          name: `Player Blue ${role}`,
          role,
        })),
      },
    ],
  };
  fetcher.mockReset();
  fetcher
    .mockResolvedValueOnce(json(roster))
    .mockResolvedValueOnce(json({ type: "Player", rosters: [] }));
  expect((await run({ kind: "entity-rosters", year: 2026 })).state).toBe("failed");
  expect((await queries.status()).jobs[0]?.error).toContain("retained for resume");
  expect((await queries.profile("oracle:player:10-mid"))?.sources).toHaveLength(1);
  fetcher.mockReset();
  fetcher.mockResolvedValue(json(roster));
  expect((await run({ kind: "entity-rosters", year: 2026 })).state).toBe("done");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.pandascore.co/tournaments/101/rosters");
  const profile = await queries.profile("pandascore:player:32");
  expect(profile?.sources).toHaveLength(2);
  expect(profile?.summary.eligibleGames).toBe(1);
  expect(profile?.roster).toEqual([]);
  expect((await queries.profile("oracle:team:10"))?.roster).toEqual([]);
});
it("enriches each historical appearance without replacing its source-era name or role", async () => {
  await importCsv();
  await importCsv(
    historyCsv({ id: "renamed" })
      .replaceAll("Acceptance Blue", "Renamed Blue")
      .replaceAll("Player Blue mid", "New Handle"),
  );
  const games = await queries.games();
  expect(
    games.items.find((g) => g.sourceId === "acceptance-game")?.participants[0]?.team.name,
  ).toBe("Acceptance Blue");
  expect(games.items.find((g) => g.sourceId === "renamed")?.participants[0]?.team.name).toBe(
    "Renamed Blue",
  );
  expect(
    games.items
      .find((g) => g.sourceId === "acceptance-game")
      ?.participants.find((p) => p.player?.id === "oracle:player:10-mid")?.player?.name,
  ).toBe("Player Blue mid");
  expect(
    games.items
      .find((g) => g.sourceId === "renamed")
      ?.participants.find((p) => p.player?.id === "oracle:player:10-mid")?.player?.name,
  ).toBe("New Handle");
});

it("caches the map through the worker and preserves its bytes and timestamp on failed replacements", async () => {
  expect(await queries.mapImage()).toBeNull();
  serveDataDragon(["16.4.1"]);
  expect((await run({ kind: "metadata" })).state).toBe("done");
  const saved = await queries.mapImage();
  expect(saved).toEqual({
    mapId: 11,
    sourceUrl: "https://ddragon.leagueoflegends.com/cdn/6.8.1/img/map/map11.png",
    imageUrl: `/api/images/${createHash("sha256").update(mapBytes).digest("hex")}`,
    fetchedAt: now.toISOString(),
  });
  expect((await queries.image(saved!.imageUrl.split("/").at(-1)!))?.bytes).toEqual(
    new Uint8Array(mapBytes),
  );
  expect(fetcher.mock.lastCall?.[0]).toBe(saved!.sourceUrl);
  expect(fetcher.mock.lastCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
  instant = new Date(now.valueOf() + 86400000);
  serveDataDragon(["16.4.1"], { map: new Response("unavailable", { status: 503 }) });
  expect((await run({ kind: "metadata" })).state).toBe("queued");
  expect(await queries.mapImage()).toEqual(saved);
  instant = new Date(instant.valueOf() + 86400000);
  serveDataDragon(["16.4.1"], {
    map: new Response("GIF89a", { headers: { "content-type": "image/gif" } }),
  });
  expect((await sync.runNext()).state).toBe("failed");
  expect(await queries.mapImage()).toEqual(saved);
});

it("caches all catalog icon kinds, bounds queries and retains successful images on failed refreshes", async () => {
  const query = { patch: "16.22", kind: "champion" as const, ids: ["MonkeyKing"] };
  expect(await queries.catalogIcons(query)).toEqual([]);
  await expect(
    queries.catalogIcons({ ...query, ids: Array<string>(101).fill("MonkeyKing") }),
  ).rejects.toThrow();
  await expect(queries.catalogIcons({ ...query, patch: "../bad" })).rejects.toThrow();
  serveDataDragon(["16.22.1"], { icons: new Response("unavailable", { status: 503 }) });
  expect((await run({ kind: "metadata" })).state).toBe("done");
  expect(await queries.catalogIcons(query)).toEqual([
    { id: "MonkeyKing", kind: "champion", name: "Wukong", imageUrl: null, fetchedAt: null },
  ]);
  fetcher.mockClear();
  serveDataDragon(["16.22.1"]);
  await run({ kind: "metadata" });
  expect(fetcher.mock.calls.filter((c) => endpoint(c[0]).includes("/img/champion/"))).toHaveLength(
    0,
  );
  instant = new Date(now.valueOf() + 86400001);
  await run({ kind: "metadata" });
  const url = `/api/images/${createHash("sha256").update(mapBytes).digest("hex")}`;
  for (const [kind, id, name] of [
    ["champion", "MonkeyKing", "Wukong"],
    ["item", "1001", "Boots"],
    ["rune", "8112", "Electrocute"],
    ["spell", "SummonerFlash", "Flash"],
  ] as const) {
    expect(await queries.catalogIcons({ ...query, kind, ids: [id, "missing"] })).toEqual([
      { id, kind, name, imageUrl: url, fetchedAt: instant.toISOString() },
    ]);
  }
  expect((await queries.image(url.split("/").at(-1)!))?.bytes).toEqual(new Uint8Array(mapBytes));
  expect(await queries.catalogIcons({ ...query, patch: "16.21" })).toEqual([]);
  expect(
    fetcher.mock.calls.some((c) =>
      endpoint(c[0]).endsWith("/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png"),
    ),
  ).toBe(true);
  const saved = await queries.catalogIcons(query);
  instant = new Date(instant.valueOf() + 8 * 86400000);
  serveDataDragon(["16.22.1"], {
    icons: new Response("GIF89a", { headers: { "content-type": "image/gif" } }),
  });
  await run({ kind: "metadata" });
  expect(await queries.catalogIcons(query)).toEqual(saved);
  const ledger = await pool.query<{ attempts: number; error: string; source_url: string }>(
    "SELECT attempts,error,source_url FROM catalog_images WHERE kind='champion' AND catalog_id='MonkeyKing'",
  );
  expect(ledger.rows[0]?.attempts).toBe(3);
  expect(ledger.rows[0]?.error).toContain("retained");
  expect(ledger.rows[0]?.source_url).toContain("16.22.1/img/champion/MonkeyKing.png");
});

it("derives draft rates with patch/league SQL filters, role order, missing counts and result samples", async () => {
  const q = { patch: "16.4", league: "LCK" };
  expect(await queries.latestDraftPatch()).toBeNull();
  const empty = await queries.draftAnalytics(q);
  expect(empty.firstPickWinRate).toEqual({ value: null, sampleCount: 0 });
  expect(
    empty.firstPickSides.every((s) => s.winRate.value === null && s.winRate.sampleCount === 0),
  ).toBe(true);
  await expect(queries.draftAnalytics({ ...q, patch: "bad" })).rejects.toThrow();
  await expect(queries.draftAnalytics({ ...q, league: "x".repeat(101) })).rejects.toThrow();
  await expect(queries.draftAnalytics({ ...q, priorityPage: 0 })).rejects.toThrow();
  serveDataDragon(["16.5.1", "16.4.1"]);
  await run({ kind: "metadata" });
  for (const options of [
    { id: "draft-a" },
    { id: "draft-b", firstSide: "red" as const },
    { id: "draft-missing", missingBan: true },
    { id: "draft-unknown", patch: "16.04", unknownResult: true },
    { id: "draft-other-league", league: "LPL" },
    { id: "draft-other-patch", patch: "16.5" },
  ])
    expect((await importCsv(draftCsv(options))).state).toBe("done");
  expect(await queries.latestDraftPatch()).toBe("16.5");
  const result = await queries.draftAnalytics(q);
  expect(result).toMatchObject({
    games: 4,
    includedGames: 3,
    excludedGames: 1,
    pendingGames: 0,
    firstPickWinRate: { value: 0.5, sampleCount: 2 },
  });
  expect(result.exclusions).toEqual([
    { reason: "Missing or conflicting pick/ban columns", games: 1 },
  ]);
  expect(result.firstPickSides).toEqual([
    { side: "blue", winRate: { value: 1, sampleCount: 1 } },
    { side: "red", winRate: { value: 0, sampleCount: 1 } },
  ]);
  expect(result.priorities.items).toHaveLength(25);
  expect(result.priorities.total).toBe(60);
  expect(result.priorities.items.every((r) => r.rate.sampleCount === 3)).toBe(true);
  expect(result.priorities.items.find((r) => r.slot === null)?.rate.value).toBe(1);
  expect(
    result.priorities.items.find((r) => r.champion === "Kalista" && r.slot === 1)?.rate.value,
  ).toBeCloseTo(2 / 3);
  expect(result.roles.items.find((r) => r.champion === "Jinx")).toMatchObject({
    role: "bottom",
    games: 3,
    blindRate: { value: 2 / 3, sampleCount: 3 },
    counterRate: { value: 1 / 3, sampleCount: 3 },
  });
  expect(await queries.draftAnalytics({ ...q, league: "lck" })).toEqual(result);
  expect((await queries.draftAnalytics({ patch: "16.4" })).firstPickWinRate.value).toBeCloseTo(
    2 / 3,
  );
  expect((await queries.draftAnalytics({ ...q, patch: "16.5" })).includedGames).toBe(1);
  expect(
    (await queries.draftAnalytics({ ...q, priorityPage: 999, rolePage: 999 })).priorities,
  ).toMatchObject({ total: 60, items: [] });
  expect((await queries.draftAnalytics({ ...q, priorityPage: 2 })).priorities.items).not.toEqual(
    result.priorities.items,
  );
  const providerCalls = fetcher.mock.calls.length;
  expect(await run({ kind: "drafts" })).toMatchObject({ state: "done", records: 0 });
  expect(fetcher.mock.calls).toHaveLength(providerCalls);
  // Simulate an existing archive on upgrade, before its first scheduled draft aggregation.
  await pool.query("DELETE FROM oracle_draft_games");
  expect(await queries.draftAnalytics(q)).toMatchObject({
    pendingGames: 4,
    includedGames: 0,
    firstPickWinRate: { value: null, sampleCount: 0 },
  });
  expect(await run({ kind: "drafts" })).toMatchObject({ state: "done", records: 6 });
  expect(await queries.draftAnalytics(q)).toEqual(result);
  await importCsv(draftCsv({ id: "draft-missing" }));
  const corrected = await queries.draftAnalytics(q);
  expect(corrected).toMatchObject({ games: 4, includedGames: 4, excludedGames: 0 });
  expect(
    (await importCsv(draftCsv({ id: "draft-missing" }).replaceAll("2026-03-01", "bad-date"))).state,
  ).toBe("failed");
  expect(await queries.draftAnalytics(q)).toEqual(corrected);
});

describe("replay track imports", () => {
  const fixture = () =>
    parseReplayTrackFile(
      readFileSync(new URL("../../tests/replay-tracks/valid-v1.json", import.meta.url), "utf8"),
    );
  const key = { platform: "euw1" as const, gameId: "EUW1_1234567890" };
  async function upload(value: unknown, name = "track.json") {
    const file = join(directory, name);
    await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
    return run({ kind: "replay-track", file });
  }
  async function storeRiot(track: ReplayTrack) {
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    );
    const match = parseRiotMatch(raw, "EUW1_7612345678");
    track.gameId = match.matchId;
    track.roster = match.participants.map((p) => ({
      participantId: p.participantId,
      championId: p.championId,
      teamId: p.teamId,
    }));
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      [match.matchId],
      10,
      now,
    );
    await saveRiotMatch(pool, match, raw, now);
    return { platform: track.platform, gameId: track.gameId };
  }
  it("validates complete files, replaces one version and keeps other games and nulls without provider calls", async () => {
    const original = fixture();
    expect((await upload(original)).state).toBe("done");
    const saved = await queries.replayTrack(key);
    expect(saved).toMatchObject({
      track: original,
      importedAt: now.toISOString(),
      matchId: null,
      linkState: "unavailable",
    });
    expect(saved!.contentSha256).toBe(
      createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    );
    expect((await upload(original)).state).toBe("done");
    const other = { ...original, gameId: "EUW1_999" };
    expect((await upload(other, "other.json")).state).toBe("done");
    const correction = structuredClone(original);
    correction.samples = correction.samples.slice(0, 1);
    correction.samples[0]!.positions[0]!.position = null;
    correction.samples[0]!.positions[0]!.confidence = 0.2;
    instant = new Date(now.valueOf() + 1000);
    expect((await upload(correction)).state).toBe("done");
    expect(await queries.replayTrack(key)).toMatchObject({
      track: correction,
      importedAt: instant.toISOString(),
    });
    expect((await queries.replayTrack({ ...key, gameId: other.gameId }))!.track).toEqual(other);
    for (const bad of [
      "broken",
      { ...correction, formatVersion: 2 },
      { ...correction, platform: "kr" },
      { ...correction, samples: [...correction.samples, { timeMs: -1, positions: [] }] },
    ]) {
      expect((await upload(bad)).state).toBe("failed");
      expect((await queries.replayTrack(key))!.track).toEqual(correction);
    }
    expect(await queries.replayTrack({ ...key, platform: "kr" })).toBeNull();
    await expect(queries.replayTrack({ ...key, gameId: "bad" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await queries.status()).sources.every((s) => s.lastAttempt === null)).toBe(true);
  });
  it("links only exact platform/game identities with corroborating metadata and participant rosters", async () => {
    const track = fixture();
    const matchedKey = await storeRiot(track);
    expect((await upload(track)).state).toBe("done");
    expect(await queries.replayTrack(matchedKey)).toMatchObject({
      matchId: track.gameId,
      linkState: "linked",
    });
    const original = (await queries.replayTrack(matchedKey))!.track;
    for (const altered of [
      { ...track, patch: "16.21" },
      {
        ...track,
        roster: track.roster.map((p, i) => ({ ...p, championId: i === 0 ? 999999 : p.championId })),
      },
    ]) {
      const failed = await upload(altered);
      expect(failed.state).toBe("failed");
      expect(failed).toHaveProperty("error", expect.stringContaining("does not match"));
      expect((await queries.replayTrack(matchedKey))!.track).toEqual(original);
    }
    await pool.query("UPDATE riot_matches SET platform_id='KR' WHERE match_id=$1", [track.gameId]);
    expect((await queries.replayTrack(matchedKey))!.matchId).toBeNull();
    expect((await upload(track)).state).toBe("failed");
    await pool.query("UPDATE riot_matches SET platform_id=NULL WHERE match_id=$1", [track.gameId]);
    expect((await upload(track)).state).toBe("failed");
    await pool.query("UPDATE riot_matches SET platform_id='EUW1',map_id=12 WHERE match_id=$1", [
      track.gameId,
    ]);
    expect((await upload(track)).state).toBe("failed");
    await pool.query("UPDATE riot_matches SET map_id=11 WHERE match_id=$1", [track.gameId]);
    await pool.query(
      "DELETE FROM riot_match_participants WHERE match_id=$1 AND participant_id=10",
      [track.gameId],
    );
    expect((await upload(track)).state).toBe("failed");
    await pool.query("DELETE FROM riot_matches WHERE match_id=$1", [track.gameId]);
    expect(await queries.replayTrack(matchedKey)).toMatchObject({
      track: original,
      matchId: null,
      linkState: "unavailable",
    });
  });
  it("can link a previously imported track after an exact Riot match arrives", async () => {
    const track = fixture();
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    );
    const match = parseRiotMatch(raw, "EUW1_7612345678");
    track.gameId = match.matchId;
    track.roster = match.participants.map((p) => ({
      participantId: p.participantId,
      championId: p.championId,
      teamId: p.teamId,
    }));
    expect((await upload(track)).state).toBe("done");
    const matchedKey = await storeRiot(track);
    expect((await queries.replayTrack(matchedKey))!.matchId).toBe(track.gameId);
  });
  it("rolls back storage failures and keeps distinct pending uploads", async () => {
    const track = fixture();
    expect((await upload(track)).state).toBe("done");
    await pool.query(
      "CREATE FUNCTION reject_test_track() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_test_track_write BEFORE UPDATE ON replay_tracks FOR EACH ROW EXECUTE FUNCTION reject_test_track()",
    );
    try {
      expect((await upload({ ...track, sampleRateHz: 10 })).state).toBe("failed");
      expect((await queries.replayTrack(key))!.track).toEqual(track);
    } finally {
      await pool.query("DROP TRIGGER reject_test_track_write ON replay_tracks");
      await pool.query("DROP FUNCTION reject_test_track()");
    }
    const first = await sync.request({ kind: "replay-track", file: "/first.json" });
    expect(await sync.request({ kind: "replay-track", file: "/first.json" })).toBe(first);
    expect(await sync.request({ kind: "replay-track", file: "/correction.json" })).not.toBe(first);
  });
  it("rejects missing, non-file, oversized and invalid UTF-8 inputs without changing data", async () => {
    for (const file of [join(directory, "missing.json"), directory])
      expect((await run({ kind: "replay-track", file })).state).toBe("failed");
    const file = join(directory, "invalid-utf8.json");
    await writeFile(file, Buffer.from([0xff, 0xfe]));
    expect((await run({ kind: "replay-track", file })).state).toBe("failed");
    await writeFile(file, Buffer.alloc(64 * 1024 * 1024 + 1, 32));
    const failed = await run({ kind: "replay-track", file });
    expect(failed.state).toBe("failed");
    expect(failed).toHaveProperty("error", expect.stringContaining("64 MiB"));
    expect(await queries.replayTrack(key)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("replay metadata imports", () => {
  const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  async function staged(bytes: Buffer) {
    const folder = join(directory, "replays");
    await mkdir(folder, { recursive: true });
    const file = join(folder, randomUUID() + ".rofl");
    await writeFile(file, bytes);
    return file;
  }
  const importFile = async (file: string, platform?: "euw1" | "kr", keepFiles = false) => {
    const service = createSync(connection, {
      clock: () => instant,
      fetch: fetcher,
      importDirectory: directory,
      keepReplayFiles: keepFiles,
    });
    try {
      await service.request({ kind: "replay-metadata", file, ...(platform ? { platform } : {}) });
      return await service.runNext();
    } finally {
      await service.close();
    }
  };
  it("stores validated metadata atomically, keeps missing statistics null, and removes staged copies by default", async () => {
    const bytes = roflFixture(),
      file = await staged(bytes),
      sha256 = digest(bytes);
    expect((await importFile(file)).state).toBe("done");
    expect(existsSync(file)).toBe(false);
    expect(await queries.replayMetadata(sha256)).toMatchObject({
      sha256,
      format: "ROFL",
      gameId: "7612345678",
      platform: null,
      gameVersion: "16.22.734.5521",
      durationMs: 1_800_000,
      matchId: null,
      fileRetainedAtImport: false,
      importedAt: now.toISOString(),
      participants: [
        { champion: "Ahri", teamId: 100, kills: 3, deaths: null, assists: 4, win: true },
        { champion: "Zed", teamId: 200, kills: null, deaths: 3, assists: null, win: false },
        { champion: null, teamId: null, kills: null, deaths: null, assists: null, win: null },
      ],
    });
    instant = new Date(now.valueOf() + 1000);
    expect((await importFile(await staged(bytes), "euw1")).state).toBe("done");
    expect(await queries.replayMetadata(sha256)).toMatchObject({
      platform: "euw1",
      importedAt: instant.toISOString(),
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect((await queries.status()).sources.every((source) => source.lastAttempt === null)).toBe(
      true,
    );
    await expect(queries.replayMetadata("invalid")).rejects.toThrow();
    expect(await queries.replayMetadata("a".repeat(64))).toBeNull();
  });
  it("links embedded game IDs and the supplied platform, while ROFL2 and wrong platforms stay unlinked", async () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    );
    const match = parseRiotMatch(raw, "EUW1_7612345678");
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      [match.matchId],
      10,
      now,
    );
    await saveRiotMatch(pool, match, raw, now);
    const bytes = roflFixture();
    expect((await importFile(await staged(bytes), "euw1")).state).toBe("done");
    expect((await queries.replayMetadata(digest(bytes)))!.matchId).toBe(match.matchId);
    expect((await importFile(await staged(bytes), "kr")).state).toBe("done");
    expect((await queries.replayMetadata(digest(bytes)))!.matchId).toBeNull();
    const current = roflFixture({ format: "ROFL2" });
    expect((await importFile(await staged(current), "euw1")).state).toBe("done");
    expect(await queries.replayMetadata(digest(current))).toMatchObject({
      gameId: null,
      matchId: null,
    });
    const wrongPatch = roflFixture({ version: "15.1.1" });
    expect((await importFile(await staged(wrongPatch), "euw1")).state).toBe("done");
    expect((await queries.replayMetadata(digest(wrongPatch)))!.matchId).toBeNull();
    expect((await importFile(await staged(bytes), "euw1")).state).toBe("done");
    await pool.query("DELETE FROM riot_matches WHERE match_id=$1", [match.matchId]);
    expect(await queries.replayMetadata(digest(bytes))).toMatchObject({
      gameId: "7612345678",
      matchId: null,
    });
  });
  it("keeps uploaded copies only when configured and removes invalid staged files", async () => {
    const bytes = roflFixture(),
      file = await staged(bytes);
    expect((await importFile(file, "euw1", true)).state).toBe("done");
    expect(existsSync(file)).toBe(true);
    expect((await queries.replayMetadata(digest(bytes)))!.fileRetainedAtImport).toBe(true);
    const invalid = await staged(roflFixture({ metadata: { statsJson: "invalid" } }));
    expect((await importFile(invalid)).state).toBe("failed");
    expect(existsSync(invalid)).toBe(false);
    expect((await queries.replayMetadata(digest(bytes)))!.fileRetainedAtImport).toBe(true);
    const oversized = await staged(Buffer.alloc(20));
    await truncate(oversized, 256 * 1024 * 1024 + 1);
    const result = await importFile(oversized);
    expect(result.state).toBe("failed");
    expect(result).toHaveProperty("error", expect.stringContaining("256 MiB"));
    expect(existsSync(oversized)).toBe(false);
  });
  it("never deletes original paths or symlink targets and preserves existing metadata after a storage failure", async () => {
    const bytes = roflFixture(),
      original = join(directory, "original.rofl");
    await writeFile(original, bytes);
    expect((await importFile(original)).state).toBe("failed");
    expect(existsSync(original)).toBe(true);
    const linked = await staged(bytes);
    await rm(linked);
    await symlink(original, linked);
    expect((await importFile(linked)).state).toBe("failed");
    expect(existsSync(original)).toBe(true);
    const file = await staged(bytes);
    expect((await importFile(file, "euw1")).state).toBe("done");
    await pool.query(
      "CREATE FUNCTION reject_replay_metadata() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_replay_metadata_write BEFORE UPDATE ON replay_metadata FOR EACH ROW EXECUTE FUNCTION reject_replay_metadata()",
    );
    try {
      const correction = await staged(bytes);
      expect((await importFile(correction, "kr")).state).toBe("failed");
      expect(existsSync(correction)).toBe(false);
      expect((await queries.replayMetadata(digest(bytes)))!.platform).toBe("euw1");
    } finally {
      await pool.query("DROP TRIGGER reject_replay_metadata_write ON replay_metadata");
      await pool.query("DROP FUNCTION reject_replay_metadata()");
    }
  });
});

describe("regional leaderboards", () => {
  const id = (letter: string) => letter.repeat(78);
  const entry = (
    letter: string,
    lp: number,
    tier: "CHALLENGER" | "GRANDMASTER" | "MASTER" = "CHALLENGER",
  ) => ({
    puuid: id(letter),
    summonerId: null,
    tier,
    rank: "I",
    leaguePoints: lp,
    wins: 3,
    losses: 1,
    leagueId: "fixture",
  });
  it("paginates a stable ranking and preserves the last successful ladder after failure", async () => {
    await saveLadder(pool, "euw1", [entry("x", 2000)], new Date(now.getTime() - 1000));
    await saveLadder(
      pool,
      "euw1",
      [
        entry("b", 1000),
        entry("a", 1000),
        entry("c", 2000, "MASTER"),
        { ...entry("z", 500), wins: 0, losses: 0 },
      ],
      now,
    );
    await saveLadder(pool, "kr", [entry("k", 5000)], now);
    await saveAccount(pool, { puuid: id("a"), gameName: "Ladder fixture", tagLine: "EUW" }, now);
    const first = await queries.leaderboard({ region: "euw1", pageSize: 2 });
    expect(first.page.total).toBe(4);
    expect(first.page.items.map((r) => [r.rank, r.puuid])).toEqual([
      [1, id("a")],
      [2, id("b")],
    ]);
    expect(first.page.items[0]).toMatchObject({
      gameName: "Ladder fixture",
      tagLine: "EUW",
      winRate: { value: 0.75, sampleCount: 4 },
      sampledGames: 0,
      champions: [],
    });
    const second = await queries.leaderboard({ region: "euw1", pageSize: 2, page: 2 });
    expect(second.page.items.map((r) => [r.rank, r.puuid])).toEqual([
      [3, id("z")],
      [4, id("c")],
    ]);
    expect(second.page.items[0]?.winRate).toEqual({ value: null, sampleCount: 0 });
    expect(second.page.items[0]?.gameName).toBeNull();
    const outside = await queries.leaderboard({ region: "euw1", page: 100 });
    expect(outside.page).toMatchObject({ items: [], total: 4 });
    await recordLadderFailure(pool, "euw1", "fixture failed refresh");
    const failed = await queries.leaderboard({ region: "euw1", pageSize: 2 });
    expect(failed.page).toEqual(first.page);
    expect(failed.lastSuccess).toBe(now.toISOString());
    expect(failed.refreshFailed).toBe(true);
    const empty = await queries.leaderboard({ region: "na1" });
    expect(empty.lastSuccess).toBeNull();
    expect(empty.refreshFailed).toBe(false);
    expect(empty.page.total).toBe(0);
    for (const input of [
      { region: "invalid" },
      { region: "euw1", page: 0 },
      { region: "euw1", pageSize: 101 },
    ])
      await expect(queries.leaderboard(input as { region: "euw1" })).rejects.toThrow();
  });
  it("counts only this platform's stored solo games and bounds each player's champion list", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    await saveLadder(pool, "euw1", [entry("a", 1000)], now);
    const template = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: { queueId: number; platformId: string; participants: { championId: number }[] };
    };
    for (const [index, champion] of [103, 103, 64, 86, 222, 103, 103].entries()) {
      const raw = structuredClone(template);
      const platform = index === 6 ? "kr" : "euw1";
      const matchId = platform.toUpperCase() + "_" + (8000000000 + index);
      raw.metadata.matchId = matchId;
      raw.info.platformId = platform.toUpperCase();
      raw.info.queueId = index === 5 ? 450 : 420;
      raw.info.participants[0]!.championId = champion;
      await saveMatchIds(
        pool,
        {
          puuid: id("a"),
          platform,
          region: platform === "kr" ? "asia" : "europe",
          patchKey: "16.22",
        },
        [matchId],
        20,
        now,
      );
      await saveRiotMatch(pool, parseRiotMatch(raw, matchId), raw, now);
    }
    const row = (await queries.leaderboard({ region: "euw1" })).page.items[0]!;
    expect(row.sampledGames).toBe(5);
    expect(row.champions.map((c) => [c.championKey, c.games])).toEqual([
      [103, 2],
      [64, 1],
      [86, 1],
    ]);
    expect(row.champions[0]).toMatchObject({ championId: null, name: null, imageUrl: null });
    // The catalog resolves identity and a locally cached image without fetching during the query.
    serveDataDragon(["16.22.1"]);
    await sync.request({ kind: "metadata" });
    await sync.runNext();
    const known = (await queries.leaderboard({ region: "euw1" })).page.items[0]!.champions[0]!;
    expect(known.championId).toBe("Ahri");
    expect(known.name).toBe("Ahri");
    expect(known.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
  });
});

describe("solo queue profiles", () => {
  const puuid = "a".repeat(78);
  const entry = (lp: number, player = puuid) => ({
    puuid: player,
    summonerId: null,
    tier: "CHALLENGER" as const,
    rank: "I",
    leaguePoints: lp,
    wins: 1,
    losses: 1,
    leagueId: "fixture",
  });
  it("records atomic ladder snapshots, uses the current Riot ID and leaves missing days as gaps", async () => {
    const day = (offset: number, hour = 10) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + offset);
      d.setUTCHours(hour, 0, 0, 0);
      return d;
    };
    await saveLadder(pool, "euw1", [entry(100), entry(200, "b".repeat(78))], day(-3));
    await saveLadder(pool, "euw1", [entry(100), entry(200, "b".repeat(78))], day(-2));
    await saveLadder(pool, "euw1", [entry(150)], day(-2, 11));
    await recordLadderFailure(pool, "euw1", "fixture failure");
    await saveLadder(pool, "euw1", [entry(300)], day(0));
    await saveLadder(pool, "kr", [entry(50)], day(0));
    await saveLadder(pool, "euw1", [entry(999)], day(1));
    await saveAccount(pool, { puuid, gameName: "Old fixture", tagLine: "EUW" }, day(-2));
    await saveAccount(pool, { puuid, gameName: "Current fixture", tagLine: "EUW" }, now);
    const profile = (await queries.summoner({ puuid }))!;
    expect(profile.gameName).toBe("Current fixture");
    expect(profile.games.total).toBe(0);
    expect(profile.champions.items).toEqual([]);
    expect(profile.history.map((h) => h.platform)).toEqual(["euw1", "kr"]);
    const points = profile.history[0]!.points;
    expect(points).toHaveLength(30);
    expect(points[26]).toMatchObject({ leaguePoints: 100, rank: 2, sampleCount: 1 });
    expect(points[27]).toMatchObject({ leaguePoints: 150, rank: 1, sampleCount: 2 });
    expect(points[28]).toMatchObject({
      leaguePoints: null,
      rank: null,
      observedAt: null,
      sampleCount: 0,
    });
    expect(points[29]).toMatchObject({ leaguePoints: 300, rank: 1, sampleCount: 1 });
    expect((await queries.summoner({ puuid, region: "kr" }))!.history).toHaveLength(1);
    expect((await queries.summoner({ puuid, region: "na1" }))!.history).toEqual([]);
    expect(await queries.summoner({ puuid: "x".repeat(78) })).toBeNull();
    await expect(queries.summoner({ puuid: "../bad" })).rejects.toThrow();
    const count = async () =>
      (await pool.query<{ n: number }>("SELECT count(*)::integer AS n FROM riot_ladder_snapshots"))
        .rows[0]!.n;
    const before = await count();
    await pool.query(
      "CREATE FUNCTION reject_snapshot_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_snapshot_fixture BEFORE INSERT ON riot_ladder_snapshot_entries FOR EACH ROW EXECUTE FUNCTION reject_snapshot_fixture()",
    );
    try {
      await expect(saveLadder(pool, "euw1", [entry(500)], day(0))).rejects.toThrow();
    } finally {
      await pool.query("DROP TRIGGER reject_snapshot_fixture ON riot_ladder_snapshot_entries");
      await pool.query("DROP FUNCTION reject_snapshot_fixture()");
    }
    expect(await count()).toBe(before);
    expect((await currentLadder(pool, "euw1"))[0]!.leaguePoints).toBe(999);
    // Match retention and a newer empty ladder cannot erase recorded observations.
    await saveLadder(pool, "euw1", [], now);
    expect((await queries.summoner({ puuid }))!.history[0]!.points[29]!.leaguePoints).toBe(300);
  });
  it("paginates games and champion pools in SQL, filters regions and preserves unknown results", async () => {
    await savePatchCatalog(pool, ["16.22.1"], now);
    const template = JSON.parse(
      readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: {
        queueId: number;
        platformId: string;
        participants: { championId: number; win?: boolean; kills?: number }[];
      };
    };
    for (let index = 0; index < 28; index++) {
      const raw = structuredClone(template);
      const platform = index === 27 ? "kr" : "euw1";
      const matchId = platform.toUpperCase() + "_" + (9000000000 + index);
      raw.metadata.matchId = matchId;
      raw.info.platformId = platform.toUpperCase();
      raw.info.queueId = index === 26 ? 450 : 420;
      raw.info.participants[0]!.championId = index === 0 ? 103 : 1000 + index;
      if (index === 1) {
        delete raw.info.participants[0]!.win;
        delete raw.info.participants[0]!.kills;
      }
      await saveMatchIds(
        pool,
        { puuid, platform, region: platform === "kr" ? "asia" : "europe", patchKey: "16.22" },
        [matchId],
        100,
        now,
      );
      await saveRiotMatch(pool, parseRiotMatch(raw, matchId), raw, now);
    }
    const first = (await queries.summoner({ puuid, region: "euw1" }))!;
    expect(first.games.total).toBe(26);
    expect(first.games.items).toHaveLength(25);
    expect(first.champions.total).toBe(26);
    expect(first.champions.items).toHaveLength(25);
    expect(first.champions.items[1]!.winRate).toEqual({ value: null, sampleCount: 0 });
    expect(first.games.items[1]).toMatchObject({ win: null, kills: null });
    expect(first.history).toEqual([]);
    expect(first.gameName).toBeNull();
    const second = (await queries.summoner({ puuid, region: "euw1", page: 2, championPage: 2 }))!;
    expect(second.games.items).toHaveLength(1);
    expect(second.champions.items).toHaveLength(1);
    expect(first.games.items.map((g) => g.matchId)).not.toContain(second.games.items[0]!.matchId);
    expect((await queries.summoner({ puuid }))!.games.total).toBe(27);
    expect((await queries.summoner({ puuid, region: "kr" }))!.games.total).toBe(1);
    const beyond = (await queries.summoner({ puuid, page: 100, championPage: 100 }))!;
    expect(beyond.games.items).toEqual([]);
    expect(beyond.games.total).toBe(27);
    expect(beyond.champions.items).toEqual([]);
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    const ahri = (await queries.summoner({ puuid }))!.champions.items[0]!;
    expect(ahri.name).toBe("Ahri");
    expect(ahri.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
    expect(ahri.winRate).toEqual({ value: 1, sampleCount: 1 });
  });
});

describe("pro account link imports", () => {
  const a = "a".repeat(78),
    b = "b".repeat(78),
    c = "c".repeat(78);
  async function importLinks(value: unknown = proAccountFixture()) {
    const file = join(directory, randomUUID() + ".json");
    await writeFile(file, JSON.stringify(value));
    return run({ kind: "pro-account-links", file });
  }
  it("imports exact source identities with evidence, repeats safely and keeps absent links", async () => {
    await importCsv();
    const sources = (await queries.status()).sources,
      calls = fetcher.mock.calls.length;
    const file = proAccountFixture([proAccountFixtureLink(), proAccountFixtureLink("b", "10-top")]);
    expect((await importLinks(file)).state).toBe("done");
    const first = (await queries.proAccountLink(a))!;
    expect(first.player).toMatchObject({
      id: "oracle:player:10-mid",
      source: "oracle",
      sourceId: "10-mid",
      kind: "player",
    });
    expect(first.evidence).toEqual(file.links[0]!.evidence);
    expect(first.sourceSha256).toBe(
      createHash("sha256").update(JSON.stringify(file)).digest("hex"),
    );
    expect(first.importedAt).toBe(now.toISOString());
    expect(first.formatVersion).toBe(1);
    expect((await importLinks(file)).state).toBe("done");
    expect(await queries.proAccountLink(a)).toEqual(first);
    instant = new Date(now.getTime() + 1000);
    const correction = proAccountFixture([
      { ...file.links[0]!, evidence: [{ url: "https://example.invalid/new-evidence" }] },
    ]);
    expect((await importLinks(correction)).state).toBe("done");
    expect((await queries.proAccountLink(a))!.evidence).toEqual(correction.links[0]!.evidence);
    expect((await queries.proAccountLink(a))!.importedAt).toBe(instant.toISOString());
    expect((await queries.proAccountLink(b))!.player.sourceId).toBe("10-top");
    expect(await queries.proAccountLink(c)).toBeNull();
    await expect(queries.proAccountLink("a name")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(calls);
    expect((await queries.status()).sources).toEqual(sources);
  });
  it("rejects a whole file for invalid rows, unknown players, team IDs or conflicting evidence targets", async () => {
    await importCsv();
    expect((await importLinks()).state).toBe("done");
    const prior = await queries.proAccountLink(a);
    const invalidRows = [
      { ...proAccountFixtureLink("b"), evidence: [] },
      proAccountFixtureLink("b", "missing"),
      proAccountFixtureLink("b", "10"),
      proAccountFixtureLink("b", "Player Blue mid"),
      proAccountFixtureLink("a", "10-top"),
    ];
    for (const invalid of invalidRows) {
      expect(
        (await importLinks({ formatVersion: 1, links: [proAccountFixtureLink("c"), invalid] }))
          .state,
      ).toBe("failed");
      expect(await queries.proAccountLink(c)).toBeNull();
      expect(await queries.proAccountLink(a)).toEqual(prior);
      expect((await queries.status()).jobs[0]?.error).toMatch(
        /Saved links are unchanged|saved links are unchanged/,
      );
    }
    const directoryResult = await run({ kind: "pro-account-links", file: directory });
    expect(directoryResult.state).toBe("failed");
    const invalidUtf = join(directory, "invalid-utf.json");
    await writeFile(invalidUtf, Buffer.from([255]));
    expect((await run({ kind: "pro-account-links", file: invalidUtf })).state).toBe("failed");
    expect((await queries.status()).jobs[0]?.error).toMatch(/UTF-8/);
    const large = join(directory, "large-links.json");
    await writeFile(large, "");
    await truncate(large, 5 * 1024 * 1024 + 1);
    expect((await run({ kind: "pro-account-links", file: large })).state).toBe("failed");
    expect((await queries.status()).jobs[0]?.error).toMatch(/5 MiB/);
    expect(await queries.proAccountLink(a)).toEqual(prior);
  });
  it("rolls back all links on a persistence failure", async () => {
    await importCsv();
    await importLinks();
    const prior = await queries.proAccountLink(a);
    await pool.query(
      "CREATE FUNCTION reject_pro_link_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_pro_link_fixture BEFORE INSERT OR UPDATE ON pro_account_links FOR EACH ROW EXECUTE FUNCTION reject_pro_link_fixture()",
    );
    try {
      expect(
        (
          await importLinks(
            proAccountFixture([proAccountFixtureLink(), proAccountFixtureLink("b")]),
          )
        ).state,
      ).toBe("failed");
    } finally {
      await pool.query("DROP TRIGGER reject_pro_link_fixture ON pro_account_links");
      await pool.query("DROP FUNCTION reject_pro_link_fixture()");
    }
    expect(await queries.proAccountLink(a)).toEqual(prior);
    expect(await queries.proAccountLink(b)).toBeNull();
  });
});

describe("pro solo queue feed", () => {
  async function linkAccounts() {
    const file = join(directory, "feed-links.json");
    await writeFile(
      file,
      JSON.stringify(
        proAccountFixture([
          proAccountFixtureLink(),
          proAccountFixtureLink("b", "11-mid"),
          proAccountFixtureLink("c"),
        ]),
      ),
    );
    expect((await run({ kind: "pro-account-links", file })).state).toBe("done");
  }
  async function match(index = 0, queue = 420) {
    await savePatchCatalog(pool, ["16.22.1"], now);
    const raw = JSON.parse(
      await readFile(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
    ) as {
      metadata: { matchId: string };
      info: { queueId: number; gameStartTimestamp: number; participants: { win?: boolean }[] };
    };
    const id = "EUW1_" + (9000000000 + index);
    raw.metadata.matchId = id;
    raw.info.queueId = queue;
    raw.info.gameStartTimestamp = now.getTime() + index * 60000;
    delete raw.info.participants[1]!.win;
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: "16.22" },
      [id],
      100,
      now,
    );
    await saveRiotMatch(pool, parseRiotMatch(raw, id), raw, now);
  }
  it("lists only linked ranked games in stable time order, with SQL filters and bounded pages", async () => {
    expect((await queries.proFeed({})).page.total).toBe(0);
    await importCsv();
    await match(0);
    await match(1);
    await match(2, 450);
    expect((await queries.proFeed({})).page.total).toBe(0);
    await linkAccounts();
    const calls = fetcher.mock.calls.length;
    const first = await queries.proFeed({ pageSize: 2 });
    expect(first.page.total).toBe(6);
    expect(first.page.items.map((r) => [r.matchId, r.participantId])).toEqual([
      ["EUW1_9000000001", 1],
      ["EUW1_9000000001", 2],
    ]);
    expect(first.page.items[0]).toMatchObject({
      player: { id: "oracle:player:10-mid", publicSlug: "player-blue-mid" },
      team: { id: "oracle:team:10" },
      league: "LCK",
      sourceIdentityId: "oracle:player:10-mid",
      championName: "Ahri",
      imageUrl: null,
    });
    expect(first.page.items[1]!.win).toBeNull();
    const second = await queries.proFeed({ pageSize: 2, page: 2 });
    expect(second.page.items.map((r) => [r.matchId, r.participantId])).toEqual([
      ["EUW1_9000000001", 3],
      ["EUW1_9000000000", 1],
    ]);
    expect((await queries.proFeed({ team: "oracle:team:10", league: "LCK" })).page.total).toBe(4);
    expect((await queries.proFeed({ team: "oracle:team:11" })).page.total).toBe(2);
    expect((await queries.proFeed({ league: "LEC" })).page.total).toBe(0);
    expect((await queries.proFeed({ team: "not-stored" })).page.total).toBe(0);
    expect((await queries.proFeed({ page: 100 })).page).toMatchObject({ total: 6, items: [] });
    expect(first.teams.map((t) => t.id)).toEqual(["oracle:team:10", "oracle:team:11"]);
    expect(first.leagues).toEqual(["LCK"]);
    expect(fetcher.mock.calls.length).toBe(calls);
    for (const input of [
      { page: 0 },
      { pageSize: 101 },
      { team: ["a", "b"] },
      { league: "x".repeat(301) },
      { team: "\0" },
      { league: "\ud800" },
      { extra: "x" },
    ])
      await expect(queries.proFeed(input as { page: number })).rejects.toThrow();
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    const known = (await queries.proFeed({})).page.items[0]!;
    expect(known.championId).toBe("Ahri");
    expect(known.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
  });
  it("keeps missing and conflicting latest pro affiliations unknown", async () => {
    await importCsv(historyCsv({ completeness: "partial" }));
    await linkAccounts();
    await match();
    expect((await queries.proFeed({})).page.items[0]).toMatchObject({
      team: null,
      league: null,
      proObservedAt: null,
    });
    await importCsv();
    await importCsv(
      historyCsv({ id: "conflicting-appearance", league: "LEC" }).replaceAll(
        ",10,Acceptance Blue,",
        ",12,Other Blue,",
      ),
    );
    const result = await queries.proFeed({});
    expect(result.page.items[0]).toMatchObject({ team: null, league: null });
    expect(result.page.items[0]!.proObservedAt).not.toBeNull();
    expect((await queries.proFeed({ team: "oracle:team:10" })).page.total).toBe(0);
    expect((await queries.proFeed({ league: "LCK" })).page.total).toBe(0);
  });
  it("uses the corroborated canonical player for a linked provider identity without duplicating games", async () => {
    await importCsv();
    fetcher.mockImplementation((input) =>
      Promise.resolve(
        json(
          endpoint(input).includes("/teams")
            ? [
                {
                  id: 10,
                  name: "Acceptance Blue",
                  players: ["top", "jng", "mid", "bot", "sup"].map((role, i) => ({
                    id: 30 + i,
                    name: `Player Blue ${role}`,
                    role,
                  })),
                },
              ]
            : [rawMatch()],
        ),
      ),
    );
    expect((await run({ kind: "matches" })).state).toBe("done");
    expect((await run({ kind: "rosters" })).state).toBe("done");
    expect((await run({ kind: "entities" })).state).toBe("done");
    const file = join(directory, "provider-link.json");
    await writeFile(
      file,
      JSON.stringify(
        proAccountFixture([
          { ...proAccountFixtureLink(), player: { source: "pandascore", sourceId: "32" } },
        ]),
      ),
    );
    expect((await run({ kind: "pro-account-links", file })).state).toBe("done");
    await match();
    const result = await queries.proFeed({ team: "oracle:team:10" });
    expect(result.page.total).toBe(1);
    expect(result.page.items[0]).toMatchObject({
      sourceIdentityId: "pandascore:player:32",
      player: { id: "oracle:player:10-mid" },
      team: { id: "oracle:team:10" },
      league: "LCK",
    });
  });
});

describe("champion trends", () => {
  async function aggregate({
    patch = "16.22",
    source = "solo",
    champion = 103,
    role = "MIDDLE",
    region = "europe",
    queue = source === "solo" ? "420" : "pro",
    picks = 100,
    results = 100,
    wins = 50,
    slice = 1000,
  }: {
    patch?: string;
    source?: string;
    champion?: number;
    role?: string;
    region?: string;
    queue?: string;
    picks?: number;
    results?: number;
    wins?: number;
    slice?: number;
  } = {}) {
    await pool.query(
      `INSERT INTO champion_aggregates(source,patch_key,queue,region,tier,champion_key,role,games,result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate,built_at)
  VALUES($1,$2,$3,$4,'TEST',$5,$6,$7,$8,$9,NULL,$10,NULL,NULL,NULL,$11)`,
      [source, patch, queue, region, champion, role, picks, results, wins, slice, now],
    );
  }
  it("compares aggregate-only counts with deduplicated sample pools, source and role isolation", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    await aggregate({ wins: 80 });
    await aggregate({ patch: "16.21", wins: 20, results: 50, picks: 50 });
    await aggregate({ region: "asia", picks: 50, results: 50, wins: 40, slice: 500 });
    await aggregate({
      patch: "16.21",
      region: "asia",
      picks: 25,
      results: 25,
      wins: 10,
      slice: 500,
    });
    await aggregate({ role: "TOP", wins: 10 });
    await aggregate({ patch: "16.21", role: "TOP", wins: 90 });
    await aggregate({ champion: 157, wins: 50 });
    await aggregate({ patch: "16.21", champion: 157, wins: 50 });
    await aggregate({
      queue: "450",
      champion: 999,
      picks: 999,
      results: 999,
      wins: 999,
      slice: 999,
    });
    await aggregate({ source: "pro", wins: 10 });
    await aggregate({ source: "pro", patch: "16.21", wins: 90 });
    const calls = fetcher.mock.calls.length;
    const data = await queries.trending({ role: "MIDDLE" });
    expect(data.patch).toBe("16.22");
    expect(data.previousPatch).toBe("16.21");
    expect(data.currentGames).toBe(1500);
    expect(data.previousGames).toBe(1500);
    expect(data.page.total).toBe(2);
    expect(data.page.items[0]!.pickRate).toMatchObject({
      current: { value: 0.1, sampleCount: 1500 },
      previous: { value: 0.05, sampleCount: 1500 },
      direction: "rising",
    });
    expect(data.page.items[0]!.winRate).toMatchObject({
      current: { value: 0.8, sampleCount: 150 },
      previous: { value: 0.4, sampleCount: 75 },
      direction: "rising",
    });
    expect(data.page.items[1]!.winRate).toMatchObject({ delta: 0, direction: null });
    expect((await queries.trending({ role: "TOP" })).page.items[0]!.winRate.direction).toBe(
      "falling",
    );
    expect(
      (await queries.trending({ source: "pro", role: "MIDDLE" })).page.items[0]!.winRate.direction,
    ).toBe("falling");
    expect(fetcher.mock.calls.length).toBe(calls);
    expect(
      (
        await pool.query(
          "SELECT (SELECT count(*)::integer FROM riot_matches) AS solo,(SELECT count(*)::integer FROM oracle_archive_games) AS pro",
        )
      ).rows[0],
    ).toEqual({ solo: 0, pro: 0 });
    serveDataDragon(["16.22.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    const known = (await queries.trending({ role: "MIDDLE" })).page.items[0]!;
    expect(known).toMatchObject({ championId: "Ahri", name: "Ahri" });
    expect(known.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
  });
  it("never substitutes older data for the preceding catalog patch and preserves missing champions", async () => {
    expect((await queries.trending({})).patch).toBeNull();
    await savePatchCatalog(pool, ["16.22.1", "16.21.1", "16.20.1"], now);
    await aggregate({});
    await aggregate({ patch: "16.20", wins: 90 });
    let data = await queries.trending({ role: "MIDDLE" });
    expect(data.previousPatch).toBe("16.21");
    expect(data.previousGames).toBe(0);
    expect(data.page.items[0]!.pickRate.delta).toBeNull();
    expect(data.page.items[0]!.winRate.delta).toBeNull();
    await aggregate({ patch: "16.21", champion: 157 });
    data = await queries.trending({ role: "MIDDLE" });
    expect(data.page.total).toBe(2);
    expect(data.page.items.map((r) => r.winRate.delta)).toEqual([null, null]);
    expect(data.page.items.map((r) => r.pickRate.delta)).toEqual([null, null]);
    expect((await queries.trending({ patch: "16.20", role: "MIDDLE" })).previousPatch).toBeNull();
    expect((await queries.trending({ patch: "16.99" })).patch).toBeNull();
    expect((await queries.trending({ source: "pro" })).page.total).toBe(0);
  });
  it("bounds SQL pages and keeps zero results and inconsistent aggregate proportions unknown", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    for (let champion = 1; champion <= 51; champion++) {
      await aggregate({
        champion,
        role: "ALL",
        wins: champion === 1 ? 0 : 80,
        results: champion === 1 ? 0 : 100,
        picks: champion === 1 ? 1001 : 100,
      });
      await aggregate({ patch: "16.21", champion, role: "ALL" });
    }
    const first = await queries.trending({});
    expect(first.page.total).toBe(51);
    expect(first.page.items).toHaveLength(50);
    expect(first.page.items[0]).toMatchObject({
      championId: null,
      name: null,
      imageUrl: null,
      pickRate: { delta: null },
      winRate: { delta: null },
    });
    const second = await queries.trending({ page: 2 });
    expect(second.page.items.map((r) => r.championKey)).toEqual([51]);
    expect((await queries.trending({ page: 100 })).page).toMatchObject({ total: 51, items: [] });
    for (const input of [
      { page: 0 },
      { page: 10001 },
      { source: "other" },
      { patch: "16.22.1" },
      { role: "SUPPORT" },
      { source: ["solo", "pro"] },
    ])
      await expect(queries.trending(input as { page: number })).rejects.toThrow();
  });
});

describe("patch overviews", () => {
  async function core(
    patch: string,
    champion: number,
    build: string,
    games: number,
    role = "MIDDLE",
    queue = "420",
  ) {
    await pool.query(
      `INSERT INTO champion_builds(patch_key,queue,region,tier,champion_key,role,kind,build,games,result_games,wins,built_at)
      VALUES($1,$2,'europe','TEST',$3,$4,'path',$5,$6,$6,0,$7)`,
      [patch, queue, champion, role, build, games, now],
    );
  }
  async function pro(champion: number, picks: number, bans: number, games: number, league = "LCK") {
    await pool.query(
      `INSERT INTO pro_champion_stats(patch_key,league,champion_key,league_games,picks,bans,
      result_picks,wins,blue_picks,blue_result_picks,blue_wins,red_picks,red_result_picks,red_wins,blind_picks,counter_picks,built_at)
      VALUES('16.22',$1,$2,$3,$4,$5,0,0,0,0,0,0,0,0,0,0,$6)`,
      [league, champion, games, picks, bans, now],
    );
  }
  it("ranks significant aggregate-only changes before limiting and agrees with full trends", async () => {
    await savePatchCatalog(pool, ["16.22.1", "16.21.1"], now);
    await pool.query(
      `INSERT INTO champion_aggregates(source,patch_key,queue,region,tier,champion_key,role,games,result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate,built_at)
      SELECT 'solo',patch,'420','europe','TEST',champ,'ALL',100,100,
        CASE WHEN champ=99 THEN CASE WHEN patch='16.22' THEN 100 ELSE 0 END
          WHEN patch='16.21' THEN 50 WHEN champ<=12 THEN 70+champ ELSE 30-(champ-12) END,
        NULL,1000,NULL,NULL,NULL,$1
      FROM (SELECT generate_series(1,24) AS champ UNION SELECT 99) c
      CROSS JOIN (VALUES('16.22'),('16.21')) p(patch)`,
      [now],
    );
    const calls = fetcher.mock.calls.length;
    const page = await queries.patchOverview("16.22");
    expect(page?.risers.map((r) => r.championKey)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(page?.fallers.map((r) => r.championKey)).toEqual([
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15,
    ]);
    const full = await queries.trending({ patch: "16.22" });
    for (const r of [...page!.risers, ...page!.fallers]) {
      expect(r.metric).toBe("win");
      expect(r.change).toEqual(
        full.page.items.find((c) => c.championKey === r.championKey)!.winRate,
      );
    }
    expect(page?.risers[0]).toMatchObject({
      championId: null,
      name: null,
      imageUrl: null,
      change: { current: { sampleCount: 100 }, previous: { sampleCount: 100 } },
    });
    expect(fetcher.mock.calls.length).toBe(calls);
    expect(
      (await pool.query<{ n: number }>("SELECT count(*)::integer AS n FROM riot_matches")).rows[0]!
        .n,
    ).toBe(0);
    // A region contributes to the pool once, regardless of champion rows. Role and queue stay scoped.
    await pool.query(
      `UPDATE champion_aggregates SET games=CASE WHEN patch_key='16.22' THEN 800 ELSE 200 END WHERE champion_key=1`,
    );
    expect((await queries.patchOverview("16.22"))?.risers[0]).toMatchObject({
      championKey: 1,
      metric: "pick",
      change: { current: { sampleCount: 1000 } },
    });
    expect((await queries.patchOverview("16.22"))?.risers[0]?.change.delta).toBeCloseTo(0.6);
    await pool.query("UPDATE champion_aggregates SET role='MIDDLE' WHERE champion_key=1");
    expect((await queries.patchOverview("16.22"))?.risers.some((r) => r.championKey === 1)).toBe(
      false,
    );
    await pool.query("UPDATE champion_aggregates SET queue='450'");
    expect((await queries.patchOverview("16.22"))?.risers).toEqual([]);
  });
  it("requires preceding core coverage, excludes existing builds and deduplicates pro samples", async () => {
    serveDataDragon(["16.22.1", "16.21.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    await core("16.21", 103, "1001,2003,3340", 50);
    await core("16.22", 103, "3001,3002,3003", 50);
    await core("16.22", 103, "1001,2003,3340", 100);
    await core("16.22", 103, "3001,3002,3004", 49);
    await core("16.22", 103, "3001,3002,3005", 1000, "TOP");
    await core("16.22", 103, "3001,3002,3006", 1000, "MIDDLE", "450");
    await core("16.21", 157, "1001,2003,3340", 49);
    await core("16.22", 157, "3001,3002,3003", 1000);
    await pro(103, 6, 4, 20);
    await pro(157, 4, 1, 20);
    await pro(103, 2, 3, 10, "LEC");
    await pro(999, 0, 1, 10, "LEC");
    const result = await queries.patchOverview("16.22");
    expect(result?.builds).toHaveLength(1);
    expect(result?.builds[0]).toMatchObject({
      championKey: 103,
      name: "Ahri",
      games: 50,
      previousSample: 50,
      share: { value: 50 / 199, sampleCount: 199 },
      items: [{ id: 3001 }, { id: 3002 }, { id: 3003 }],
    });
    expect(result?.builds[0]?.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
    expect(result?.pro.map((r) => r.championKey)).toEqual([103, 157, 999]);
    expect(result?.pro[0]).toMatchObject({
      picks: 8,
      bans: 7,
      presence: { value: 0.5, sampleCount: 30 },
      sample: "low-sample",
    });
    await pool.query("UPDATE pro_champion_stats SET league_games=100");
    expect((await queries.patchOverview("16.22"))?.pro[0]?.sample).toBe("shown");
    await pool.query("UPDATE pro_champion_stats SET league_games=4");
    expect((await queries.patchOverview("16.22"))?.pro).toEqual([]);
  });
  it("caps new-build and pro lists after ranking and keeps item catalog identities", async () => {
    serveDataDragon(["16.22.1", "16.21.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
    for (let champion = 1; champion <= 12; champion++) {
      await core("16.21", champion, "3001,3002,3003", 50);
      await core("16.22", champion, "1001,3002,3003", 50 + champion);
      await pro(champion, champion, 0, 100);
    }
    const result = await queries.patchOverview("16.22");
    expect(result?.builds.map((r) => r.championKey)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(result?.pro.map((r) => r.championKey)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(result?.builds[0]?.items[0]).toMatchObject({
      id: 1001,
      catalogId: "1001",
      name: "Boots",
    });
    expect(result?.builds[0]?.items[0]?.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{64}$/);
    expect(result?.builds[0]?.items[1]).toMatchObject({ id: 3002, name: null, imageUrl: null });
  });
  it("returns not found for unknown keys, empty low-data sections and never skips a catalog patch", async () => {
    expect(await queries.patchOverview("16.22")).toBeNull();
    for (const patch of ["16.22.1", "016.22", "16.022", "../16.22"])
      await expect(queries.patchOverview(patch)).rejects.toThrow();
    await savePatchCatalog(pool, ["16.22.1", "16.21.1", "16.20.1"], now);
    await core("16.20", 103, "1001,2003,3340", 500);
    await core("16.22", 103, "3001,3002,3003", 500);
    expect(await queries.patchOverview("16.22")).toEqual({
      patch: "16.22",
      previousPatch: "16.21",
      risers: [],
      fallers: [],
      builds: [],
      pro: [],
    });
    expect((await queries.patchOverview("16.20"))?.previousPatch).toBeNull();
    expect(await queries.patchOverview("16.99")).toBeNull();
    await core("16.21", 103, "1001,2003,3340", 50);
    expect((await queries.patchOverview("16.22"))?.builds).toHaveLength(1);
  });
});

describe("champion ladder players", () => {
  const id = (n: number) => `player_${n.toString().padStart(71, "0")}`;
  const entry = (puuid: string, tier: "CHALLENGER" | "MASTER" = "CHALLENGER") => ({
    puuid,
    summonerId: null,
    tier,
    rank: "I",
    leaguePoints: 500,
    wins: 50,
    losses: 50,
    leagueId: "players-fixture",
  });
  let sequence = 0;
  async function samples(
    puuid: string,
    games: number,
    wins: number,
    options: {
      results?: number;
      platform?: string;
      patch?: string;
      role?: string;
      queue?: number;
      remake?: boolean;
    } = {},
  ) {
    const {
      platform = "euw1",
      patch = "16.22",
      role = "MIDDLE",
      queue = 420,
      remake = false,
      results = games,
    } = options;
    const ids = Array.from(
      { length: games },
      () => `${platform.toUpperCase()}_${8800000000 + sequence++}`,
    );
    await saveMatchIds(
      pool,
      { puuid, platform, region: platform === "kr" ? "asia" : "europe", patchKey: patch },
      ids,
      1000,
      now,
    );
    await pool.query(
      `INSERT INTO riot_matches(match_id,game_version,platform_id,queue_id,patch_key,created_at,fetched_at,remake)
      SELECT id,$2,$3,$4,$5,$6,$6,$7 FROM unnest($1::text[]) ids(id)`,
      [ids, `${patch}.1`, platform.toUpperCase(), queue, patch, now, remake],
    );
    await pool.query(
      `INSERT INTO riot_match_participants(match_id,participant_id,puuid,team_id,side,champion_id,team_position,win)
      SELECT id,1,$2,100,'blue',103,$3,CASE WHEN ord<=$4 THEN ord<=$5 ELSE NULL END
      FROM unnest($1::text[]) WITH ORDINALITY ids(id,ord)`,
      [ids, puuid, role, results, wins],
    );
  }
  async function catalog() {
    serveDataDragon(["16.22.1", "16.21.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
  }
  async function overview(
    input: Parameters<typeof queries.championOverview>[0] = { champion: "Ahri" },
  ) {
    expect((await run({ kind: "aggregate" })).state).toBe("done");
    return queries.championOverview({ patch: "16.22", ...input });
  }
  it("requires ten games, sorts sampled rates with unknowns last and decorates linked pro accounts", async () => {
    await catalog();
    await importCsv();
    const a = "a".repeat(78),
      b = id(2),
      c = id(3),
      d = id(4);
    await saveLadder(pool, "euw1", [entry(a), entry(b), entry(c), entry(d)], now);
    await saveAccount(pool, { puuid: a, gameName: "Fixture player", tagLine: "EUW" }, now);
    await samples(a, 12, 6);
    await samples(b, 10, 9);
    await samples(c, 11, 1, { results: 1 });
    await samples(d, 9, 9);
    const file = join(directory, "champion-player-links.json");
    await writeFile(file, JSON.stringify(proAccountFixture([proAccountFixtureLink()])));
    expect((await run({ kind: "pro-account-links", file })).state).toBe("done");
    const data = await overview();
    expect(data?.players?.page).toMatchObject({ total: 3, pageSize: 20, page: 1 });
    expect(data?.players?.page.items.map((r) => r.puuid)).toEqual([a, c, b]);
    expect(data?.players?.page.items[0]).toMatchObject({
      gameName: "Fixture player",
      tagLine: "EUW",
      tier: "CHALLENGER",
      leaguePoints: 500,
      games: 12,
      winRate: { value: 0.5, sampleCount: 12 },
      pro: { id: "oracle:player:10-mid", name: "Player Blue mid" },
    });
    expect(data?.players?.page.items[1]).toMatchObject({
      gameName: null,
      pro: null,
      winRate: { value: null, sampleCount: 1 },
    });
    const sorted = await queries.championOverview({
      champion: "Ahri",
      patch: "16.22",
      playersSort: "winRate",
    });
    expect(sorted?.players?.page.items.map((r) => r.puuid)).toEqual([b, a, c]);
    expect(new Date(sorted!.players!.page.items[0]!.ladderObservedAt).toISOString()).toBe(
      now.toISOString(),
    );
    for (const input of [{ playersSort: "rank" }, { playersPage: 0 }, { playersPage: 1001 }])
      await expect(
        queries.championOverview({ champion: "Ahri", ...input } as Parameters<
          typeof queries.championOverview
        >[0]),
      ).rejects.toThrow();
    expect(
      (await queries.championOverview({ champion: "Ahri", source: "pro" }))?.players,
    ).toBeNull();
  });
  it("scopes by patch role region queue and current ladder membership without mixing platforms", async () => {
    await catalog();
    const a = id(1),
      removed = id(2);
    await saveLadder(pool, "euw1", [entry(removed)], new Date(now.getTime() - 1000));
    await saveLadder(pool, "euw1", [entry(a)], now);
    await saveLadder(pool, "kr", [entry(a, "MASTER")], now);
    await samples(a, 10, 7);
    await samples(a, 10, 3, { platform: "kr" });
    await samples(removed, 20, 20);
    await samples(a, 15, 15, { patch: "16.21" });
    await samples(a, 12, 12, { queue: 450 });
    await samples(a, 11, 11, { remake: true });
    await samples(a, 10, 4, { role: "TOP" });
    const all = await overview();
    expect(all?.players?.page.items.map((r) => [r.platform, r.games])).toEqual([
      ["euw1", 20],
      ["kr", 10],
    ]);
    const middle = await queries.championOverview({
      champion: "Ahri",
      patch: "16.22",
      role: "MIDDLE",
      region: "europe",
    });
    expect(middle?.players?.page.items).toHaveLength(1);
    expect(middle?.players?.page.items[0]).toMatchObject({
      platform: "euw1",
      games: 10,
      winRate: { value: 0.7, sampleCount: 10 },
    });
    const master = await queries.championOverview({
      champion: "Ahri",
      patch: "16.22",
      tier: "MASTER",
    });
    expect(master?.players?.page.items.map((r) => r.platform)).toEqual(["kr"]);
    await recordLadderFailure(pool, "euw1", "fixture failure");
    expect(
      (
        await queries.championOverview({
          champion: "Ahri",
          patch: "16.22",
          role: "MIDDLE",
          region: "europe",
        })
      )?.players?.page,
    ).toEqual(middle?.players?.page);
    expect(
      (await queries.championOverview({ champion: "Ahri", patch: "16.21" }))?.players?.page.items[0]
        ?.games,
    ).toBe(15);
  });
  it("bounds pages after eligibility, retains totals on empty pages and uses stable tie ordering", async () => {
    await catalog();
    const ids = Array.from({ length: 21 }, (_, n) => id(n));
    await saveLadder(
      pool,
      "euw1",
      ids.map((p) => entry(p)),
      now,
    );
    for (const p of ids) await samples(p, 10, 5);
    const first = await overview();
    expect(first?.players?.page.total).toBe(21);
    expect(first?.players?.page.items.map((r) => r.puuid)).toEqual(ids.slice(0, 20));
    const second = await queries.championOverview({
      champion: "Ahri",
      patch: "16.22",
      playersPage: 2,
    });
    expect(second?.players?.page.items.map((r) => r.puuid)).toEqual(ids.slice(20));
    expect(
      (await queries.championOverview({ champion: "Ahri", patch: "16.22", playersPage: 1000 }))
        ?.players?.page,
    ).toMatchObject({ items: [], total: 21 });
    expect(
      (await queries.championOverview({ champion: "Ahri", patch: "16.22", region: "missing" }))
        ?.players?.page.total,
    ).toBe(0);
  });
});

describe("lane matchup aggregates", () => {
  const template = JSON.parse(
    readFileSync(new URL("../../tests/riot/match-euw1.json", import.meta.url), "utf8"),
  ) as {
    metadata: { matchId: string };
    info: {
      queueId: number;
      gameVersion: string;
      participants: { championId: number; teamPosition: string; win?: boolean }[];
      teams: { teamId: number; objectives: Record<string, { first?: boolean; kills?: number }> }[];
    };
  };
  let sequence = 0;
  async function catalog() {
    serveDataDragon(["16.22.1", "16.21.1"]);
    expect((await run({ kind: "metadata" })).state).toBe("done");
  }
  async function game(
    opponent: number,
    won: boolean,
    gold: number,
    options: {
      missing15?: boolean;
      missingCs?: boolean;
      unknownResult?: boolean;
      queue?: number;
      patch?: string;
      ambiguous?: boolean;
      missingOpponent?: boolean;
      missingObjectives?: boolean;
    } = {},
  ) {
    const raw = structuredClone(template),
      matchId = `EUW1_${8900000000 + sequence++}`;
    const patch = options.patch ?? "16.22";
    raw.metadata.matchId = matchId;
    raw.info.gameVersion = `${patch}.1`;
    raw.info.queueId = options.queue ?? 420;
    for (const p of raw.info.participants) p.teamPosition = "";
    const blue = raw.info.participants[0]!,
      red = raw.info.participants[5]!;
    blue.championId = 103;
    blue.teamPosition = "MIDDLE";
    blue.win = won;
    red.championId = opponent;
    red.teamPosition = options.missingOpponent ? "" : "MIDDLE";
    red.win = !won;
    if (options.unknownResult) delete blue.win;
    if (options.ambiguous) raw.info.participants[1]!.teamPosition = "MIDDLE";
    for (const team of raw.info.teams) {
      team.objectives.champion = { first: team.teamId === 100 ? won : !won, kills: 5 };
      team.objectives.tower = { first: team.teamId === 100 ? !won : won, kills: 5 };
      if (options.missingObjectives) {
        delete team.objectives.champion;
        delete team.objectives.tower;
      }
    }
    await saveMatchIds(
      pool,
      { puuid: "a".repeat(78), platform: "euw1", region: "europe", patchKey: patch },
      [matchId],
      1000,
      now,
    );
    await saveRiotMatch(pool, parseRiotMatch(raw, matchId), raw, now);
    const frames = [10, 15].flatMap((minute) =>
      [1, 6]
        .filter((id) => !(options.missing15 && minute === 15 && id === 6))
        .map((participantId) => ({
          participantId,
          minute,
          timestampMs: minute * 60000,
          x: null,
          y: null,
          currentGold: null,
          totalGold: 4000 + (participantId === 1 ? gold : 0),
          xp: 3000 + (participantId === 1 ? gold * 2 : 0),
          level: 10,
          minionsKilled: participantId === 1 ? 100 : 90,
          jungleMinionsKilled: options.missingCs && participantId === 1 ? null : 10,
        })),
    );
    await saveTimeline(pool, { matchId, frames, events: [] }, now);
    return matchId;
  }
  const aggregate = async () => expect((await run({ kind: "aggregate" })).state).toBe("done");
  it("matches hand-counted rates and checkpoint differences, then shrinks against all opponents", async () => {
    await catalog();
    for (let n = 0; n < 10; n++)
      await game(20, n < 8, 100, { missing15: n === 0, missingCs: n === 0 });
    for (let n = 0; n < 10; n++) await game(62, n < 2, -50);
    const unknown = await game(999, true, 9000, { unknownResult: true, missingObjectives: true });
    await saveTimeline(pool, { matchId: unknown, frames: [], events: [] }, now);
    await game(999, true, 9000, { queue: 450 });
    await game(999, true, 9000, { patch: "16.21" });
    await aggregate();
    const calls = fetcher.mock.calls.length;
    const data = await queries.championMatchups({
      champion: "Ahri",
      patch: "16.22",
      sort: "winRate",
      pageSize: 1,
    });
    expect(data?.page).toMatchObject({ total: 3, pageSize: 1 });
    const row = data!.page.items[0]!;
    expect(row.opponent).toMatchObject({
      championKey: 20,
      championId: "Nunu",
      name: "Nunu & Willump",
    });
    expect(row.games).toBe(10);
    expect(row.metrics.winRate).toEqual({
      raw: 0.8,
      shrunk: 0.55,
      sampleCount: 10,
      baseline: 0.5,
      baselineSampleCount: 20,
    });
    expect(row.metrics.gold10).toEqual({
      raw: 100,
      shrunk: 37.5,
      sampleCount: 10,
      baseline: 25,
      baselineSampleCount: 20,
    });
    expect(row.metrics.xp10).toMatchObject({ raw: 200, shrunk: 75, sampleCount: 10 });
    expect(row.metrics.cs10).toMatchObject({
      raw: null,
      shrunk: null,
      sampleCount: 9,
      baseline: 10,
      baselineSampleCount: 19,
    });
    expect(row.metrics.gold15).toMatchObject({ raw: null, shrunk: null, sampleCount: 9 });
    expect(row.metrics.firstBlood).toMatchObject({ raw: 0.8, shrunk: 0.55, sampleCount: 10 });
    expect(row.metrics.firstTower).toMatchObject({ raw: 0.2, shrunk: 0.45, sampleCount: 10 });
    const second = await queries.championMatchups({
      champion: "Ahri",
      patch: "16.22",
      sort: "winRate",
      pageSize: 1,
      page: 2,
    });
    expect(second?.page.items[0]?.opponent.championKey).toBe(62);
    expect(second?.page.items[0]?.metrics.gold10.shrunk).toBe(12.5);
    expect(
      (
        await queries.championMatchups({
          champion: "Ahri",
          patch: "16.22",
          sort: "winRate",
          value: "raw",
          order: "asc",
        })
      )?.page.items[0]?.opponent.championKey,
    ).toBe(62);
    expect(
      (await queries.championMatchups({ champion: "Ahri", patch: "16.22", page: 10000 }))?.page,
    ).toMatchObject({ total: 3, items: [] });
    const last = await queries.championMatchups({
      champion: "Ahri",
      patch: "16.22",
      sort: "winRate",
      pageSize: 1,
      page: 3,
    });
    expect(last?.page.items[0]).toMatchObject({
      opponent: { championKey: 999, championId: null, name: null, imageUrl: null },
      metrics: { winRate: { raw: null, shrunk: null, sampleCount: 0 } },
    });
    expect(fetcher.mock.calls.length).toBe(calls);
    expect(await queries.championMatchups({ champion: "Unknown" })).toBeNull();
    expect(
      (await queries.championMatchups({ champion: "Ahri", patch: "16.99" }))?.patch,
    ).toBeNull();
    expect((await queries.championMatchups({ champion: "Ahri", role: "TOP" }))?.page.items).toEqual(
      [],
    );
    expect((await queries.championMatchups({ champion: "Ahri", source: "pro" }))?.patch).toBeNull();
  });
  it("counts unpairable games once per role and preserves missing metrics through rebuilds", async () => {
    await catalog();
    const valid = await game(20, true, 100, { unknownResult: true, missingObjectives: true });
    await game(20, true, 100, { ambiguous: true });
    await game(20, true, 100, { missingOpponent: true });
    await aggregate();
    let data = await queries.championMatchups({ champion: "Ahri", patch: "16.22" });
    expect(data?.page.items[0]).toMatchObject({
      games: 1,
      metrics: {
        winRate: { raw: null, shrunk: null, sampleCount: 0 },
        firstBlood: { raw: null, sampleCount: 0 },
        gold10: { raw: null, sampleCount: 1 },
      },
    });
    expect(data?.exclusions.find((r) => r.role === "MIDDLE")).toEqual({
      role: "MIDDLE",
      games: 2,
      participants: 4,
      unknownRole: 0,
      ambiguousRole: 3,
      missingOpponent: 1,
      unmappedChampion: 0,
    });
    expect(data?.exclusions.find((r) => r.role === "UNKNOWN")).toMatchObject({
      games: 3,
      participants: 24,
      unknownRole: 24,
    });
    // A replacement timeline changes its sample, without duplicating the game or other source rows.
    await saveTimeline(pool, { matchId: valid, frames: [], events: [] }, now);
    await aggregate();
    data = await queries.championMatchups({ champion: "Ahri", patch: "16.22" });
    expect(data?.page.items[0]?.games).toBe(1);
    expect(data?.page.items[0]?.metrics.gold10).toMatchObject({ raw: null, sampleCount: 0 });
    expect((await run({ kind: "aggregate", rebuild: true })).state).toBe("done");
    expect((await queries.championMatchups({ champion: "Ahri", patch: "16.22" }))?.page).toEqual(
      data?.page,
    );
    await pool.query("UPDATE riot_matches SET remake=true WHERE match_id=$1", [valid]);
    expect((await run({ kind: "aggregate", rebuild: true })).state).toBe("done");
    expect(
      (await queries.championMatchups({ champion: "Ahri", patch: "16.22" }))?.page.items,
    ).toEqual([]);
    const excluded = await queries.championMatchups({ champion: "Ahri" });
    expect(excluded).toMatchObject({ patch: "16.22", patches: ["16.22"], page: { items: [] } });
    expect(excluded?.exclusions.find((r) => r.role === "MIDDLE")?.games).toBe(2);
  });
  it("pages both matrix axes in SQL while keeping the full baseline and sparse cells", async () => {
    await catalog();
    for (let n = 0; n < 10; n++) await game(20, n < 8, 100);
    for (let n = 0; n < 10; n++) await game(62, n < 2, -50);
    for (let n = 200; n < 208; n++) await game(n, false, 0);
    await aggregate();
    const calls = fetcher.mock.calls.length;
    const matrix = await queries.matchupMatrix({ role: "MIDDLE" });
    expect(matrix).toMatchObject({ patch: "16.22", patches: ["16.22"], total: 11, pageSize: 8 });
    expect(matrix.rows.map((c) => c.championKey)).toEqual([103, 20, 62, 200, 201, 202, 203, 204]);
    expect(matrix.columns).toEqual(matrix.rows);
    expect(matrix.cells).toHaveLength(64);
    const cell = matrix.cells.find((c) => c.championKey === 103 && c.opponentKey === 20)!;
    expect(cell).toMatchObject({
      games: 10,
      estimate: { raw: 0.8, sampleCount: 10, baselineSampleCount: 28 },
    });
    expect(cell.estimate.baseline).toBeCloseTo(10 / 28);
    expect(cell.estimate.shrunk).toBeCloseTo((8 + (50 * 10) / 28) / 60);
    expect(
      matrix.cells.find((c) => c.championKey === 103 && c.opponentKey === 200)?.estimate,
    ).toMatchObject({ raw: null, shrunk: null, sampleCount: 1 });
    expect(matrix.cells.find((c) => c.championKey === 103 && c.opponentKey === 103)).toMatchObject({
      games: 0,
      estimate: { raw: null, shrunk: null, sampleCount: 0 },
    });
    const second = await queries.matchupMatrix({
      role: "MIDDLE",
      page: 2,
      columnPage: 2,
      metric: "gold10",
      value: "raw",
    });
    expect(second.rows.map((c) => c.championKey)).toEqual([205, 206, 207]);
    expect(second.rows[0]).toMatchObject({ championId: null, name: null, imageUrl: null });
    expect(second.cells).toHaveLength(9);
    expect(await queries.matchupMatrix({ role: "MIDDLE", columnPage: 10000 })).toMatchObject({
      total: 11,
      columns: [],
      cells: [],
    });
    expect(await queries.matchupMatrix({ role: "TOP" })).toMatchObject({
      total: 0,
      rows: [],
      cells: [],
    });
    expect(await queries.matchupMatrix({ role: "MIDDLE", source: "pro" })).toMatchObject({
      patch: null,
      total: 0,
    });
    expect(await queries.matchupMatrix({ role: "MIDDLE", patch: "16.99" })).toMatchObject({
      patch: null,
      total: 0,
    });
    expect(fetcher.mock.calls.length).toBe(calls);
  });
  it("stores blindability from shrunk matchups weighted by opponent picks, with null reasons", async () => {
    await catalog();
    for (let n = 0; n < 10; n++) await game(20, n < 8, 0);
    for (let n = 0; n < 10; n++) await game(62, n < 2, 0);
    for (let n = 0; n < 10; n++) await game(64, n < 5, 0);
    for (let n = 0; n < 2; n++) await game(200, false, 0);
    await aggregate();
    const calls = fetcher.mock.calls.length;
    // Ahri wins 15 of 32; each covered opponent has 10 picks, the small sample 2 of 32.
    const shrunk = (wins: number) => (wins + (50 * 15) / 32) / 60;
    const rates = [shrunk(8), shrunk(2), shrunk(5)];
    const expected = rates.reduce((a, b) => a + b) / 3;
    const ahri = await queries.championBlindability({
      championKey: 103,
      source: "solo",
      patch: "16.22",
      role: "MIDDLE",
    });
    expect(ahri).toMatchObject({
      games: 32,
      sampledOpponents: 4,
      coveredOpponents: 3,
      coveredPicks: 30,
      rolePicks: 32,
      reason: null,
      worstOpponent: { championKey: 62, championId: "MonkeyKing" },
      builtAt: now.toISOString(),
    });
    expect(ahri!.coverage).toBeCloseTo(30 / 32, 12);
    expect(ahri!.expected).toBeCloseTo(expected, 12);
    expect(ahri!.worstCase).toBeCloseTo(shrunk(2), 12);
    expect(ahri!.variance).toBeCloseTo(rates.reduce((s, r) => s + (r - expected) ** 2, 0) / 3, 12);
    // The lowest fifth of 30 picks is six of Wukong's ten.
    expect(ahri!.lowerTail).toBeCloseTo(shrunk(2), 12);
    expect(ahri!.score).toBe(ahri!.lowerTail);
    // Nunu faced only Ahri (32 of the 54 other picks): too few opponents, counts kept, values unknown.
    const nunu = await queries.championBlindability({
      championKey: 20,
      source: "solo",
      patch: "16.22",
      role: "MIDDLE",
    });
    expect(nunu).toMatchObject({
      coveredOpponents: 1,
      coveredPicks: 32,
      rolePicks: 54,
      expected: null,
      worstCase: null,
      worstOpponent: null,
      variance: null,
      lowerTail: null,
      score: null,
      reason: "few-opponents",
    });
    expect(nunu!.coverage).toBeCloseTo(32 / 54, 12);
    expect(
      await queries.championBlindability({
        championKey: 103,
        source: "solo",
        patch: "16.22",
        role: "TOP",
      }),
    ).toBeNull();
    expect(fetcher.mock.calls.length).toBe(calls);
    // Rebuilding replaces the stored scores without duplicating them.
    expect((await run({ kind: "aggregate", rebuild: true })).state).toBe("done");
    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::integer AS n FROM blindability_scores WHERE source='solo' AND patch_key='16.22'",
    );
    expect(rows[0]!.n).toBe(5);
  });
  it("uses Oracle opponent roles and reported checkpoints, with separate pro samples and unmapped counts", async () => {
    await catalog();
    const rows: string[] = [];
    let header = "";
    for (let n = 0; n < 10; n++) {
      const lines = historyCsv({ id: `matchup-pro-${n}` })
        .trim()
        .split("\n");
      const fields = lines[0]!.split(",");
      header =
        lines[0] +
        ",golddiffat10,xpdiffat10,csdiffat10,golddiffat15,xpdiffat15,csdiffat15,firstblood,firsttower";
      for (const line of lines.slice(1)) {
        const values = line.split(","),
          get = (key: string) => values[fields.indexOf(key)]!;
        values[fields.indexOf("patch")] = "16.22";
        values[fields.indexOf("champion")] =
          get("position") === "mid"
            ? get("side") === "Blue"
              ? "Ahri"
              : "Nunu & Willump"
            : "Unmapped fixture";
        const blue = get("side") === "Blue";
        values[fields.indexOf("result")] = blue ? (n < 7 ? "1" : "0") : n < 7 ? "0" : "1";
        const checkpoints =
          get("position") === "mid"
            ? [
                blue ? 100 : -100,
                blue ? 200 : -200,
                blue ? 10 : -10,
                n === 0 ? "" : blue ? 300 : -300,
                blue ? 400 : -400,
                blue ? 20 : -20,
              ]
            : ["", "", "", "", "", ""];
        rows.push(
          [
            ...values,
            ...checkpoints,
            get("position") === "team" ? (blue ? "1" : "0") : "",
            get("position") === "team" ? (blue ? "0" : "1") : "",
          ].join(","),
        );
      }
    }
    await importCsv(header + "\n" + rows.join("\n") + "\n");
    const data = await queries.championMatchups({
      champion: "Ahri",
      source: "pro",
      patch: "16.22",
    });
    expect(data?.page.items).toHaveLength(1);
    expect(data?.page.items[0]).toMatchObject({
      games: 10,
      opponent: { championKey: 20 },
      metrics: {
        winRate: { raw: 0.7, shrunk: 0.7, sampleCount: 10 },
        gold10: { raw: 100, shrunk: 100, sampleCount: 10 },
        xp15: { raw: 400, sampleCount: 10 },
        cs15: { raw: 20, sampleCount: 10 },
        gold15: { raw: null, sampleCount: 9 },
        firstBlood: { raw: 1, sampleCount: 10 },
        firstTower: { raw: 0, sampleCount: 10 },
      },
    });
    const missing = await queries.championMatchups({
      champion: "Ahri",
      source: "pro",
      role: "TOP",
    });
    expect(missing?.exclusions).toEqual([
      {
        role: "TOP",
        games: 10,
        participants: 20,
        unknownRole: 0,
        ambiguousRole: 0,
        missingOpponent: 0,
        unmappedChampion: 20,
      },
    ]);
    for (const role of ["JUNGLE", "BOTTOM", "UTILITY"] as const) {
      const skipped = await queries.championMatchups({ champion: "Ahri", source: "pro", role });
      expect(skipped?.exclusions).toHaveLength(1);
      expect(skipped?.exclusions[0]).toMatchObject({ role, games: 10, unmappedChampion: 20 });
    }
    expect(
      (await queries.championMatchups({ champion: "Ahri", source: "solo" }))?.page.items,
    ).toEqual([]);
  });
});
