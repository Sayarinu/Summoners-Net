// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import { csvField, csvResponse, mutate, localRequest } from "./http";
import { importUpload } from "./import";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock("./data", () => ({
  synchronization: () => ({ request: mocks.request }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockResolvedValue("5");
});
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/refresh", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
describe("local HTTP entry points", () => {
  it("enforces loopback and same-origin mutation requests", async () => {
    expect(localRequest(new Request("http://localhost:3000"))).toBe(false);
    for (const origin of ["http://evil.test", "bad", "https://localhost:3000"])
      expect((await mutate(request({}, { origin }), "refresh")).status).toBe(403);
    expect(localRequest(request({}, { origin: "http://other.test", host: "other.test" }))).toBe(
      false,
    );
    expect(
      localRequest(request({}, { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" })),
    ).toBe(true);
  });
  it("validates refresh payloads, bounds bodies and never accepts arbitrary server paths", async () => {
    expect((await mutate(request({ kind: "running" }), "refresh")).status).toBe(202);
    expect(mocks.request).toHaveBeenCalledWith({ kind: "running" });
    expect((await mutate(request({ kind: "riot-key" }), "refresh")).status).toBe(202);
    expect(mocks.request).toHaveBeenCalledWith({ kind: "riot-key" });
    expect((await mutate(request({ kind: "riot-match-ids" }), "refresh")).status).toBe(202);
    expect((await mutate(request({ kind: "wp-train" }), "refresh")).status).toBe(202);
    expect(mocks.request).toHaveBeenCalledWith({ kind: "wp-train" });
    expect((await mutate(request({ kind: "wp-train", seed: 1 }), "refresh")).status).toBe(400);
    expect(
      (await mutate(request({ kind: "riot-match-ids", region: "euw1" }), "refresh")).status,
    ).toBe(400);
    expect((await mutate(request({ kind: "history", year: 2014 }), "refresh")).status).toBe(202);
    for (const body of [
      { kind: "paid" },
      { kind: "history", year: 2013 },
      { kind: "history", year: 2026, file: "/etc/passwd" },
    ])
      expect((await mutate(request(body), "refresh")).status).toBe(400);
    expect((await mutate(request({}, { "content-length": "5000" }), "refresh")).status).toBe(413);
    expect((await mutate(request({ value: "x".repeat(5000) }), "refresh")).status).toBe(413);
    const broken = new Request("http://localhost:3000", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: "broken",
    });
    expect((await mutate(broken, "refresh")).status).toBe(400);
    mocks.request.mockRejectedValue(new Error("private diagnostic"));
    const failure = await mutate(request({ kind: "matches" }), "refresh");
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("private diagnostic");
  });
  it("sets validated HTTP-only preference cookies", async () => {
    const response = await mutate(
      request({ timezone: "America/Phoenix", hideSpoilers: false }),
      "preferences",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("viewer-preferences-v2=");
    // The legacy cookie saved hidden results as a default, so saving clears it.
    expect(response.headers.get("set-cookie")).toMatch(
      /viewer-preferences=;.*Max-Age=0|viewer-preferences=;.*Expires=/,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(
      (await mutate(request({ timezone: "no", hideSpoilers: true }), "preferences")).status,
    ).toBe(400);
  });
  it("queues current local history using configured file only", async () => {
    vi.stubEnv("ORACLE_CURRENT_FILE", "/configured/current.csv");
    const year = new Date().getUTCFullYear();
    await mutate(request({ kind: "history", year }), "refresh");
    expect(mocks.request).toHaveBeenCalledWith({
      kind: "history",
      year,
      file: "/configured/current.csv",
    });
    vi.unstubAllEnvs();
  });
  it("validates upload metadata and stages bytes privately for the worker", async () => {
    const upload = (name: string, year: string, content = "gameid,league\na,LCK") => {
      const form = new FormData();
      form.set("year", year);
      form.set("file", new File([content], name));
      return new Request("http://localhost:3000/api/import", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        body: form,
      });
    };
    expect((await importUpload(upload("games.csv", "2026"))).status).toBe(202);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(".local/imports/"),
      expect.any(Buffer),
      { mode: 0o600 },
    );
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "history", year: 2026 }),
    );
    expect((await importUpload(upload("games.txt", "2026"))).status).toBe(400);
    expect((await importUpload(upload("games.csv", "2013"))).status).toBe(400);
    expect((await importUpload(upload("games.csv", "2026", ""))).status).toBe(400);
    expect((await importUpload(request({}, { origin: "bad" }))).status).toBe(403);
    expect((await importUpload(request({}, { "content-length": "300000000" }))).status).toBe(413);
    mocks.writeFile.mockRejectedValueOnce(new Error("disk full"));
    expect((await importUpload(upload("games.csv", "2026"))).status).toBe(400);
  });
});

it("queues bounded track uploads without parsing them or accepting a server path", async () => {
  const form = new FormData();
  form.set("kind", "replay-track");
  form.set("file", new File(["not JSON; worker validates"], "track.json"));
  form.set("path", "/etc/passwd");
  const upload = () =>
    new Request("http://localhost:3000/api/import?kind=replay-track", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: form,
    });
  mocks.writeFile.mockResolvedValue(undefined);
  expect((await importUpload(upload())).status).toBe(202);
  const queued: unknown = mocks.request.mock.calls.at(-1)?.[0];
  expect(queued).toHaveProperty("kind", "replay-track");
  expect(queued).toHaveProperty(
    "file",
    expect.stringMatching(/\.local\/imports\/[a-f0-9]{64}\.json$/),
  );
  expect(mocks.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.json$/),
    Buffer.from("not JSON; worker validates"),
    { mode: 0o600 },
  );
  form.set("file", new File(["{}"], "bad.csv"));
  expect((await importUpload(upload())).status).toBe(400);
  form.set("file", new File([], "empty.json"));
  expect((await importUpload(upload())).status).toBe(400);
  form.set("file", new File([new Uint8Array(64 * 1024 * 1024 + 8193)], "large.json"));
  expect((await importUpload(upload())).status).toBe(413);
  form.set("file", new File(["{}"], "track.json"));
  form.set("kind", "unknown");
  expect((await importUpload(upload())).status).toBe(400);
  expect(
    (await mutate(request({ kind: "replay-track", file: "/etc/passwd" }), "refresh")).status,
  ).toBe(400);
});

it("stages replay uploads with explicit platform provenance and cleans up when queuing fails", async () => {
  const form = new FormData();
  form.set("kind", "replay-metadata");
  form.set("file", new File(["fixture header"], "EUW1_123.rofl"));
  form.set("platform", "euw1");
  const upload = () =>
    new Request("http://localhost:3000/api/import?kind=replay-metadata", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: form,
    });
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.unlink.mockResolvedValue(undefined);
  expect((await importUpload(upload())).status).toBe(202);
  const queued: unknown = mocks.request.mock.calls.at(-1)?.[0];
  expect(queued).toHaveProperty("kind", "replay-metadata");
  expect(queued).toHaveProperty("platform", "euw1");
  expect(queued).toHaveProperty("file", expect.stringMatching(/replays\/[a-f0-9-]{36}\.rofl$/));
  expect(mocks.unlink).not.toHaveBeenCalled();
  form.set("platform", "unknown");
  expect((await importUpload(upload())).status).toBe(400);
  form.set("platform", "");
  expect((await importUpload(upload())).status).toBe(202);
  expect(mocks.request.mock.calls.at(-1)?.[0]).not.toHaveProperty("platform");
  form.set("file", new File(["header"], "bad.json"));
  expect((await importUpload(upload())).status).toBe(400);
  form.set("file", new File(["header"], "file.rofl"));
  mocks.request.mockRejectedValueOnce(new Error("private queue diagnostic"));
  expect((await importUpload(upload())).status).toBe(400);
  expect(mocks.unlink).toHaveBeenCalledWith(expect.stringMatching(/replays\/[a-f0-9-]{36}\.rofl$/));
  mocks.request.mockRejectedValueOnce(new Error("private"));
  mocks.unlink.mockRejectedValueOnce(new Error("cleanup failed"));
  expect((await importUpload(upload())).status).toBe(500);
  mocks.request.mockRejectedValueOnce(new Error("private"));
  mocks.unlink.mockRejectedValueOnce(Object.assign(new Error("absent"), { code: "ENOENT" }));
  expect((await importUpload(upload())).status).toBe(400);
});

it("queues bounded pro account link uploads for worker validation and rejects path injection", async () => {
  const form = new FormData();
  form.set("kind", "pro-account-links");
  form.set("file", new File(["worker validates this JSON"], "links.json"));
  form.set("path", "/etc/passwd");
  const upload = () =>
    new Request("http://localhost:3000/api/import?kind=pro-account-links", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: form,
    });
  mocks.writeFile.mockResolvedValue(undefined);
  expect((await importUpload(upload())).status).toBe(202);
  const queued: unknown = mocks.request.mock.calls.at(-1)?.[0];
  expect(queued).toHaveProperty("kind", "pro-account-links");
  expect(queued).toHaveProperty(
    "file",
    expect.stringMatching(/\.local\/imports\/[a-f0-9]{64}\.json$/),
  );
  expect(mocks.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.json$/),
    Buffer.from("worker validates this JSON"),
    { mode: 0o600 },
  );
  form.set("file", new File(["{}"], "links.csv"));
  expect((await importUpload(upload())).status).toBe(400);
  form.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 8193)], "large.json"));
  expect((await importUpload(upload())).status).toBe(413);
  expect(
    (await mutate(request({ kind: "pro-account-links", file: "/etc/passwd" }), "refresh")).status,
  ).toBe(400);
});

describe("CSV responses", () => {
  it("leaves unknown values empty and neutralizes formulas and separators", () => {
    expect([null, undefined, Number.NaN].map(csvField)).toEqual(["", "", ""]);
    expect(csvField(0)).toBe("0");
    expect(csvField(-0.25)).toBe("-0.25");
    expect(csvField(true)).toBe("true");
    expect(csvField("Nunu & Willump")).toBe("Nunu & Willump");
    expect(csvField('Kai"Sa, the')).toBe('"Kai""Sa, the"');
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("a\nb")).toBe('"a\nb"');
  });
  it("streams the header and rows as an attachment", async () => {
    async function* rows() {
      await Promise.resolve();
      yield [1, "Ahri", null];
      yield [2, "Nunu", 0.5];
    }
    const response = csvResponse("tier list 16.22.csv", ["key", "name", "rate"], rows());
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="tier_list_16.22.csv"',
    );
    expect(await response.text()).toBe("key,name,rate\r\n1,Ahri,\r\n2,Nunu,0.5\r\n");
  });
  it("ends the stream with an error when a page fails", async () => {
    async function* rows(): AsyncGenerator<string[]> {
      await Promise.resolve();
      yield ["ok"];
      throw new Error("database unavailable");
    }
    await expect(csvResponse("x.csv", ["a"], rows()).text()).rejects.toThrow(
      "database unavailable",
    );
  });
});
