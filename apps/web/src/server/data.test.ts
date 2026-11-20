// @vitest-environment node
import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  createQueries: vi.fn().mockReturnValue({ matches: () => [] }),
}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () => (mocks.cookie === undefined ? undefined : { value: mocks.cookie }),
    }),
}));
vi.mock("@summonersnet/data", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createQueries: mocks.createQueries,
}));
import { data, preferences, browseQuery, directoryQuery, sourceIdFromRoute } from "./data";
import { defaultPreferences } from "../features/preferences/model";
it("loads validated preferences and query filters without passing blank controls", async () => {
  expect(await preferences()).toMatchObject({
    timezone: defaultPreferences.timezone,
    hideSpoilers: false,
  });
  mocks.cookie = '{"timezone":"America/Phoenix","hideSpoilers":false}';
  expect(await browseQuery(Promise.resolve({ league: "all", year: "", page: "2" }))).toMatchObject({
    timezone: "America/Phoenix",
    page: 2,
  });
  await expect(browseQuery(Promise.resolve({ page: "bad" }))).rejects.toThrow();
});
it("clamps directory page sizes to a bounded range with a default for links without one", async () => {
  expect((await directoryQuery(Promise.resolve({}))).pageSize).toBe(24);
  expect((await directoryQuery(Promise.resolve({ pageSize: "36", page: "2" }))).pageSize).toBe(36);
  expect((await directoryQuery(Promise.resolve({ pageSize: "5000" }))).pageSize).toBe(120);
  expect((await directoryQuery(Promise.resolve({ pageSize: "-3" }))).pageSize).toBe(1);
  expect((await directoryQuery(Promise.resolve({ pageSize: ["12", "18"] }))).pageSize).toBe(24);
  await expect(browseQuery(Promise.resolve({ pageSize: "5000" }))).rejects.toThrow();
});
it("requires server-only configuration and reuses the query client", () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(() => data()).toThrow("Set DATABASE_URL");
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/esportsviewer_test");
  expect(data()).toBe(data());
  expect(mocks.createQueries).toHaveBeenCalledTimes(1);
  vi.unstubAllEnvs();
});

it("decodes source IDs exactly once at the framework boundary", async () => {
  expect(await sourceIdFromRoute(Promise.resolve({ id: "oracle%3Aplayer%3A10-mid" }))).toBe(
    "oracle:player:10-mid",
  );
  expect(await sourceIdFromRoute(Promise.resolve({ id: "literal%2525" }))).toBe("literal%25");
  await expect(sourceIdFromRoute(Promise.resolve({ id: "%ZZ" }))).rejects.toThrow();
});
