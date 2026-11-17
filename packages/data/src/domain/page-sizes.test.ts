import { expect, it } from "vitest";
import { querySchema } from "./models.js";
import { leaderboardQuerySchema } from "./leaderboards.js";
import { historicalQuerySchema } from "./historical.js";
import { proFeedQuerySchema } from "./pro-feed.js";
import { championStatsQuerySchema } from "./champion-stats.js";
import { synergyPageSize } from "./synergies.js";
import { wpaPageSize } from "./wpa-leaderboards.js";
import { tierListPageSize } from "../persistence/aggregates.js";
import { counterPickListQuerySchema } from "./blindability.js";
import type { ZodType } from "zod";
import { trackRangeLimitMs, trackRangeQuerySchema, trackRangeSampleLimit } from "./track-views.js";

it.each([
  ["browse", querySchema, "pageSize", 50],
  ["leaderboards", leaderboardQuerySchema, "pageSize", 100],
  ["history", historicalQuerySchema, "pageSize", 50],
  ["pro feed", proFeedQuerySchema, "pageSize", 100],
  ["champion statistics", championStatsQuerySchema, "limit", 250],
  ["counter-pick list", counterPickListQuerySchema, "pageSize", 100],
] as const)("%s accepts a bounded page size", (_, schema, field, max) => {
  const size = (schema as unknown as { shape: Record<string, ZodType> }).shape[field]!;
  expect(size.safeParse(max).success).toBe(true);
  expect(size.safeParse(max + 1).success).toBe(false);
  expect(size.safeParse(0).success).toBe(false);
});
it("fixes the page size of pages that do not take one", () => {
  expect([tierListPageSize, synergyPageSize, wpaPageSize].every((n) => n > 0 && n <= 100)).toBe(
    true,
  );
});
it("bounds track range reads to two minutes and ten samples a second", () => {
  const range = (fromMs: number, toMs: number) =>
    trackRangeQuerySchema.safeParse({ matchId: "EUW1_1", fromMs, toMs }).success;
  expect(trackRangeLimitMs).toBe(120_000);
  expect(trackRangeSampleLimit).toBe(1201);
  expect(range(0, 120_000)).toBe(true);
  expect(range(0, 120_001)).toBe(false);
  expect(range(5, 4)).toBe(false);
  expect(range(7_200_000, 7_200_001)).toBe(false);
});
