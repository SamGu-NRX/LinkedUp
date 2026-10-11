// Playwright evidence harness for the sample demo route.
//
// The demo evidence run requires:
//   1. `pnpm build` (prerenders .next/server/app/demo.html)
//   2. `pnpm exec next start -p 4310` (serves the real production bundle;
//      static chunks are exempt from the auth middleware matcher)
//   3. `pnpm exec playwright test --config=docs/demo-fixture/playwright.config.ts`
//
// The signed-out /demo document is intercepted (see tests/helpers.ts) and the
// real prerendered route HTML is served for that one request; every other
// request — hydration chunks, styles, fonts — goes to the real server
// untouched. The one-line middleware change that makes this interception
// unnecessary in production is proposed in docs/demo-fixture/INTEGRATION-PROPOSAL.md.

import { defineConfig } from "@playwright/test";
import path from "node:path";

const PORT = 4310;

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  outputDir: path.join(__dirname, ".artifacts"),
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      grepInvert: /@desktop/,
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
});
