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
  // Keyless Clerk keys + testing token, and cleanup of journey personas.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // Journey tests drive 2-3 browser contexts inside ONE test process; they
  // are intentionally serial. Parallel workers would only multiply Chromium
  // memory on a small sandbox.
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Dev-mode first compile of a route (e.g. Clerk's sign-in catch-all) can
    // take tens of seconds; navigation must outlive that.
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        // Auto-grant mic/cam with a synthetic device: the call page must
        // render local media without a real webcam on CI sandboxes.
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        // Small-sandbox hygiene: /dev/shm is tiny; /tmp-backed shmem keeps
        // Chromium from crashing under concurrent-context journeys.
        "--disable-dev-shm-usage",
        "--no-first-run",
      ],
    },
    permissions: ["microphone", "camera"],
  },
  webServer: {
    command: "pnpm dev:up",
    // Serves the labelled journey-proof path (next.config.mjs) for the J
    // suite; dev:up replaces a running server started without it.
    env: { LINKEDUP_JOURNEY_PROOF: "1" },
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
      // The journeys are about two people meeting, not layout; they run once,
      // on desktop. Mobile keeps the smoke check.
      testMatch: /smoke\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
