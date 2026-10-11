import { defineConfig } from "@playwright/test";

/**
 * Playwright for the LinkedUp call journey.
 *
 * The suite tests the REAL keyless dev stack from scripts/dev-up.mjs — never a
 * mock server. The webServer hook boots (or reuses, via the script's
 * idempotent reuse) the stack: local Postgres 17 + Drizzle migrations +
 * keyless `next dev` on :3000. No Clerk or Stream keys are involved.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Dev-mode first compile of a route (e.g. Clerk's sign-in catch-all) can
    // take tens of seconds; navigation must outlive that.
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev:up",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
