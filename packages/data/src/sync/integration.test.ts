import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createSync } from "./index.js";
import { createQueries } from "../index.js";
import { database, transaction, migrate } from "../persistence/database.js";
import { reserveRequest, observeQuota, DeferredRequest } from "./quota.js";
import { historyCsv, rawMatch, now } from "../../tests/fixtures.js";
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
const sync = createSync(connection, {
  clock: () => instant,
  fetch: fetcher,
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
    "TRUNCATE participants,broadcasts,roster_observations,roster_snapshots,games,matches,competitions,source_mappings,identities,metadata,imports,sync_jobs,sync_schedule,request_ledger RESTART IDENTITY CASCADE",
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
  it("opens with live matches, nearest scheduled matches, then recent results", async () => {
    fetcher.mockResolvedValue(
      json([
        rawMatch(1, { status: "not_started", begin_at: "2026-04-01T12:00:00Z" }),
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
  });
  it("migrates concurrently, rejects altered migration evidence and rolls back transactions", async () => {
    await Promise.all([sync.migrate(), migrate(pool)]);
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
    expect((await importCsv()).state).toBe("done");
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
  it("keeps source identities distinct, replaces observed rosters, and commits all match pages together", async () => {
    fetcher.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
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
});
