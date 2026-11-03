import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createSync } from "./index.js";
import { createQueries } from "../index.js";
import { database, transaction, migrate } from "../persistence/database.js";
import { reserveRequest, observeQuota, DeferredRequest } from "./quota.js";
import { historyCsv, rawMatch, now } from "../../tests/fixtures.js";
import { archiveFileId } from "../providers/oracle.js";
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
  directory = await mkdtemp(join(tmpdir(), "esportsviewer-test-"));
  await sync.migrate();
});
beforeEach(async () => {
  instant = new Date(now);
  fetcher.mockReset();
  fetcher.mockResolvedValue(json([]));
  await pool.query(
    "TRUNCATE identity_tournament_rosters,identity_match_context,identity_catalog,identity_resolution_runs,image_assets,oracle_archive_participants,oracle_archive_games,participants,broadcasts,roster_observations,roster_snapshots,games,matches,competitions,source_mappings,identities,metadata,imports,sync_jobs,sync_schedule,request_ledger RESTART IDENTITY CASCADE",
  );
  await pool.query(
    "UPDATE source_status SET last_success=NULL,last_attempt=NULL,error=NULL,records=0",
  );
  await pool.query("UPDATE quota_state SET cooldown_until=NULL");
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
    url.searchParams.set("application_name", "esportsviewer-recovery-test");
    const recovering = createQueries(url.toString());
    try {
      await recovering.ready();
      const terminated = await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='esportsviewer-recovery-test'",
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
    fetcher
      .mockResolvedValueOnce(json(["16.4.1", "lolpatch_7.20"]))
      .mockResolvedValueOnce(
        json({
          version: "16.4.1",
          data: { Ahri: { name: "Ahri", image: { full: "Ahri.png" } } },
        }),
      )
      .mockResolvedValueOnce(json({ data: { "1": { name: "Boots", image: { full: "1.png" } } } }));
    expect((await run({ kind: "metadata" })).state).toBe("done");
    expect(await queries.metadata("16.4.1")).toHaveLength(2);
    expect(await queries.metadata()).toHaveLength(2);
    fetcher
      .mockResolvedValueOnce(json(["16.5.1"]))
      .mockResolvedValueOnce(json({ data: {} }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    expect((await run({ kind: "metadata" })).state).toBe("queued");
    expect(await queries.metadata("16.5.1")).toEqual([]);
    expect(await queries.metadata()).toHaveLength(2);
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
