import { defineConfig } from "@playwright/test";
import path from "path";

// Evidence config for the LinkedUp public landing revision.
// Expects a server on http://localhost:3210 (see README-EVIDENCE below or
// start one: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=... pnpm start -- -p 3210).
const OUTPUT = path.join(__dirname, "results");

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  outputDir: OUTPUT,
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: path.join(OUTPUT, "report.json") }]],
  use: {
    baseURL: process.env.EVIDENCE_BASE_URL ?? "http://localhost:3210",
    screenshot: "off",
    trace: "off",
  },
  projects: [
    {
      name: "desktop-1440x900",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390x844",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
});
