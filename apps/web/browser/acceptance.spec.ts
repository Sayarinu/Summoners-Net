import { test, expect } from "@playwright/test";
import AxeBuilder from "axe-core";
import { historyCsv } from "../../../packages/data/tests/fixtures";
test("browse filters, SQL pages, match details and spoiler control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matches", exact: true })).toBeVisible();
  await expect(page.getByText("Result hidden")).toHaveCount(24);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/30 records · Page 2/)).toBeVisible();
  await page.goto("/?state=scheduled");
  await expect(page.locator(".np-match-row").getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 records/)).toBeVisible();
  await page.goto("/?date=2026-03-01&league=LCK");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await page
    .getByRole("button", { name: /Reveal score/ })
    .first()
    .click();
  await expect(page.getByText("Result hidden")).toHaveCount(24);
  await page
    .getByRole("link", { name: /Acceptance Blue versus Acceptance Red/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Acceptance Blue vs Acceptance Red",
  );
  await expect(page.getByRole("table", { name: "Source game context" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("search, history, observed rosters and independently accessible played lineups", async ({
  page,
}) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search" }).fill("Player Blue mid");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("link", { name: /Player Blue mid/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Player Blue mid");
  await expect(page.getByText("No current roster observation")).toBeVisible();
  await page.getByRole("button", { name: "Reveal summary statistics" }).click();
  await expect(page.getByText("100.0%")).toBeVisible();
  await page.getByRole("table", { name: "Historical games" }).getByRole("link").first().click();
  await expect(page.getByRole("table", { name: "Historical played lineup" })).toBeVisible();
  await expect(page.getByText("Hidden", { exact: true })).toHaveCount(30);
  await page.getByRole("button", { name: "Reveal game statistics" }).click();
  await expect(page.getByText("5 / 2 / 7", { exact: true })).toHaveCount(10);
  await page.goto("/teams/pandascore%3Ateam%3A10");
  await expect(page.getByRole("link", { name: /Observed Player/ })).toBeVisible();
  await page.goto("/history?year=2014");
  await expect(page.getByText("No games match these filters.")).toBeVisible();
});
test("timezone boundaries and spoiler preferences persist across navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Preferences · UTC", { exact: true }).click();
  await page.getByRole("textbox", { name: "Timezone" }).fill("America/Phoenix");
  await page.getByRole("button", { name: "Save timezone" }).click();
  await expect(page.getByText("Preferences · America/Phoenix", { exact: true })).toBeVisible();
  await page.goto("/?date=2026-02-28");
  await expect(page.getByText(/29 records/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026-02-28 · LCK" })).toBeVisible();
  await page.getByText("Preferences · America/Phoenix", { exact: true }).click();
  await page.getByRole("switch", { name: "Hide results" }).press("Space");
  await expect(page.getByText("Result hidden")).toHaveCount(0);
  await page.goto("/history");
  await expect(page.getByRole("link", { name: /Feb 28/ })).toBeVisible();
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
  await page.getByRole("option", { name: /twitch/ }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Load Stream" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Player not working" }).click();
  await expect(page.getByRole("heading", { name: "Stream unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open on twitch" }).last()).toHaveAttribute(
    "href",
    "https://twitch.tv/test_channel",
  );
  await page.getByRole("button", { name: "Unload player" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("manual refresh and CSV uploads join the durable queue", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
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
