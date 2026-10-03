// @vitest-environment node
import { expect, it, vi } from "vitest";
import { readiness } from "./health";

const ready = vi.hoisted(() => vi.fn());
vi.mock("./data", () => ({ data: () => ({ ready }) }));

it("reports uncached database readiness and conceals connection errors", async () => {
  ready.mockResolvedValueOnce(undefined);
  const healthy = await readiness();
  expect(healthy.status).toBe(200);
  expect(healthy.headers.get("cache-control")).toBe("no-store");
  expect(await healthy.json()).toEqual({ status: "ready" });
  ready.mockRejectedValueOnce(new Error("private database credentials"));
  const unavailable = await readiness();
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toEqual({ status: "unavailable" });
});
