import { expect, it } from "vitest";
import { championOverviewQuerySchema, tierFromDelta } from "./champion-stats.js";

it("assigns tiers from the shrunk win rate's distance to the baseline", () => {
  expect(tierFromDelta(null)).toBeNull();
  expect(tierFromDelta(0.03)).toBe("S");
  expect(tierFromDelta(0.02)).toBe("A");
  expect(tierFromDelta(0.015)).toBe("A");
  expect(tierFromDelta(0)).toBe("B");
  expect(tierFromDelta(-0.0149)).toBe("B");
  expect(tierFromDelta(-0.015)).toBe("C");
  expect(tierFromDelta(-0.03)).toBe("D");
});
it("validates champion overview filters", () => {
  expect(championOverviewQuerySchema.parse({ champion: "MonkeyKing" })).toMatchObject({
    source: "solo",
    role: "ALL",
  });
  for (const bad of [
    { champion: "../etc" },
    { champion: "Ahri", role: "SUPPORT" },
    { champion: "Ahri", x: 1 },
  ])
    expect(championOverviewQuerySchema.safeParse(bad).success).toBe(false);
});
