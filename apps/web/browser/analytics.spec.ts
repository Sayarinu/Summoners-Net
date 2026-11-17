import { test, expect, type Page } from "@playwright/test";
import axe from "axe-core";

/** Every analytics page, loaded from the seeded fixtures with a selection that has data. */
const analyticsRoutes = [
  ["champion directory", "/champions", "Champions"],
  ["patch directory", "/patches", "Patches"],
  ["leaderboard hub", "/leaderboards", "Leaderboards"],
  ["tier list", "/tier-list?patch=16.4&role=MIDDLE", "Tier list"],
  ["trending champions", "/trending", "Trending champions"],
  ["patch overview", "/patches/16.4", "Patch 16.4"],
  ["champion page", "/champions/Ahri?source=solo&patch=16.4&role=MIDDLE", "Ahri"],
  ["champion matchups", "/champions/Ahri/matchups?patch=16.4&role=MIDDLE", "Ahri matchups"],
  ["role matchup matrix", "/matchups/MIDDLE?patch=16.4", "Mid matchup matrix"],
  ["counter-pick values", "/matchups/MIDDLE/counter-picks", "Mid counter-pick values"],
  ["pro drafts", "/drafts?patch=16.4&league=Draft+acceptance", "Pro drafts"],
  ["draft assistant", "/drafts/assistant?patch=16.4&blue=Ahri:TOP", "Draft assistant"],
  ["heatmaps", "/heatmaps?subjectKind=champion&subject=Ahri", "Ahri: positions"],
  ["solo game", "/solo-games/EUW1_7000000001", null],
  ["game map", "/solo-games/EUW1_7000000001/map", null],
  ["champion comparison", "/compare/champions?a=Ahri&b=MonkeyKing", "Champion against champion"],
  ["patch comparison", "/compare/patches?a=16.4&b=16.3", "Patch against patch"],
  ["saved views", "/saved-views", "Saved views"],
  ["win probability added", "/leaderboards/wpa", "Win probability added"],
  ["regional ladder", "/leaderboards/euw1", null],
  ["pro solo queue feed", "/leaderboards/pros", null],
  ["model diagnostics", "/models", "Model diagnostics"],
  ["summoner profile", `/summoners/${"a".repeat(78)}`, null],
] as const;

async function accessibilityViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () =>
    (
      await (window as unknown as { axe: typeof axe }).axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  );
}

for (const [name, path, heading] of analyticsRoutes)
  test(`the ${name} page loads with one main heading, no WCAG violations and no sideways scroll`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    if (heading) await expect(h1).toHaveText(heading);
    await expect(page.getByRole("main")).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

test("a heatmap subject without stored games shows an empty state and keeps its filters", async ({
  page,
}) => {
  // Wukong is in the catalog but has no stored timeline games.
  await page.goto("/heatmaps?subjectKind=champion&subject=MonkeyKing");
  await expect(page.getByRole("heading", { name: "Wukong: positions", level: 1 })).toBeVisible();
  await expect(page.getByText("No heatmap yet")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Patch" })).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Heatmap type" })
    .getByRole("link", { name: "Deaths" })
    .click();
  await expect(page).toHaveURL(/kind=death$/);
  await expect(page.getByRole("heading", { name: "Wukong: deaths", level: 1 })).toBeVisible();
  await expect(page.getByText("No heatmap yet")).toBeVisible();
});

test("saved views start empty, list a saved view and remove it again", async ({ page }) => {
  await page.goto("/saved-views");
  await expect(page.getByText("No views are saved in this browser.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved views" })).toHaveCount(0);
  await page.goto("/tier-list?patch=16.4&role=MIDDLE");
  await page.getByLabel("View name").fill("Mid tier list");
  await page.getByRole("button", { name: "Save this view" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toHaveText(
    'Saved "Mid tier list" in this browser.',
  );
  await page.goto("/saved-views");
  const list = page.getByRole("list", { name: "Saved views" });
  await list.getByRole("link", { name: "Mid tier list" }).click();
  await expect(page).toHaveURL(/\/tier-list\?patch=16\.4&role=MIDDLE$/);
  await page.goto("/saved-views");
  await page.getByRole("button", { name: "Remove Mid tier list" }).click();
  await expect(page.getByText("No views are saved in this browser.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No views are saved in this browser.")).toBeVisible();
});
