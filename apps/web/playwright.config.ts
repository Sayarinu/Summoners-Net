import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const env = new URL("../../.env", import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
const connection = process.env.TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== "/esportsviewer_test")
  throw new Error("Browser acceptance requires TEST_DATABASE_URL targeting esportsviewer_test.");
export default defineConfig({
  testDir: "./browser",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./browser/setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    // Fixture matches start near midnight UTC; pin the zone so date filters match on any host.
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
    env: { DATABASE_URL: connection, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
