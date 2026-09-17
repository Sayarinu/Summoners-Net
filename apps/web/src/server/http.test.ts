// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import { mutate, localRequest } from "./http";
import { importUpload } from "./import";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("./data", () => ({
  synchronization: () => ({ request: mocks.request }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
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
