import { readFile } from "node:fs/promises";
import { proAccountFixture } from "../../../packages/data/tests/pro-account-fixtures";
import { roflFixture } from "../../../packages/data/tests/rofl-fixtures";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "axe-core";
import { historyCsv } from "../../../packages/data/tests/fixtures";

async function openSettings(page: Page) {
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole("button", { name: "Settings" }).click();
}

test("browse filters, SQL pages, match details and spoiler control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matches", exact: true })).toBeVisible();
  await expect(page.getByText("Result hidden")).toHaveCount(0);
  await page.getByRole("button", { name: /All leagues/ }).click();
  await page.getByRole("option", { name: "LCK", exact: true }).click();
  await expect(page).toHaveURL(/league=LCK/);
  expect(new URL(page.url()).searchParams.has("date")).toBe(false);
  await expect(page.getByText(/30 records/)).toBeVisible();
  const firstMatch = page.locator(".np-match-row").first();
  const teamLayout = await firstMatch.evaluate((row) => {
    const teams = row.querySelectorAll<HTMLElement>(".np-match-team");
    const names = row.querySelectorAll<HTMLElement>(".np-match-team__name");
    const versus = row.querySelector<HTMLElement>(".np-match-vs")!;
    const rightLogo = teams[1]!.querySelector<HTMLElement>(".np-avatar")!;
    const primary = row.querySelector<HTMLElement>(".np-match-row__primary")!;
    const leftTeam = teams[0]!.getBoundingClientRect();
    const rightTeam = teams[1]!.getBoundingClientRect();
    const rightName = names[1]!.getBoundingClientRect();
    const versusBox = versus.getBoundingClientRect();
    const primaryBox = primary.getBoundingClientRect();
    const rightLogoBox = rightLogo.getBoundingClientRect();
    return {
      sideBySide: window.matchMedia("(min-width: 851px)").matches,
      leftGap: versusBox.left - leftTeam.right,
      rightGap: rightTeam.left - versusBox.right,
      versusOffset: Math.abs(
        versusBox.left + versusBox.width / 2 - (primaryBox.left + primaryBox.width / 2),
      ),
      rightLogoFollowsName: rightLogoBox.left > rightName.right,
      rightNameClipped: names[1]!.scrollWidth > names[1]!.clientWidth,
    };
  });
  if (teamLayout.sideBySide) {
    expect(Math.abs(teamLayout.leftGap - teamLayout.rightGap)).toBeLessThanOrEqual(1);
    expect(teamLayout.versusOffset).toBeLessThanOrEqual(1);
  }
  expect(teamLayout.rightLogoFollowsName).toBe(true);
  expect(teamLayout.rightNameClipped).toBe(false);
  const watchButtons = page.locator(".ev-watch-toggle");
  const watchTop = () =>
    watchButtons.first().evaluate((button) => button.getBoundingClientRect().top + window.scrollY);
  const watchButtonTop = await watchTop();
  await watchButtons.first().click();
  await expect(page.getByRole("region", { name: "Watch match" })).toBeVisible();
  expect(Math.abs((await watchTop()) - watchButtonTop)).toBeLessThanOrEqual(1);
  await expect(watchButtons.first()).toHaveText("Watch");
  await expect(page.locator(".np-match-row__expanded")).toHaveCount(1);
  await expect(page.locator(".ev-inline-stream")).toHaveCSS("position", "static");
  await expect(page.getByRole("button", { name: /Broadcast/ })).toContainText("Twitch");
  await page.getByRole("button", { name: "Load Stream" }).click();
  const streamBox = await page.locator(".ev-inline-stream .np-stream-shell").boundingBox();
  expect(streamBox?.width).toBeLessThanOrEqual(840);
  const broadcastBox = await page.getByRole("button", { name: /Broadcast/ }).boundingBox();
  if (teamLayout.sideBySide)
    expect(broadcastBox!.x).toBeGreaterThan(streamBox!.x + streamBox!.width);
  await expect(page.locator(".ev-inline-stream iframe")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Unload player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Player not working" })).toHaveCount(0);
  await watchButtons.nth(1).click();
  await expect(watchButtons.first()).toHaveAttribute("aria-expanded", "false");
  await expect(watchButtons.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "Watch match" })).toHaveCount(1);
  await expect(page.locator(".ev-inline-stream iframe")).toHaveCount(0);
  await watchButtons.nth(1).click();
  await expect(page.getByRole("region", { name: "Watch match" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Filter Matches" }).fill("Acceptance Blue");
  await expect(page).toHaveURL(/q=Acceptance\+Blue/);
  await page.goto("/");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/30 records · Page 2/)).toBeVisible();
  await page.goto("/?state=scheduled");
  await expect(page.locator(".np-match-row").getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 records/)).toBeVisible();
  await page.goto("/?date=2026-02-28&league=LCK");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await expect(page.getByText("Result hidden")).toHaveCount(0);
  await page
    .getByRole("link", { name: /Acceptance Blue versus Acceptance Red/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Acceptance Blue vs Acceptance Red",
  );
  await expect(page.getByRole("table", { name: "Game context" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
});

test.describe("players navigation", () => {
  test.use({ timezoneId: "UTC" });

  test("players load without a document refresh loop", async ({ page }) => {
    let documentLoads = 0;
    let playerRouteRequests = 0;
    let preferenceWrites = 0;
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/players") {
        playerRouteRequests++;
        if (request.resourceType() === "document") documentLoads++;
      }
      if (pathname === "/api/preferences" && request.method() === "POST") preferenceWrites++;
    });
    await page.goto("/");
    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    if (await openNavigation.isVisible()) await openNavigation.click();
    await page.getByRole("link", { name: "Players", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Players", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(documentLoads).toBe(0);
    expect(playerRouteRequests).toBe(1);
    expect(preferenceWrites).toBeLessThanOrEqual(1);
  });
});

test("in-app links navigate without reloading the document and pages fade in", async ({ page }) => {
  await page.goto("/teams");
  await page.evaluate(() => ((window as Window & { softMarker?: number }).softMarker = 1));
  await page.locator("main a[href^='/teams/']").first().click();
  await expect(page).toHaveURL(/\/teams\/.+/);
  await expect(page.locator("h1")).not.toHaveText("Teams");
  expect(await page.evaluate(() => (window as Window & { softMarker?: number }).softMarker)).toBe(
    1,
  );
  await expect(page.locator(".ev-main > *").first()).toHaveCSS("animation-name", "ev-page-enter");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goBack();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.locator(".ev-main > *").first()).toHaveCSS("animation-name", "none");
});

test("team profile links use readable routes and legacy URLs settle without a request loop", async ({
  page,
}) => {
  let teamRouteRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/teams/")) teamRouteRequests++;
  });
  await page.goto("/teams/oracle%3Ateam%3A10");
  await expect(page).toHaveURL(/\/teams\/acceptance-blue$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acceptance Blue");
  await page.waitForTimeout(1500);
  expect(teamRouteRequests).toBeLessThanOrEqual(2);
  await page.goto("/teams?q=Acceptance+Blue");
  await expect(page.getByRole("link", { name: /Acceptance Blue/ }).first()).toHaveAttribute(
    "href",
    "/teams/acceptance-blue",
  );
});

test("search, history, observed rosters and independently accessible played lineups", async ({
  page,
}) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search" }).fill("Player Blue mid");
  await expect(page).toHaveURL(/q=Player\+Blue\+mid/);
  await page.getByRole("link", { name: /Player Blue mid/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Player Blue mid");
  await expect(page.getByRole("table", { name: "Latest roster observation" })).toBeVisible();
  await expect(page.getByText("100.0%")).toBeVisible();
  await page.getByRole("table", { name: "Historical games" }).getByRole("link").first().click();
  await expect(page.getByRole("table", { name: "Historical played lineup" })).toBeVisible();
  await expect(page.getByText("Hidden", { exact: true })).toHaveCount(0);
  await expect(page.getByText("5 / 2 / 7", { exact: true })).toHaveCount(10);
  await page.goto("/teams/pandascore%3Ateam%3A10");
  await expect(page.getByRole("link", { name: /Observed Player/ })).toBeVisible();
  await page.goto("/history?year=2014");
  await expect(page.getByText("No games match these filters.")).toBeVisible();
});
test("search typed before hydration still runs once the page hydrates", async ({ page }) => {
  // Hold back the client bundles so the text lands while the form is still server-rendered HTML.
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto("/search", { waitUntil: "domcontentloaded" });
  await page.getByRole("searchbox", { name: "Search" }).fill("Player Blue mid");
  await expect(page).toHaveURL(/q=Player\+Blue\+mid/, { timeout: 15000 });
  await expect(page.getByRole("link", { name: /Player Blue mid/ })).toHaveCount(1);
});
test("timezone boundaries and spoiler preferences persist across navigation", async ({ page }) => {
  await page.goto("/");
  await openSettings(page);
  await page.getByRole("combobox", { name: "Timezone" }).fill("America/Phoenix");
  await page.getByRole("option", { name: "America/Phoenix" }).click();
  await page.getByRole("button", { name: "Save timezone" }).click();
  await expect(page.getByRole("combobox", { name: "Timezone" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await page.goto("/?date=2026-02-28");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "02/28/2026" })).toBeVisible();
  await openSettings(page);
  await page.getByRole("switch", { name: "Hide results" }).press("Space");
  await expect(page.getByText("Result hidden")).not.toHaveCount(0);
  await page.goto("/history");
  await expect(page.getByRole("link", { name: /02\/28\/2026/ })).toBeVisible();
});
test("single consented player and external fallback survive a blocked embed", async ({ page }) => {
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Test player shell</p>" }),
  );
  await page.route("https://player.twitch.tv/**", (route) => route.abort());
  await page.goto("/matches/pandascore%3Amatch%3A1");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Load Stream" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: /Broadcast/ }).click();
  await page.getByRole("option", { name: /Twitch/ }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Load Stream" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Player not working" }).click();
  await expect(page.getByRole("heading", { name: "Stream unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open on Twitch" }).last()).toHaveAttribute(
    "href",
    "https://twitch.tv/test_channel",
  );
  await page.getByRole("button", { name: "Unload player" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("manual refresh and CSV uploads join the durable queue", async ({ page }) => {
  await page.goto("/sources");
  await page.getByRole("button", { name: "Refresh", exact: true }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Queued." })).toBeVisible();
  await page.goto("/sources");
  await expect(page.getByText("queued", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Annual CSV").setInputFiles({
    name: "2024.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(historyCsv({ year: 2024 })),
  });
  await page.getByLabel("Year", { exact: true }).fill("2024");
  await page.getByRole("button", { name: "Queue local import" }).click();
  await expect(page.getByText(/Import queued/)).toBeVisible();
  await page.getByRole("button", { name: "Reload status" }).click();
  await expect(page.getByText("history:2024", { exact: true })).toBeVisible();
  const invalid = await page.request.post("/api/refresh", {
    data: { kind: "history", year: 2026, file: "/etc/passwd" },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(invalid.status()).toBe(400);
  const foreign = await page.request.post("/api/refresh", {
    data: { kind: "matches" },
    headers: { origin: "http://external.test" },
  });
  expect(foreign.status()).toBe(403);
});
test("the Riot crawler shows progress per region and patch and queues a crawl", async ({
  page,
}) => {
  await page.goto("/sources");
  const section = page.getByRole("region", { name: "Riot crawler" });
  const progress = section.getByRole("table", { name: "Crawl progress by region and patch" });
  await expect(progress).toContainText("europe");
  await expect(progress).toContainText("16.4");
  await expect(progress.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Queue crawl" }).click();
  await expect(section.getByRole("status").filter({ hasText: "Queued." })).toBeVisible();
  await page.goto("/sources");
  await expect(page.getByText("riot-match-ids", { exact: true })).toBeVisible();
  const invalid = await page.request.post("/api/refresh", {
    data: { kind: "riot-match-ids", region: "euw1" },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(invalid.status()).toBe(400);
});
test("the tier list filters by role and source and sorts in SQL", async ({ page }) => {
  await page.goto("/tier-list");
  const table = page.getByRole("table", { name: "Champion tier list" });
  // Ten picked champions and one only banned, from one solo-queue game.
  await expect(table.getByRole("row")).toHaveCount(12);
  await expect(page.getByText(/Patch 16\.4 · 1 game/)).toBeVisible();
  const choose = async (label: string, option: string) => {
    await page.locator(".np-select", { hasText: label }).getByRole("button").click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose("Role", "Mid");
  await choose("Sort by", "Win rate");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(page).toHaveURL(/sort=winRate/);
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1)).toContainText("Ahri");
  await expect(table.getByRole("row").nth(1)).toContainText("Too few games");
  await choose("Order", "Lowest first");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/order=asc/);
  await expect(table.getByRole("row").nth(1)).toContainText("Champion 157");
  await choose("Source", "Pro");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/source=pro/);
  await expect(table.getByRole("row").nth(1)).toContainText("Ahri");
  await page.goto("/tier-list?role=SUPPORT");
  await expect(page.getByText(/Choose filters from the lists/)).toBeVisible();
});
test("a champion page shows rates, tier and trend, and unknown champions are not found", async ({
  page,
}) => {
  await page.goto("/tier-list?role=MIDDLE");
  await page.getByRole("link", { name: "Ahri", exact: true }).click();
  await expect(page).toHaveURL(/\/champions\/Ahri$/);
  await expect(page.getByRole("heading", { name: "Ahri", level: 1 })).toBeVisible();
  const stats = page.getByRole("region", { name: "Champion statistics" });
  await expect(stats).toContainText("Patch 16.4");
  await expect(stats).toContainText("Win rate · 1 results");
  await expect(stats).toContainText("Tier");
  await expect(page.getByText("Ahri win rate by patch").first()).toBeAttached();
  // The seeded game's timeline opens with Doran's Ring; one game is below the minimum sample.
  const start = page.getByRole("table", { name: "Starting items" });
  await expect(start).toContainText("Doran's Ring");
  await expect(start).toContainText("Too few games (1)");
  await expect(page.getByRole("table", { name: "Keystones" })).toContainText("Electrocute");
  await expect(page.getByRole("table", { name: "Summoner spells" })).toContainText("Flash");
  // The seeded timeline levels Ahri's Q once: too few skill-ups to decide an order.
  await expect(page.getByText(/1 for the first levels, 1 for the max order/)).toBeVisible();
  await expect(page.getByRole("region", { name: "When it wins" })).toContainText(
    "30–35 min · 1 game",
  );
  // Ahri's four teammates from the seeded game; the catalog fixture names only a few champions.
  await expect(page.getByRole("table", { name: "Allies" })).toContainText("Champion 412");
  await expect(page.getByText("4 allies · Page 1")).toBeVisible();
  await page.locator(".np-select", { hasText: "Sort allies by" }).getByRole("button").click();
  await page.getByRole("option", { name: "Delta", exact: true }).click();
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect(page).toHaveURL(/synergySort=delta/);
  await expect(page).toHaveURL(/source=solo/);
  await expect(page.getByText("Bot-lane pairs: win rate (%)").first()).toBeAttached();
  // The seeded pro draft picks Ahri once.
  await expect(page.getByLabel("Pro-play statistics")).toContainText("Presence · 1 games100.0%");
  await page.locator(".np-select", { hasText: "League" }).getByRole("button").click();
  await page.getByRole("option", { name: "Draft acceptance", exact: true }).click();
  await page.getByRole("button", { name: "Apply league" }).click();
  await expect(page).toHaveURL(/league=Draft\+acceptance/);
  await expect(page.getByLabel("Pro-play statistics")).toContainText("Picks / bans1 / 0");
  await page.goto("/champions/Ahri?source=pro");
  await expect(page.getByText("Pro play · All roles")).toBeVisible();
  const missing = await page.goto("/champions/NotAChampion");
  expect(missing?.status()).toBe(404);
});
test("a solo game charts win probability with the model's calibration and event markers", async ({
  page,
}) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await expect(page.getByRole("heading", { name: "Blue side won" })).toBeVisible();
  await expect(page.getByText(/model v1 \(#1, features v1\)/)).toBeVisible();
  await expect(page.getByText("Blue side win probability by minute").first()).toBeAttached();
  const events = page.getByRole("table", { name: "Kills and objectives" });
  await expect(events).toContainText("Blue: Fire Dragon");
  await expect(page.getByRole("table", { name: "Players" })).toContainText("Ahri");
  const missing = await page.goto("/solo-games/EUW1_1");
  expect(missing?.status()).toBe(404);
});
test("a solo game's map replays timeline positions with keyboard controls and toggles", async ({
  page,
}) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await page.getByRole("link", { name: "Game map" }).click();
  await expect(page).toHaveURL(/\/solo-games\/EUW1_7000000001\/map$/);
  await expect(page.getByRole("heading", { name: "Game map", level: 1 })).toBeVisible();
  await expect(page.getByText(/one position per champion per minute/)).toBeVisible();
  const positions = () => page.getByRole("table", { name: /^Positions at / });
  await expect(positions().getByRole("row")).toHaveCount(11);
  await expect(page.locator(".np-minimap__point")).toHaveCount(10);
  // The seeded timeline has frames at minutes 0-2; the scrubber is keyboard operable.
  const scrubber = page.getByLabel(/^Game time/);
  await scrubber.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("table", { name: "Positions at 2:00" })).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("table", { name: "Positions at 0:01" })).toContainText(
    "estimated between frames",
  );
  await page.getByRole("switch", { name: "Red team" }).press("Space");
  await expect(positions().getByRole("row")).toHaveCount(6);
  await expect(page.locator(".np-minimap__point")).toHaveCount(5);
  await page.getByRole("button", { name: "Play", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  const missing = await page.goto("/solo-games/EUW1_1/map");
  expect(missing?.status()).toBe(404);
});
test("the game map overlays timeline events and jumps to a selected event", async ({ page }) => {
  await page.goto("/solo-games/EUW1_7000000001/map");
  const list = page.getByRole("table", { name: "Events" });
  // Riot records no coordinates for ward placements: listed, not drawn.
  await expect(list.getByRole("row", { name: /Ward placed \(Yellow Trinket\)/ })).toContainText(
    "Not drawn: no coordinates",
  );
  await expect(page.locator(".np-minimap__event")).toHaveCount(0);
  await list.getByRole("button", { name: "Go to 1:38" }).press("Enter");
  await expect(page.getByRole("table", { name: "Positions at 1:38" })).toBeVisible();
  await expect(page.locator(".np-minimap__event--kill")).toHaveCount(1);
  // The dragon (1:50) and the tower (2:05) are both within 30 seconds.
  await expect(page.locator(".np-minimap__event--objective")).toHaveCount(2);
  await expect(list).toContainText("7200, 7100 (drawn now)");
  await page.getByRole("switch", { name: "Kills" }).press("Space");
  await expect(page.locator(".np-minimap__event--kill")).toHaveCount(0);
  await expect(list).not.toContainText("killed");
});
test("heatmaps report their sample and are not drawn below the minimum", async ({ page }) => {
  await page.goto("/champions/Ahri");
  await page.getByRole("link", { name: "Heatmaps", exact: true }).click();
  await expect(page).toHaveURL(/\/heatmaps\?subjectKind=champion&subject=Ahri/);
  await expect(page.getByRole("heading", { name: "Ahri: positions" })).toBeVisible();
  // The one seeded game with a timeline: Ahri's minute 1 and 2 frames.
  await expect(page.getByRole("status")).toHaveText("Sample: 1 game and 2 points on patch 16.4.");
  await expect(page.getByText("Too few games to draw")).toBeVisible();
  await expect(page.locator(".np-minimap")).toHaveCount(0);
  await expect(page.getByText(/Red side is rotated half a turn/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Heatmap type" })
    .getByRole("link", { name: "Kills" })
    .click();
  await expect(page.getByRole("heading", { name: "Ahri: kills" })).toBeVisible();
  await page.getByRole("link", { name: "Jungle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jungle: kills" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sample: 1 game and 1 point");
  await page.goto("/heatmaps?subjectKind=champion&subject=Ahri&kind=assists");
  await expect(page.getByText(/^Choose a champion, player or role/)).toBeVisible();
  const missing = await page.goto("/heatmaps?subjectKind=champion&subject=NotAChampion");
  expect(missing?.status()).toBe(404);
});
test("the champion page shows inferred early jungle paths for the jungle role", async ({
  page,
}) => {
  // The seeded game's jungler is not in the fixture catalog, so Ahri has no jungle games.
  await page.goto("/champions/Ahri?role=JUNGLE");
  const section = page.getByRole("region", { name: "Early jungle paths" });
  await expect(section).toContainText("Inferred from 0 jungle games on patch 16.4");
  await expect(section).toContainText("Red side is rotated onto blue side");
  await expect(section.getByText("No jungle games")).toBeVisible();
  // Outside the jungle role a champion without jungle games shows no section.
  await page.goto("/champions/Ahri");
  await expect(page.getByRole("heading", { name: "Ahri", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Early jungle paths" })).toHaveCount(0);
});
test("win probability added leaderboards rank champions and roles from the active model", async ({
  page,
}) => {
  await page.goto("/leaderboards/wpa");
  await expect(page.getByText(/Patch 16\.4 · model v1 \(#1/)).toBeVisible();
  const champions = page.getByRole("table", { name: "Champions by win probability added" });
  await expect(champions.getByRole("row")).toHaveCount(11);
  await expect(champions).toContainText("Too few games");
  await page.goto("/leaderboards/wpa?kind=role&sort=games");
  await expect(page.getByRole("table", { name: "Roles by win probability added" })).toContainText(
    "Support",
  );
  await page.goto("/leaderboards/wpa?kind=team");
  await expect(page.getByText(/Choose a board/)).toBeVisible();
});
test("a pro game shows the coarse checkpoint win probability section with revealed statistics", async ({
  page,
}) => {
  await page.goto("/games/oracle%3Agame%3Aacceptance-game");
  const reveal = page.getByRole("button", { name: "Reveal game statistics" });
  if (await reveal.isVisible()) await reveal.click();
  await expect(
    page.getByRole("heading", { name: "Win probability (coarse, 4 checkpoints)" }),
  ).toBeVisible();
  // The fixture archive has no checkpoint columns, so no pro model can be trained from it.
  await expect(page.getByText("No pro win probability model is active yet.")).toBeVisible();
});
test("model diagnostics show versions, calibration and named weights", async ({ page }) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await page.getByRole("link", { name: "Model diagnostics" }).click();
  await expect(page).toHaveURL(/\/models\?model=1/);
  await expect(page.getByRole("heading", { name: "Model diagnostics", level: 1 })).toBeVisible();
  await expect(page.getByRole("table", { name: "Model versions" })).toContainText(
    "Solo queue (timelines)",
  );
  await expect(
    page.getByText("Reliability: predicted vs observed blue win rate (%)").first(),
  ).toBeAttached();
  await expect(page.getByRole("table", { name: "Feature weights" })).toContainText(
    "Gold difference (per 5,000)",
  );
  await page.goto("/models?model=nope");
  await expect(page.getByText("Choose a model from the list.")).toBeVisible();
});
test("sources show the active win probability model and only queue training", async ({ page }) => {
  await page.goto("/sources");
  const section = page.getByRole("region", { name: "Win probability model" });
  await expect(section).toContainText(/Model v1 \(#1\) is active/);
  await section.getByRole("button", { name: "Queue training" }).click();
  await expect(section.getByRole("status").filter({ hasText: "Queued." })).toBeVisible();
  await page.goto("/sources");
  await expect(page.getByText("wp-train", { exact: true })).toBeVisible();
  const invalid = await page.request.post("/api/refresh", {
    data: { kind: "wp-train", minimumMatches: 1 },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(invalid.status()).toBe(400);
});
test("keyboard navigation, accessible names and responsive layout", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matches", exact: true })).toBeVisible();
  await page.keyboard.press(info.project.name === "webkit" ? "Alt+Tab" : "Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.addScriptTag({ content: AxeBuilder.source });
  const violations = await page.evaluate(async () => {
    return (
      await (window as unknown as { axe: typeof AxeBuilder }).axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, summary: n.failureSummary })),
    }));
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-matches.png`,
    fullPage: false,
  });
  await page.goto("/games/oracle%3Agame%3Aacceptance-game");
  await expect(page.getByRole("table", { name: "Historical played lineup" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-game.png`,
    fullPage: true,
  });
});

test("canonical profiles share local portraits across search, rosters and played lineups", async ({
  page,
}, info) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("pandascore.co")) external.push(request.url());
  });
  await page.goto("/search?q=Player+Blue+mid");
  await expect(page.getByRole("link", { name: /Player Blue mid/ })).toHaveCount(1);
  await page.getByRole("link", { name: /Player Blue mid/ }).click();
  await expect(page).toHaveURL(/\/players\/player-blue-mid$/);
  const portrait = page.locator(".ev-title img");
  await expect(portrait).toHaveAttribute("src", /^\/api\/images\/[a-f0-9]{64}$/);
  await expect
    .poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(portrait).toHaveCSS("object-fit", "contain");
  await expect(page.locator('.ev-title [data-entity-kind="player"]')).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.getByText("Identity details", { exact: true }).click();
  await expect(page.getByText(/pandascore · 32/)).toHaveCount(0);
  await expect(page.getByText(/5 matching players and roles/)).toBeVisible();
  await page.getByRole("link", { name: "played lineup" }).click();
  const player = page.getByRole("link", { name: /Player Blue mid/ });
  await expect(player.locator("img")).toHaveAttribute("src", /^\/api\/images\//);
  const teamLogo = page.locator('[data-entity-kind="team"]').first();
  await expect(teamLogo).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(teamLogo.locator("img")).toHaveCSS("object-fit", "contain");
  await player.click();
  await expect(page).toHaveURL(/\/players\/player-blue-mid$/);
  await page.goto("/players/pandascore%3Aplayer%3A32");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Player Blue mid");
  await expect(page.getByRole("table", { name: "Latest roster observation" })).toBeVisible();
  expect(external).toEqual([]);
  await page.addScriptTag({ content: AxeBuilder.source });
  expect(
    await page.evaluate(async () =>
      (
        await (window as unknown as { axe: typeof AxeBuilder }).axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => v.id),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-linked-profile.png`,
    fullPage: true,
  });
});

test("missing and failed portraits show a person across search and profiles", async ({
  page,
}, info) => {
  // Install before any page can populate WebKit's decoded image cache.
  let failedRequests = 0;
  await page.route("**/api/images/**", (route) => {
    failedRequests++;
    return route.abort();
  });
  await page.goto("/players?q=Observed+Player");
  const result = page.getByRole("link", { name: /Observed Player/ });
  await expect(result.locator('[data-entity-kind="player"] svg')).toBeVisible();
  await expect(result.locator('[data-entity-kind="player"]')).toHaveText("");
  await result.click();
  await expect(page.locator('.ev-title [data-entity-kind="player"] svg')).toBeVisible();
  await page.goto("/players/oracle%3Aplayer%3A10-mid");
  await expect(page.locator('.ev-title [data-entity-kind="player"] svg')).toBeVisible();
  await expect(page.locator('.ev-title [data-entity-kind="player"] img')).toHaveCount(0);
  expect(failedRequests).toBeGreaterThan(0);
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-person-placeholder.png`,
    fullPage: true,
  });
});

test("pro drafts filter and paginate source observations with samples and explicit missing states", async ({
  page,
}, info) => {
  await page.goto("/drafts?patch=16.4&league=Draft+acceptance");
  await expect(page.getByRole("heading", { name: "Pro drafts", exact: true })).toBeVisible();
  await expect(
    page.getByText("First-pick win rate: 100.0% · 1 game", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1 included · 0 excluded/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Pick and ban priority" })).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Blind and counter picks by role" })
      .getByText("Jinx", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-drafts.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Priority pages" })
    .getByRole("button", { name: "Next page" })
    .click();
  await expect(page).toHaveURL(/priorityPage=2/);
  expect(new URL(page.url()).searchParams.get("league")).toBe("Draft acceptance");
  expect(new URL(page.url()).searchParams.get("patch")).toBe("16.4");
  await page.getByLabel("Patch", { exact: true }).fill("99.99");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByText("First-pick win rate: Unknown · 0 games", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No draft priority observations match these filters.")).toBeVisible();
  await page.getByLabel("Patch", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter a patch");
});

test("replay track uploads queue validation without processing frames in the browser", async ({
  page,
}) => {
  await page.goto("/sources");
  await page.getByLabel("Replay track JSON").setInputFiles({
    name: "track.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"formatVersion":1}'),
  });
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/import?kind=replay-track") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Queue track import" }).click();
  expect((await response).status()).toBe(202);
  await expect(page.getByText(/Track import queued/)).toBeVisible();
  await page.getByRole("button", { name: "Reload status" }).click();
  await expect(page.getByText("replay-track", { exact: true }).first()).toBeVisible();
});

test("replay metadata uploads stay local and queue worker validation", async ({ page }) => {
  await page.goto("/sources");
  await page.getByLabel("Replay file", { exact: true }).setInputFiles({
    name: "fixture.rofl",
    mimeType: "application/octet-stream",
    buffer: roflFixture(),
  });
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/import?kind=replay-metadata") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Queue replay metadata" }).click();
  expect((await response).status()).toBe(202);
  await expect(page.getByText(/Replay metadata import queued/)).toBeVisible();
  await page.getByRole("button", { name: "Reload status" }).click();
  await expect(page.getByText("Replay metadata", { exact: true }).first()).toBeVisible();
});

test("regional ladders show samples, paginate and reject invalid regions and pages", async ({
  page,
}) => {
  await page.goto("/leaderboards/euw1?pageSize=1");
  await expect(page.getByRole("heading", { name: "EUW1 leaderboard" })).toBeVisible();
  const table = page.getByRole("table", { name: "EUW1 solo queue ladder" });
  await expect(table).toContainText("Ladder fixture#EUW");
  await expect(table).toContainText("Ahri · 1 game");
  await expect(table).toContainText("55.6% · 180 games");
  await expect(page.getByText(/Last refreshed/)).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2&pageSize=1/);
  await expect(table).toContainText("Riot ID not resolved");
  await expect(table).not.toContainText("Ladder fixture#EUW");
  await page.getByRole("link", { name: "KR", exact: true }).click();
  await expect(page.getByText("No ladder stored for this region")).toBeVisible();
  await page.goto("/leaderboards/euw1?pageSize=101");
  await expect(
    page.getByRole("alert").filter({ hasText: "page size from 1 to 100" }),
  ).toBeVisible();
  const invalid = await page.goto("/leaderboards/europe");
  expect(invalid?.status()).toBe(404);
});

test("solo queue profiles use stable player IDs and show samples and ladder history", async ({
  page,
}) => {
  const puuid = "a".repeat(78);
  await page.goto("/leaderboards/euw1");
  await page.getByRole("link", { name: "Ladder fixture#EUW", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/summoners/" + puuid + "$"));
  await expect(
    page.getByRole("heading", { name: "Ladder fixture#EUW", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Recent ranked solo games" })).toContainText(
    "EUW1_7000000001",
  );
  await expect(page.getByRole("table", { name: "Sampled champion pool" })).toContainText("Ahri");
  await expect(page.getByRole("img", { name: "EUW1 LP history", exact: true })).toBeVisible();
  await page.getByText("View data for EUW1 LP history", { exact: true }).click();
  const data = page.getByRole("table", { name: "EUW1 LP history data" });
  await expect(data).toContainText("1500");
  await expect(data).toContainText("Unknown");
  await page.getByRole("link", { name: "KR", exact: true }).click();
  await expect(page.getByRole("table", { name: "Recent ranked solo games" })).toContainText(
    "No sampled games",
  );
  await expect(page.getByText("No ladder snapshots in this window")).toBeVisible();
  await page.goto("/summoners/" + puuid + "?page=0");
  await expect(page.getByRole("alert").filter({ hasText: "positive page numbers" })).toBeVisible();
  const missing = await page.goto("/summoners/" + "x".repeat(78));
  expect(missing?.status()).toBe(404);
});

test("pro account link uploads queue the whole evidence file for local validation", async ({
  page,
}) => {
  await page.goto("/sources");
  await page.getByLabel("Pro account link JSON").setInputFiles({
    name: "pro-links.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(proAccountFixture())),
  });
  const queued = page.waitForResponse((r) =>
    r.url().includes("/api/import?kind=pro-account-links"),
  );
  await page.getByRole("button", { name: "Queue pro account links", exact: true }).click();
  expect((await queued).status()).toBe(202);
  await expect(
    page.getByRole("status").filter({ hasText: "Pro account link import queued" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Pro account links" })
      .filter({ hasText: "queued" })
      .first(),
  ).toBeVisible();
});

test("pro solo queue feed filters linked games, paginates and validates URLs", async ({ page }) => {
  await page.goto("/leaderboards/pros?pageSize=1");
  const table = page.getByRole("table", { name: "Recent pro solo queue games" });
  await expect(table).toContainText("Player Blue mid");
  await expect(table).toContainText("Ahri");
  await expect(table).toContainText("Acceptance Blue");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(table).toContainText("Player Red mid");
  await page.getByRole("button", { name: "Team" }).click();
  await page.getByRole("option", { name: "Acceptance Blue", exact: true }).click();
  await expect(table).toContainText("Player Blue mid");
  await expect(page).toHaveURL(/team=oracle%3Ateam%3A10/);
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.goto("/leaderboards/pros?league=Missing");
  await expect(page.getByText("No linked solo queue games")).toBeVisible();
  await page.goto("/leaderboards/pros?pageSize=101");
  await expect(page.getByRole("alert").filter({ hasText: "valid team and league" })).toBeVisible();
});

test("champion trends show missing comparisons and validate source and role filters", async ({
  page,
}) => {
  await page.goto("/trending");
  await expect(
    page.getByRole("heading", { name: "Trending champions", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Champion changes between patches" });
  await expect(table).toContainText("Ahri");
  await expect(table).toContainText("Unknown change");
  await expect(page.getByRole("status")).toContainText("No preceding catalog patch");
  await page.getByText("How a trend qualifies").click();
  await expect(page.getByText(/Both patches need at least 50/)).toBeVisible();
  await page.getByRole("button", { name: /Source$/ }).click();
  await page.getByRole("option", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: /Role$/ }).click();
  await page.getByRole("option", { name: "Mid", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/source=pro/);
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(table).toContainText("Ahri");
  await page.goto("/trending?page=10000");
  await expect(table).toContainText("No champion aggregates for this role and page");
  await page.goto("/trending?source=other");
  await expect(page.getByRole("alert").filter({ hasText: "Solo queue or Pro" })).toBeVisible();
});

test("patch overview explains low samples and returns not found for unknown patches", async ({
  page,
}) => {
  await page.goto("/patches/16.4");
  await expect(page.getByRole("heading", { name: "Patch 16.4", exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Biggest risers in solo queue" })).toContainText(
    "No qualifying changes",
  );
  await expect(page.getByRole("table", { name: "Newly observed three-item cores" })).toContainText(
    "No qualifying new builds",
  );
  await expect(page.getByRole("table", { name: "Pro pick and ban presence" })).toContainText(
    "Too little pro draft data",
  );
  await page.getByRole("link", { name: "Trending champions" }).click();
  await expect(page).toHaveURL(/trending\?patch=16.4/);
  expect((await page.goto("/patches/16.99"))?.status()).toBe(404);
  expect((await page.goto("/patches/16.4.1"))?.status()).toBe(404);
});

test("champion players explain their minimum sample and validate sort and page selections", async ({
  page,
}) => {
  await page.goto("/champions/Ahri?source=solo&patch=16.4&role=MIDDLE");
  const section = page.getByRole("region", { name: "Top sampled ladder players" });
  await expect(section).toContainText("At least 10 retained ranked solo games");
  await expect(section.getByRole("table")).toContainText(
    "No current ladder players have enough sampled games",
  );
  await section.getByRole("button", { name: /Sort players by$/ }).click();
  await page.getByRole("option", { name: "Win rate", exact: true }).click();
  await section.getByRole("button", { name: "Sort players", exact: true }).click();
  await expect(page).toHaveURL(/playersSort=winRate/);
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(section.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.goto("/champions/Ahri?playersPage=0");
  await expect(page.getByRole("alert").filter({ hasText: "Choose filters" })).toBeVisible();
});

test("champion matchups show sampled metrics, switch values and validate selections", async ({
  page,
}) => {
  await page.goto("/champions/Ahri?source=solo&patch=16.4&role=MIDDLE");
  await page.getByRole("link", { name: "Lane matchups", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ahri matchups" })).toBeVisible();
  // One seeded lane game: the stored blindability score stays unknown, with its reason.
  await expect(page.getByLabel("Blindability statistics")).toContainText(
    "Blindability scoreUnknown",
  );
  await expect(page.getByRole("status").filter({ hasText: "Score unavailable" })).toContainText(
    "Fewer than 3 opponents",
  );
  await page.getByText("How blindability is calculated").click();
  await expect(page.getByText(/E = Σ wᵢ·pᵢ/)).toBeVisible();
  const table = page.getByRole("table", { name: "Ahri lane opponents" });
  await expect(table).toContainText("Unknown · n=1");
  await expect(table).toContainText("Team first blood");
  await expect(table).toContainText("XP Δ at 15");
  await page.getByRole("button", { name: /Values$/ }).click();
  await page.getByRole("option", { name: "Raw", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/value=raw/);
  await expect(table).toContainText("Unknown · n=1");
  await page.goto("/champions/Ahri/matchups?patch=16.4&page=2");
  await expect(table).toContainText("No matchup observations on this page");
  await page.goto("/champions/Ahri/matchups?source=all");
  await expect(page.getByRole("alert").filter({ hasText: "Choose Solo queue" })).toBeVisible();
  const missing = await page.goto("/champions/NoSuchChampion/matchups");
  expect(missing?.status()).toBe(404);
});
test("the draft assistant ranks stored candidates from the URL and excludes picks and bans", async ({
  page,
}) => {
  await page.goto("/drafts");
  await page.getByRole("link", { name: "Draft assistant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Draft assistant" })).toBeVisible();
  await page.getByLabel("Bans").fill("Zzz");
  await page.getByRole("button", { name: "Rank candidates" }).click();
  await expect(page).toHaveURL(/bans=Zzz/);
  const table = page.getByRole("table", { name: "Ranked candidates for Mid" });
  await expect(table).toContainText("Ahri");
  await expect(page.getByRole("status").filter({ hasText: "ignored" })).toContainText("Zzz");
  await page.goto("/drafts/assistant?patch=16.4&blue=Ahri:TOP");
  await expect(table).not.toContainText("Ahri");
  await page.goto("/drafts/assistant?blue=Ahri,Ahri");
  await expect(page.getByRole("alert").filter({ hasText: "Enter picks" })).toBeVisible();
  await expect(page.getByLabel("Blue picks")).toHaveValue("Ahri,Ahri");
});

test("role counter-pick values list stored values with reasons and validate filters", async ({
  page,
}) => {
  await page.goto("/champions/Ahri/matchups?patch=16.4&role=MIDDLE");
  await expect(page.getByLabel("Counter-pick statistics")).toContainText(
    "Counter-pick valueUnknown",
  );
  await page.getByRole("link", { name: "Role counter-pick values" }).click();
  await expect(page.getByRole("heading", { name: "Mid counter-pick values" })).toBeVisible();
  const table = page.getByRole("table", { name: "Mid counter-pick values" });
  await expect(table).toContainText("Ahri");
  await expect(table).toContainText("Fewer than 3 opponents");
  await page.getByRole("button", { name: /Sort by$/ }).click();
  await page.getByRole("option", { name: "Lane games", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/sort=games/);
  await expect(table).toContainText("Ahri");
  await page.goto("/matchups/MIDDLE/counter-picks?sort=name");
  await expect(page.getByRole("alert").filter({ hasText: "Choose Solo queue" })).toBeVisible();
  const missing = await page.goto("/matchups/ALL/counter-picks");
  expect(missing?.status()).toBe(404);
});

test("aggregate tables download as CSV with the page's filters", async ({ page }) => {
  await page.goto("/tier-list?patch=16.4&role=MIDDLE");
  const [tier] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download CSV" }).click(),
  ]);
  expect(tier.suggestedFilename()).toBe("tier-list-solo-16.4-MIDDLE.csv");
  const csv = await readFile(await tier.path(), "utf8");
  expect(csv.split("\r\n")[0]).toContain("champion_key,champion_id,champion_name,role,games");
  expect(csv).toContain(",Ahri,Ahri,MIDDLE,1,1,");
  await page.goto("/champions/Ahri/matchups?patch=16.4&role=MIDDLE");
  const link = page.getByRole("link", { name: "Download CSV" });
  await expect(link).toHaveAttribute(
    "href",
    "/api/export/champion-matchups?champion=Ahri&source=solo&patch=16.4&role=MIDDLE&sort=games&order=desc",
  );
  const matchups = await page.request.get((await link.getAttribute("href"))!);
  expect(matchups.headers()["content-type"]).toBe("text/csv; charset=utf-8");
  // One game: rates are below the minimum, so they are empty, with their sample counts.
  expect(await matchups.text()).toMatch(/\r\nsolo,16\.4,MIDDLE,103,Ahri,Ahri,\d+,\w+,[^,]+,1,,,1,/);
  expect((await page.request.get("/api/export/tier-list?role=SUPPORT")).status()).toBe(400);
  expect((await page.request.get("/api/export/unknown")).status()).toBe(404);
});

test("role matchup matrices retain null-cell samples and expose a table alternative", async ({
  page,
}) => {
  await page.goto("/matchups/MIDDLE?patch=16.4");
  await expect(page.getByRole("heading", { name: "Mid matchup matrix" })).toBeVisible();
  const grid = page.getByRole("img", { name: "Mid matchups: Win rate (%) · shrunk" });
  await expect(grid.locator('rect[fill-opacity="0"]')).toHaveCount(4);
  await expect(grid).toContainText("Unknown; samples: 1");
  await page
    .getByText("View data for Mid matchups: Win rate (%) · shrunk", { exact: true })
    .click();
  const table = page.getByRole("table", { name: "Mid matchups: Win rate (%) · shrunk data" });
  await expect(table).toBeVisible();
  await expect(table).toContainText("Unknown");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("link", { name: "Ahri matchups", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ahri matchups" })).toBeVisible();
  await page.goto("/matchups/MIDDLE?source=pro&patch=16.4&metric=gold10&value=raw&columnPage=2");
  await expect(page.getByText("No observations available", { exact: true })).toBeVisible();
  await page.goto("/matchups/MIDDLE?columnPage=0");
  await expect(page.getByRole("alert").filter({ hasText: "Choose Solo queue" })).toBeVisible();
  const missing = await page.goto("/matchups/ALL");
  expect(missing?.status()).toBe(404);
});
