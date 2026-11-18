import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "axe-core";

async function openSettings(page: Page) {
  const openNavigation = page.getByRole("button", { name: "Open Navigation" });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
}

test("browse filters, SQL pages, match details and spoiler control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Test player shell</p>" }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matches", exact: true })).toBeVisible();
  await expect(page.getByText("Result Hidden")).toHaveCount(0);
  await page.getByRole("button", { name: /All Leagues/ }).click();
  await page.getByRole("option", { name: "LCK", exact: true }).click();
  await expect(page).toHaveURL(/league=LCK/);
  expect(new URL(page.url()).searchParams.has("date")).toBe(false);
  await expect(page.getByText(/30 records/)).toBeVisible();
  const firstMatch = page.locator(".np-match-row").first();
  const teamLayout = await firstMatch.evaluate((row) => {
    const teams = row.querySelectorAll<HTMLElement>(".np-match-team");
    const names = row.querySelectorAll<HTMLElement>(".np-match-team__name");
    const versus = row.querySelector<HTMLElement>(".np-match-vs")!;
    const leftLogo = teams[0]!.querySelector<HTMLElement>(".np-avatar")!;
    const rightLogo = teams[1]!.querySelector<HTMLElement>(".np-avatar")!;
    const primary = row.querySelector<HTMLElement>(".np-match-row__primary")!;
    const leftTeam = teams[0]!.getBoundingClientRect();
    const rightTeam = teams[1]!.getBoundingClientRect();
    const leftName = names[0]!.getBoundingClientRect();
    const rightName = names[1]!.getBoundingClientRect();
    const versusBox = versus.getBoundingClientRect();
    const primaryBox = primary.getBoundingClientRect();
    const leftLogoBox = leftLogo.getBoundingClientRect();
    const rightLogoBox = rightLogo.getBoundingClientRect();
    return {
      sideBySide: window.matchMedia("(min-width: 851px)").matches,
      leftGap: versusBox.left - leftTeam.right,
      rightGap: rightTeam.left - versusBox.right,
      versusOffset: Math.abs(
        versusBox.left + versusBox.width / 2 - (primaryBox.left + primaryBox.width / 2),
      ),
      // Logos sit inside, beside the scores: name, logo, score vs score, logo, name.
      logosInside: leftLogoBox.left > leftName.right && rightLogoBox.right < rightName.left,
      rightNameClipped: names[1]!.scrollWidth > names[1]!.clientWidth,
    };
  });
  if (teamLayout.sideBySide) {
    expect(Math.abs(teamLayout.leftGap - teamLayout.rightGap)).toBeLessThanOrEqual(1);
    expect(teamLayout.versusOffset).toBeLessThanOrEqual(1);
  }
  if (teamLayout.sideBySide) expect(teamLayout.logosInside).toBe(true);
  expect(teamLayout.rightNameClipped).toBe(false);
  const watchButtons = page.locator(".ev-watch-toggle");
  const watchTop = () =>
    watchButtons.first().evaluate((button) => button.getBoundingClientRect().top + window.scrollY);
  const watchButtonTop = await watchTop();
  await watchButtons.first().click();
  await expect(page.getByRole("region", { name: "Watch Match" })).toBeVisible();
  expect(Math.abs((await watchTop()) - watchButtonTop)).toBeLessThanOrEqual(1);
  await expect(watchButtons.first()).toHaveText("Watch Stream");
  await expect(page.locator(".np-match-row__expanded")).toHaveCount(1);
  await expect(page.locator(".ev-inline-stream")).toHaveCSS("position", "static");
  // The first row is an upcoming match, which opens its live Twitch channel, loaded but paused.
  await expect(page.getByRole("button", { name: /Broadcast/ })).toContainText("Twitch");
  await expect(page.getByRole("button", { name: "Load Stream" })).toHaveCount(0);
  const streamBox = await page.locator(".ev-inline-stream .np-stream-shell").boundingBox();
  expect(streamBox?.width).toBeLessThanOrEqual(840);
  const broadcastBox = await page.getByRole("button", { name: /Broadcast/ }).boundingBox();
  if (teamLayout.sideBySide)
    expect(broadcastBox!.x).toBeGreaterThan(streamBox!.x + streamBox!.width);
  await expect(page.locator(".ev-inline-stream iframe")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Unload Player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Player Not Working" })).toHaveCount(0);
  await watchButtons.nth(1).click();
  await expect(watchButtons.first()).toHaveAttribute("aria-expanded", "false");
  await expect(watchButtons.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "Watch Match" })).toHaveCount(1);
  await expect(page.locator(".ev-inline-stream iframe")).toHaveCount(1);
  await watchButtons.nth(1).click();
  await expect(page.getByRole("region", { name: "Watch Match" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Filter Matches" }).fill("Acceptance Blue");
  await expect(page).toHaveURL(/q=Acceptance\+Blue/);
  await page.goto("/");
  await page.getByRole("button", { name: "Next Page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/30 records · Page 2/)).toBeVisible();
  await page.goto("/?state=scheduled");
  await expect(page.locator(".np-match-row").getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 records/)).toBeVisible();
  await page.goto("/?date=2026-02-28&league=LCK");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await expect(page.getByText("Result Hidden")).toHaveCount(0);
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Test player shell</p>" }),
  );
  await page
    .getByRole("link", { name: /Acceptance Blue versus Acceptance Red/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Acceptance Blue 2 vs 1 Acceptance Red",
  );
  // Each played game has its own tab; an unconfirmed archive record is said plainly.
  const tabs = page.getByRole("navigation", { name: "Series" });
  await expect(tabs.locator("time")).toHaveText("Feb 28, 2026");
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const vodUrl = "https://www.youtube.com/watch?v=AbCdEfGhIjK";
  await expect(page.getByRole("link", { name: "Watch Game 1 VOD" })).toHaveAttribute(
    "href",
    vodUrl,
  );
  await page.getByRole("link", { name: "Open Game 1" }).click();
  await expect(page.getByRole("link", { name: "Watch Game VOD" })).toHaveAttribute("href", vodUrl);
  await expect(page).toHaveURL(/\/games\/1$/);
  await expect(tabs.getByRole("link", { name: "Game 1" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Game Details Not Available Yet")).toBeVisible();
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { name: "Games", level: 2 })).toBeVisible();
  expect((await page.goto("/matches/pandascore%3Amatch%3A1/games/9"))?.status()).toBe(404);
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
    const openNavigation = page.getByRole("button", { name: "Open Navigation" });
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

test("team finder and profile keep season, series and archive games accessible", async ({
  page,
}, info) => {
  if (info.project.name === "desktop-chromium")
    await page.setViewportSize({ width: 1960, height: 1160 });
  await page.goto("/teams?q=Acceptance&league=LCK");
  await page.getByRole("link", { name: /Acceptance Blue/ }).click();
  await expect(page.getByRole("heading", { name: "Current Roster" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Observed Player/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Season/ })).toContainText("2026");
  await expect(page.locator("main .np-match-row")).toHaveCount(5);
  await expect(page.getByText(/refresh overdue/)).toHaveCount(0);
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-team-profile.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page.getByRole("table", { name: "Historical Games" })).toBeVisible();
  await page.getByRole("button", { name: /Season/ }).click();
  await page.getByRole("option", { name: "All Years" }).click();
  await expect(page).toHaveURL(/year=all/);
  await expect(page.getByRole("link", { name: "Series", exact: true })).toHaveAttribute(
    "href",
    /year=all/,
  );
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
  await expect(page.getByRole("table", { name: "Current Roster" })).toBeVisible();
  await expect(page.getByText("100.0%")).toBeVisible();
  await page.getByRole("table", { name: "Historical Games" }).getByRole("link").first().click();
  await expect(page.getByRole("table", { name: "Acceptance Blue Lineup" })).toBeVisible();
  await expect(page.getByText("Hidden", { exact: true })).toHaveCount(0);
  await expect(page.getByText("5 / 2 / 7", { exact: true })).toHaveCount(10);
  await page.goto("/teams/pandascore%3Ateam%3A10");
  await expect(page.getByRole("link", { name: /Observed Player/ })).toBeVisible();
  await page.goto("/history?view=games");
  const recentGame = page.getByRole("table", { name: "Historical Games" }).getByRole("row").nth(1);
  await expect(recentGame.getByText("vs", { exact: true })).toBeVisible();
  await expect(recentGame.getByText("Winner", { exact: true })).toBeVisible();
  if (page.viewportSize()!.width >= 1050) {
    const bar = page.getByRole("navigation", { name: "Past Matches View" });
    const filter = page.getByRole("searchbox", { name: "Filter Games" });
    const [toggles, input] = await Promise.all([bar.boundingBox(), filter.boundingBox()]);
    expect(Math.abs(toggles!.y + toggles!.height - input!.y - input!.height)).toBeLessThan(2);
  }
  await page.goto("/history?year=2014");
  await expect(page.getByText("No Past Matches in This View")).toBeVisible();
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL(/year=2014&view=games/);
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
  await page.getByRole("button", { name: "Save Timezone" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Timezone saved." })).toBeVisible();
  await page.goto("/?date=2026-02-28");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await expect(
    page
      .locator(".np-match-row")
      .getByText(/^02\/28\/2026/)
      .first(),
  ).toBeVisible();
  await openSettings(page);
  await page.getByRole("switch", { name: "Hide Results" }).press("Space");
  await expect(page.getByRole("status").filter({ hasText: "Results are hidden." })).toBeVisible();
  await page.goto("/?date=2026-02-28");
  await expect(page.getByText("Result Hidden")).not.toHaveCount(0);
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "February 2026", level: 2 })).toBeVisible();
  await expect(page.getByText("Result Hidden")).not.toHaveCount(0);
  await page.goto("/history?view=games");
  await expect(page.getByRole("link", { name: /02\/28\/2026/ })).toBeVisible();
});
test("a finished match loads its paused replay and keeps an external fallback", async ({
  page,
}) => {
  const seriesUrl = "/matches/pandascore%3Amatch%3A1";
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Test player shell</p>" }),
  );
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto(seriesUrl);
  await expect(page.getByRole("heading", { name: "Watch Replay" })).toHaveCount(0);
  const frame = page.getByTitle("Match Broadcast");
  await expect(frame).toHaveAttribute("src", /youtube-nocookie\.com.*autoplay=0/);
  const cardBounds = await page.getByRole("link", { name: "Open Game 1" }).boundingBox();
  const replayBounds = await frame.boundingBox();
  expect(replayBounds!.x).toBeGreaterThan(cardBounds!.x + cardBounds!.width);
  const streams = page.getByRole("button", { name: /\bStream\b/ });
  await expect(streams).toContainText("YouTube · English");
  const streamsBounds = await streams.boundingBox();
  expect(streamsBounds!.y).toBeGreaterThanOrEqual(replayBounds!.y + replayBounds!.height);
  expect(streamsBounds!.x + streamsBounds!.width).toBeCloseTo(
    replayBounds!.x + replayBounds!.width,
    -1,
  );
  await streams.click();
  await page.getByRole("option", { name: "YouTube · Korean" }).click();
  await expect(frame).toHaveAttribute("src", /zyxwvutsrqp.*autoplay=0/);
  await expect(page.getByRole("option", { name: /Twitch/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(seriesUrl);
  const replay = page.locator("summary").filter({ hasText: /^Replay$/ });
  await expect(page.locator("iframe")).toHaveCount(0);
  await replay.click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com.*autoplay=0/);
  await expect(page.getByRole("button", { name: /Broadcast/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Player Not Working" })).toHaveCount(0);
  await page
    .frameLocator('iframe[title="Match Broadcast"]')
    .locator("body")
    .evaluate((body) =>
      body.ownerDocument.defaultView?.parent.postMessage(
        JSON.stringify({ event: "onError", info: 150 }),
        "*",
      ),
    );
  await expect(page.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute(
    "href",
    /youtube\.com/,
  );
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("data management pages and import endpoints are not part of the app", async ({ page }) => {
  expect((await page.goto("/sources"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Data Management" })).toHaveCount(0);
  for (const path of ["/api/refresh", "/api/import"]) {
    const response = await page.request.post(path, {
      data: { kind: "matches" },
      headers: { origin: "http://127.0.0.1:3100" },
    });
    expect(response.status()).toBe(404);
  }
  await page.goto("/history");
  await expect(page.getByRole("link", { name: "Manage Imports" })).toHaveCount(0);
});
test("the tier list filters by role and source and sorts in SQL", async ({ page }) => {
  await page.goto("/tier-list");
  const table = page.getByRole("table", { name: "Champion Tier List" });
  // Ten picked champions and one only banned, from one solo-queue game.
  await expect(table.getByRole("row")).toHaveCount(12);
  await expect(page.getByText(/Patch 16\.4 · 1 game/)).toBeVisible();
  const choose = async (label: string, option: string) => {
    await page.locator(".np-select", { hasText: label }).getByRole("button").click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose("Role", "Mid");
  await choose("Sort By", "Win Rate");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(page).toHaveURL(/sort=winRate/);
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1).getByRole("img", { name: "Ahri" })).toBeVisible();
  await expect(table.getByRole("row").nth(1)).toContainText("Too Few Games");
  await choose("Order", "Lowest First");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/order=asc/);
  await expect(
    table.getByRole("row").nth(1).getByRole("img", { name: "Champion 157" }),
  ).toBeVisible();
  await choose("Source", "Pro");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/source=pro/);
  await expect(table.getByRole("row").nth(1).getByRole("img", { name: "Ahri" })).toBeVisible();
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
  const stats = page.getByRole("region", { name: "Champion Statistics" });
  await expect(
    page.getByRole("region", { name: "Champion", exact: true }).getByText("Patch 16.4"),
  ).toBeVisible();
  await expect(stats).toContainText("1 Results100.0%");
  await expect(stats).toContainText("Tier");
  await expect(page.getByRole("img", { name: "Ahri Pick Rate by Patch" })).toContainText("16.4");
  // The seeded game's timeline opens with Doran's Ring; one game is below the minimum sample.
  const build = page.getByRole("region", { name: "Most Common Build" });
  await expect(build.getByRole("region", { name: "Starting Items" })).toContainText(
    "Too Few Games (1)",
  );
  await expect(build.getByRole("img", { name: "Doran's Ring" })).toBeVisible();
  await page.getByText("All Builds, Runes and Skills").click();
  const start = page.getByRole("table", { name: "Starting Items" });
  await expect(start).toContainText("Doran's Ring");
  await expect(page.getByRole("table", { name: "Keystones" })).toContainText("Electrocute");
  await expect(page.getByRole("table", { name: "Summoner Spells" })).toContainText("Flash");
  // The seeded timeline levels Ahri's Q once: too few skill-ups to decide an order.
  await expect(page.getByText(/1 for the first levels, 1 for the max order/)).toBeVisible();
  // One game is below the minimum sample for every bucket.
  await expect(page.getByRole("region", { name: "When It Wins" })).toContainText(
    "No bucket has enough results yet.",
  );
  // Ahri's four teammates from the seeded game; the catalog fixture names only a few champions.
  await expect(
    page.getByRole("table", { name: "Allies" }).getByRole("img", { name: "Champion 412" }),
  ).toBeVisible();
  await expect(page.getByText("4 allies · Page 1")).toBeVisible();
  await page.locator(".np-select", { hasText: "Sort Allies By" }).getByRole("button").click();
  await page.getByRole("option", { name: "Delta", exact: true }).click();
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await expect(page).toHaveURL(/synergySort=delta/);
  await expect(page).toHaveURL(/source=solo/);
  await expect(page.getByText("Bot-Lane Pairs: Win Rate (%)").first()).toBeAttached();
  // The seeded pro draft picks Ahri once.
  await expect(page.getByLabel("Pro-Play Statistics")).toContainText("Presence1 Games100.0%");
  await page.locator(".np-select", { hasText: "League" }).getByRole("button").click();
  await page.getByRole("option", { name: "Draft acceptance", exact: true }).click();
  await page.getByRole("button", { name: "Apply League" }).click();
  await expect(page).toHaveURL(/league=Draft\+acceptance/);
  await expect(page.getByLabel("Pro-Play Statistics")).toContainText("Picks / BansDrafts1 / 0");
  await page.goto("/champions/Ahri?source=pro");
  await expect(
    page.getByRole("navigation", { name: "Source" }).locator('[aria-current="page"]'),
  ).toHaveText("Pro Play");
  await expect(
    page.getByRole("navigation", { name: "Role" }).locator('[aria-current="page"]'),
  ).toHaveAccessibleName("All Roles");
  const missing = await page.goto("/champions/NotAChampion");
  expect(missing?.status()).toBe(404);
});
test("a solo game charts win probability with the model's calibration and event markers", async ({
  page,
}) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await expect(page.getByRole("heading", { name: "Blue side won" })).toBeVisible();
  await expect(page.getByText(/model v1 \(#1, features v1\)/)).toBeVisible();
  await expect(page.getByText("Blue Side Win Probability by Minute").first()).toBeAttached();
  const events = page.getByRole("table", { name: "Kills and Objectives" });
  await expect(events).toContainText("Blue: Fire Dragon");
  await expect(
    page.getByRole("table", { name: "Players" }).getByRole("img", { name: "Ahri" }).first(),
  ).toBeVisible();
  // The pre-game draft probability: one stored game is below every input's minimum sample.
  const draft = page.getByLabel("Draft Win Probability by Side");
  await expect(draft).toContainText("Blue side");
  await expect(draft).toContainText("Champion Strength coverage0 of 10");
  await expect(page.getByText(/Brier score on 0 held-out games: unknown/)).toBeVisible();
  await page.getByText("Inputs and Samples").click();
  await expect(page.getByRole("table", { name: "Draft Model Inputs" })).toContainText("Ahri vs");
  const missing = await page.goto("/solo-games/EUW1_1");
  expect(missing?.status()).toBe(404);
});
test("a solo game's map replays timeline positions with keyboard controls and toggles", async ({
  page,
}) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await page.getByRole("link", { name: "Game Map" }).click();
  await expect(page).toHaveURL(/\/solo-games\/EUW1_7000000001\/map$/);
  await expect(page.getByRole("heading", { name: "Game Map", level: 1 })).toBeVisible();
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
  await expect(page.getByText("Too Few Games to Draw")).toBeVisible();
  await expect(page.locator(".np-minimap")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Heatmap Type" })
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
  const section = page.getByRole("region", { name: "Early Jungle Paths" });
  await expect(section).toContainText("Inferred from 0 jungle games on patch 16.4");
  await expect(section).toContainText("Red side is rotated onto blue side");
  await expect(section.getByText("No Jungle Games")).toBeVisible();
  // Outside the jungle role a champion without jungle games shows no section.
  await page.goto("/champions/Ahri");
  await expect(page.getByRole("heading", { name: "Ahri", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Early Jungle Paths" })).toHaveCount(0);
});
test("the game map switches to a linked replay track inside its interval and lists movements", async ({
  page,
}) => {
  await page.goto("/solo-games/EUW1_7000000001/map");
  const note = page.getByRole("note");
  await expect(note).toContainText("Source at 0:00: Riot match timeline");
  await expect(note).toContainText("An imported replay track covers 0:30 to 0:50.");
  const movements = page.getByRole("table", { name: "Detected Movements" });
  await expect(movements).toContainText("Recall: Ahri");
  await movements.getByRole("button", { name: "Go to 0:40" }).press("Enter");
  await expect(note).toContainText("Source at 0:40: imported replay track, about 4 samples");
  const positions = page.getByRole("table", { name: "Positions at 0:40" });
  await expect(positions).toContainText("7000, 7000 (track sample, confidence 0.90)");
  await expect(positions).toContainText("9000, 9000 (track sample, low confidence 0.20)");
  await expect(page.locator(".np-minimap__point--low")).toHaveCount(1);
  await expect(page.locator(".np-minimap__path").first()).toBeAttached();
  // A quarter-second step at four samples per second reaches the recall.
  await page.getByLabel(/^Game time/).press("ArrowRight");
  await expect(page.getByRole("table", { name: /^Positions at 0:40/ })).toContainText(
    "500, 500 (track sample, confidence 0.90)",
  );
  const range = await page.request.get(
    "/api/solo-games/EUW1_7000000001/track?fromMs=35000&toMs=36000",
  );
  expect(range.status()).toBe(200);
  const samples = (await range.json()) as { positions: { x: number | null }[] }[];
  expect(samples).toHaveLength(5);
  expect(samples.every((s) => s.positions[1]!.x === null)).toBe(true);
  expect(
    (await page.request.get("/api/solo-games/EUW1_7000000001/track?fromMs=0&toMs=200000")).status(),
  ).toBe(400);
});
test("comparisons show two champions or patches with samples, and views save only in the browser", async ({
  page,
}) => {
  await page.goto("/compare/champions");
  await page.getByLabel("First champion id").fill("Ahri");
  await page.getByLabel("Second champion id").fill("MonkeyKing");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page).toHaveURL(/\/compare\/champions\?a=Ahri&b=MonkeyKing/);
  const champions = page.getByRole("table", { name: "Ahri and Wukong, All roles" });
  await expect(champions.getByRole("columnheader", { name: "Sample" })).toHaveCount(2);
  // Wukong has no stored games: unknown values with a zero sample, never zero rates.
  await expect(champions.getByRole("row", { name: /^Win rate / }).first()).toContainText(
    "Unknown0",
  );
  const saved = page
    .waitForRequest((r) => r.method() !== "GET", { timeout: 1000 })
    .catch(() => null);
  await page.getByLabel("View Name").fill("Ahri vs Wukong");
  await page.getByRole("button", { name: "Save This View" }).click();
  await expect(page.getByText('Saved "Ahri vs Wukong" in this browser.')).toBeVisible();
  // Saving writes nothing to the server.
  expect(await saved).toBeNull();
  // An invalid stored entry is dropped when read; the page still works.
  await page.evaluate(() => {
    const views = JSON.parse(localStorage.getItem("summonersnet-saved-views") ?? "[]") as unknown[];
    localStorage.setItem(
      "summonersnet-saved-views",
      JSON.stringify([...views, { id: "bad", name: "Elsewhere", path: "https://example.com" }]),
    );
  });
  await page.goto("/saved-views");
  const list = page.getByRole("list", { name: "Saved Views" });
  await expect(list.getByRole("link", { name: "Ahri vs Wukong" })).toHaveAttribute(
    "href",
    /\/compare\/champions\?a=Ahri&b=MonkeyKing/,
  );
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.goto("/compare/patches?a=16.4&b=16.3");
  await expect(
    page
      .getByRole("table", { name: "Patch 16.4 and patch 16.3, All Roles" })
      .getByRole("img", { name: "Ahri", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Patch 16.3 has no stored statistics")).toBeVisible();
  await page.goto("/compare/champions?a=Ahri&b=..%2Fx");
  await expect(page.getByText(/^Choose two champion ids/)).toBeVisible();
});
test("win probability added leaderboards rank champions and roles from the active model", async ({
  page,
}) => {
  await page.goto("/leaderboards/wpa");
  await expect(page.getByText(/Patch 16\.4 · model v1 \(#1/)).toBeVisible();
  const champions = page.getByRole("table", { name: "Champions by win probability added" });
  await expect(champions.getByRole("row")).toHaveCount(11);
  await expect(champions).toContainText("Too Few Games");
  await page.goto("/leaderboards/wpa?kind=role&sort=games");
  await expect(page.getByRole("table", { name: "Roles by win probability added" })).toContainText(
    "Support",
  );
  await page.goto("/leaderboards/wpa?kind=team");
  await expect(page.getByText(/Choose a board/)).toBeVisible();
});
test("a pro game without checkpoint probabilities omits the win probability panel", async ({
  page,
}) => {
  await page.goto("/games/oracle%3Agame%3Aacceptance-game");
  const reveal = page.getByRole("button", { name: "Reveal Game Statistics" });
  if (await reveal.isVisible()) await reveal.click();
  await expect(page.locator("summary").filter({ hasText: /^Win Probability$/ })).toHaveCount(0);
});
test("model diagnostics show versions, calibration and named weights", async ({ page }) => {
  await page.goto("/solo-games/EUW1_7000000001");
  await page.getByRole("link", { name: "Model Diagnostics" }).click();
  await expect(page).toHaveURL(/\/models\?model=1/);
  await expect(page.getByRole("heading", { name: "Model Diagnostics", level: 1 })).toBeVisible();
  await expect(page.getByRole("table", { name: "Model Versions" })).toContainText(
    "Solo Queue (Timelines)",
  );
  await expect(
    page.getByText("Reliability: Predicted vs Observed Blue Win Rate (%)").first(),
  ).toBeAttached();
  await expect(page.getByRole("table", { name: "Feature Weights" })).toContainText(
    "Gold difference (per 5,000)",
  );
  await page.goto("/models?model=nope");
  await expect(page.getByText("Choose a model from the list.")).toBeVisible();
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
  await expect(page.getByRole("table", { name: "Acceptance Blue Lineup" })).toBeVisible();
  const top = page
    .getByRole("table", { name: "Acceptance Blue Lineup" })
    .getByRole("img", { name: "Top", exact: true });
  await expect(top).toHaveCSS("background-image", /url\(.*\.png/);
  const lineups = page.getByRole("region", { name: "Lineups" });
  const columnWidths = await lineups
    .getByRole("table")
    .evaluateAll((tables) =>
      tables.map((table) =>
        Array.from(table.querySelectorAll("th"), (cell) =>
          Math.round(cell.getBoundingClientRect().width),
        ),
      ),
    );
  expect(columnWidths).toHaveLength(2);
  expect(columnWidths[0]).toEqual(columnWidths[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-game.png`,
    fullPage: true,
  });
});

test("canonical profiles share local portraits across search and rosters with text links in lineups", async ({
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
  await expect(page.getByText("Identity Details")).toHaveCount(0);
  await page.getByRole("table", { name: "Historical Games" }).getByRole("link").first().click();
  const player = page.getByRole("link", { name: /Player Blue mid/ });
  await expect(player.locator("img")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Mid", exact: true })).toHaveCount(2);
  const teamLogo = page.locator('[data-entity-kind="team"]').first();
  await expect(teamLogo).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(teamLogo.locator("img")).toHaveCSS("object-fit", "contain");
  await player.click();
  await expect(page).toHaveURL(/\/players\/player-blue-mid$/);
  await page.goto("/players/pandascore%3Aplayer%3A32");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Player Blue mid");
  await expect(page.getByRole("table", { name: "Current Roster" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Pro Drafts", exact: true })).toBeVisible();
  await expect(
    page.getByText("First-pick win rate: 100.0% · 1 game", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1 included · 0 excluded/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Pick and Ban Priority" })).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Blind and Counter Picks by Role" })
      .getByRole("img", { name: "Jinx", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `../../output/playwright/${info.project.name}-drafts.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Priority Pages" })
    .getByRole("button", { name: "Next Page" })
    .click();
  await expect(page).toHaveURL(/priorityPage=2/);
  expect(new URL(page.url()).searchParams.get("league")).toBe("Draft acceptance");
  expect(new URL(page.url()).searchParams.get("patch")).toBe("16.4");
  await page.getByLabel("Patch", { exact: true }).fill("99.99");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(
    page.getByText("First-pick win rate: Unknown · 0 games", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No draft priority observations match these filters.")).toBeVisible();
  await page.getByLabel("Patch", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter a patch");
});

test("regional ladders show samples, paginate and reject invalid regions and pages", async ({
  page,
}) => {
  await page.goto("/leaderboards/euw1?pageSize=1");
  await expect(page.getByRole("heading", { name: "EUW1 leaderboard" })).toBeVisible();
  const table = page.getByRole("table", { name: "EUW1 solo queue ladder" });
  await expect(table).toContainText("Ladder fixture#EUW");
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
  await expect(table).toContainText("55.6% · 180 games");
  await expect(page.getByText(/Last Refreshed/)).toBeVisible();
  await page.getByRole("button", { name: "Next Page" }).click();
  await expect(page).toHaveURL(/page=2&pageSize=1/);
  await expect(table).toContainText("Riot ID not resolved");
  await expect(table).not.toContainText("Ladder fixture#EUW");
  await page.getByRole("link", { name: "KR", exact: true }).click();
  await expect(page.getByText("No Ladder Stored for This Region")).toBeVisible();
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
  await expect(page.getByRole("table", { name: "Recent Ranked Solo Games" })).toContainText(
    "EUW1_7000000001",
  );
  await expect(
    page
      .getByRole("table", { name: "Sampled Champion Pool" })
      .getByRole("img", { name: "Ahri" })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "EUW1 LP history", exact: true })).toBeVisible();
  await page.getByText("View data for EUW1 LP history", { exact: true }).click();
  const data = page.getByRole("table", { name: "EUW1 LP history data" });
  await expect(data).toContainText("1500");
  await expect(data).toContainText("Unknown");
  await page.getByRole("link", { name: "KR", exact: true }).click();
  await expect(page.getByRole("table", { name: "Recent Ranked Solo Games" })).toContainText(
    "No sampled games",
  );
  await expect(page.getByText("No Ladder Snapshots in This Window")).toBeVisible();
  await page.goto("/summoners/" + puuid + "?page=0");
  await expect(page.getByRole("alert").filter({ hasText: "positive page numbers" })).toBeVisible();
  const missing = await page.goto("/summoners/" + "x".repeat(78));
  expect(missing?.status()).toBe(404);
});

test("pro solo queue feed filters linked games, paginates and validates URLs", async ({ page }) => {
  await page.goto("/leaderboards/pros?pageSize=1");
  const table = page.getByRole("table", { name: "Recent Pro Solo Queue Games" });
  await expect(table).toContainText("Player Blue mid");
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
  await expect(table).toContainText("Acceptance Blue");
  await page.getByRole("button", { name: "Next Page" }).click();
  await expect(table).toContainText("Player Red mid");
  await page.getByRole("button", { name: "Team" }).click();
  await page.getByRole("option", { name: "Acceptance Blue", exact: true }).click();
  await expect(table).toContainText("Player Blue mid");
  await expect(page).toHaveURL(/team=oracle%3Ateam%3A10/);
  await expect(page.getByRole("button", { name: "Next Page" })).toBeDisabled();
  await page.goto("/leaderboards/pros?league=Missing");
  await expect(page.getByText("No Linked Solo Queue Games")).toBeVisible();
  await page.goto("/leaderboards/pros?pageSize=101");
  await expect(page.getByRole("alert").filter({ hasText: "valid team and league" })).toBeVisible();
});

test("champion trends show missing comparisons and validate source and role filters", async ({
  page,
}) => {
  await page.goto("/trending");
  await expect(
    page.getByRole("heading", { name: "Trending Champions", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Champion Changes Between Patches" });
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
  await expect(table).toContainText("Unknown change");
  await expect(page.getByRole("status")).toContainText("No preceding catalog patch");
  await page.getByText("How a Trend Qualifies").click();
  await expect(page.getByText(/Both patches need at least 50/)).toBeVisible();
  await page.getByRole("button", { name: /Source$/ }).click();
  await page.getByRole("option", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: /Role$/ }).click();
  await page.getByRole("option", { name: "Mid", exact: true }).click();
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/source=pro/);
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
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
  await expect(page.getByRole("table", { name: "Newly Observed Three-Item Cores" })).toContainText(
    "No qualifying new builds",
  );
  await expect(page.getByRole("table", { name: "Pro Pick and Ban Presence" })).toContainText(
    "Too little pro draft data",
  );
  await page.getByRole("link", { name: "Trending Champions" }).click();
  await expect(page).toHaveURL(/trending\?patch=16.4/);
  expect((await page.goto("/patches/16.99"))?.status()).toBe(404);
  expect((await page.goto("/patches/16.4.1"))?.status()).toBe(404);
});

test("champion players explain their minimum sample and validate sort and page selections", async ({
  page,
}) => {
  await page.goto("/champions/Ahri?source=solo&patch=16.4&role=MIDDLE");
  const section = page.getByRole("region", { name: "Top Sampled Ladder Players" });
  await expect(section).toContainText("At least 10 retained ranked solo games");
  await expect(section.getByRole("table")).toContainText(
    "No current ladder players have enough sampled games",
  );
  await section.getByRole("button", { name: /Sort Players By$/ }).click();
  await page.getByRole("option", { name: "Win Rate", exact: true }).click();
  await section.getByRole("button", { name: "Sort Players", exact: true }).click();
  await expect(page).toHaveURL(/playersSort=winRate/);
  await expect(page).toHaveURL(/role=MIDDLE/);
  await expect(section.getByRole("button", { name: "Next Page" })).toBeDisabled();
  await page.goto("/champions/Ahri?playersPage=0");
  await expect(page.getByRole("alert").filter({ hasText: "Choose filters" })).toBeVisible();
});

test("champion matchups show sampled metrics, switch values and validate selections", async ({
  page,
}) => {
  await page.goto("/champions/Ahri?source=solo&patch=16.4&role=MIDDLE");
  await page.getByRole("link", { name: "Lane Matchups", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ahri matchups" })).toBeVisible();
  // One seeded lane game: the stored blindability score stays unknown, with its reason.
  await expect(page.getByLabel("Blindability Statistics")).toContainText(
    "Blindability scoreUnknown",
  );
  await expect(page.getByRole("status").filter({ hasText: "Score unavailable" })).toContainText(
    "Fewer than 3 opponents",
  );
  await page.getByText("How Blindability Is Calculated").click();
  await expect(page.getByText(/E = Σ wᵢ·pᵢ/)).toBeVisible();
  const table = page.getByRole("table", { name: "Ahri lane opponents" });
  await expect(table).toContainText("Unknown · n=1");
  await expect(table).toContainText("Team First Blood");
  await expect(table).toContainText("XP Δ at 15");
  await page.getByRole("button", { name: /Values$/ }).click();
  await page.getByRole("option", { name: "Raw", exact: true }).click();
  await page.getByRole("button", { name: "Apply Filters" }).click();
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
  await page.getByRole("link", { name: "Draft Assistant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Draft Assistant" })).toBeVisible();
  await page.getByLabel("Bans").fill("Zzz");
  await page.getByRole("button", { name: "Rank Candidates" }).click();
  await expect(page).toHaveURL(/bans=Zzz/);
  const table = page.getByRole("table", { name: "Ranked candidates for Mid" });
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "ignored" })).toContainText("Zzz");
  await expect(page.getByLabel("Draft Win Probability by Side")).toContainText("Blue side");
  await expect(table).toContainText("Draft Win Probability if Picked");
  await page.goto("/drafts/assistant?patch=16.4&blue=Ahri:TOP");
  await expect(table.getByRole("img", { name: "Ahri" })).toHaveCount(0);
  await page.goto("/drafts/assistant?blue=Ahri,Ahri");
  await expect(page.getByRole("alert").filter({ hasText: "Enter picks" })).toBeVisible();
  await expect(page.getByLabel("Blue Picks")).toHaveValue("Ahri,Ahri");
});

test("role counter-pick values list stored values with reasons and validate filters", async ({
  page,
}) => {
  await page.goto("/champions/Ahri/matchups?patch=16.4&role=MIDDLE");
  await expect(page.getByLabel("Counter-Pick Statistics")).toContainText(
    "Counter-pick valueUnknown",
  );
  await page.getByRole("link", { name: "Role Counter-Pick Values" }).click();
  await expect(page.getByRole("heading", { name: "Mid counter-pick values" })).toBeVisible();
  const table = page.getByRole("table", { name: "Mid counter-pick values" });
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
  await expect(table).toContainText("Fewer than 3 opponents");
  await page.getByRole("button", { name: /Sort By$/ }).click();
  await page.getByRole("option", { name: "Lane Games", exact: true }).click();
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/sort=games/);
  await expect(table.getByRole("img", { name: "Ahri" }).first()).toBeVisible();
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
  // One game against a champion missing from the catalog: its key stays, its name is empty, and
  // rates below the minimum are empty with their sample counts.
  expect(await matchups.text()).toContain("\r\nsolo,16.4,MIDDLE,103,Ahri,Ahri,157,,,1,,,1,,1,");
  expect((await page.request.get("/api/export/tier-list?role=SUPPORT")).status()).toBe(400);
  expect((await page.request.get("/api/export/unknown")).status()).toBe(404);
});

test("navigation reaches every analytics section and search finds champions", async ({ page }) => {
  const nav = (name: string) => page.getByRole("link", { name, exact: true, includeHidden: true });
  await page.goto("/champions");
  await expect(page.getByRole("heading", { name: "Champions", exact: true })).toBeVisible();
  await expect(nav("Champions")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ahri lane matchups" })).toHaveAttribute(
    "href",
    "/champions/Ahri/matchups",
  );
  await expect(page.getByRole("link", { name: "Draft Assistant" })).toHaveAttribute(
    "href",
    "/drafts/assistant",
  );
  await page.goto("/matchups/MIDDLE");
  await expect(nav("Champions")).toHaveAttribute("aria-current", "page");
  await page.goto("/patches");
  await expect(nav("Patches")).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Patch 16.4" }).click();
  await expect(page).toHaveURL(/\/patches\/16\.4$/);
  await page.goto("/leaderboards");
  await expect(nav("Leaderboards")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Win Probability Added" })).toHaveAttribute(
    "href",
    "/leaderboards/wpa",
  );
  for (const [name, href] of [
    ["Tier List", "/tier-list"],
    ["Drafts", "/drafts"],
    ["Models", "/models"],
  ] as const)
    await expect(nav(name)).toHaveAttribute("href", href);
  await page.goto("/search?q=ahri");
  await expect(page.getByRole("link", { name: "Ahri", exact: true })).toHaveAttribute(
    "href",
    "/champions/Ahri",
  );
  await page.goto("/search?q=fixture%23euw");
  await expect(page.getByRole("link", { name: /Ladder fixture#EUW/ })).toHaveAttribute(
    "href",
    `/summoners/${"a".repeat(78)}`,
  );
});

test("role matchup matrices retain null-cell samples and expose a table alternative", async ({
  page,
}) => {
  await page.goto("/matchups/MIDDLE?patch=16.4");
  await expect(page.getByRole("heading", { name: "Mid matchup matrix" })).toBeVisible();
  const grid = page.getByRole("img", { name: "Mid matchups: Win Rate (%) · shrunk" });
  await expect(grid.locator('rect[fill-opacity="0"]')).toHaveCount(4);
  await expect(grid).toContainText("Unknown; samples: 1");
  await page
    .getByText("View data for Mid matchups: Win Rate (%) · shrunk", { exact: true })
    .click();
  const table = page.getByRole("table", { name: "Mid matchups: Win Rate (%) · shrunk data" });
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
