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
  const watchButtonTop = (await watchButtons.first().boundingBox())!.y;
  await watchButtons.first().click();
  await expect(page.getByRole("region", { name: "Watch match" })).toBeVisible();
  expect(
    Math.abs((await watchButtons.first().boundingBox())!.y - watchButtonTop),
  ).toBeLessThanOrEqual(1);
  await expect(watchButtons.first()).toHaveText("Watch Live");
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
