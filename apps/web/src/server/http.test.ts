// @vitest-environment node
import { describe, it, expect } from "vitest";
import { csvField, csvResponse, savePreferences, localRequest } from "./http";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/preferences", {
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
      expect((await savePreferences(request({}, { origin }))).status).toBe(403);
    expect(localRequest(request({}, { origin: "http://other.test", host: "other.test" }))).toBe(
      false,
    );
    expect(
      localRequest(request({}, { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" })),
    ).toBe(true);
  });
  it("bounds preference bodies and rejects malformed JSON", async () => {
    expect((await savePreferences(request({}, { "content-length": "5000" }))).status).toBe(413);
    expect((await savePreferences(request({ value: "x".repeat(5000) }))).status).toBe(413);
    const broken = new Request("http://localhost:3000", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: "broken",
    });
    expect((await savePreferences(broken)).status).toBe(400);
  });
  it("sets validated HTTP-only preference cookies", async () => {
    const response = await savePreferences(
      request({ timezone: "America/Phoenix", hideSpoilers: false }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("viewer-preferences-v2=");
    // The legacy cookie saved hidden results as a default, so saving clears it.
    expect(response.headers.get("set-cookie")).toMatch(
      /viewer-preferences=;.*Max-Age=0|viewer-preferences=;.*Expires=/,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect((await savePreferences(request({ timezone: "no", hideSpoilers: true }))).status).toBe(
      400,
    );
  });
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
