import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Repeated-load layout-shift measurement for the landing.
// Each run loads "/" REPEATS times in a fresh context, collects the raw
// layout-shift entries reported by the PerformanceObserver, and writes the
// per-run measurements to findings/layout-shift-<project>.json.
// Assertion: zero observed layout shifts across all repeats.

const REPEATS = 5;

test("repeated loads observe zero layout shifts", async ({ browser }, testInfo) => {
  const runs: Array<{
    run: number;
    shiftCount: number;
    totalShift: number;
    shifts: Array<{ value: number; sources: string[] }>;
  }> = [];

  for (let run = 1; run <= REPEATS; run++) {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __shifts: unknown[] }).__shifts = [];
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {
            value: number;
            sources?: Array<{ node?: Node | null }>;
          };
          (window as unknown as { __shifts: unknown[] }).__shifts.push({
            value: e.value,
            sources: (e.sources ?? []).map(
              (s) =>
                s.node && "tagName" in s.node
                  ? (s.node as HTMLElement).tagName
                  : String(s.node),
            ),
          });
        }
      });
      po.observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    const shifts = (await page.evaluate(
      () =>
        (window as unknown as { __shifts: Array<{ value: number }> }).__shifts,
    )) as Array<{ value: number; sources: string[] }>;
    runs.push({
      run,
      shiftCount: shifts.length,
      totalShift: shifts.reduce((a, s) => a + s.value, 0),
      shifts,
    });
    await context.close();
  }

  fs.mkdirSync(path.join(__dirname, "..", "findings"), { recursive: true });
  const file = path.join(
    __dirname,
    "..",
    "findings",
    `layout-shift-${testInfo.project.name}.json`,
  );
  fs.writeFileSync(file, JSON.stringify({ repeats: REPEATS, runs }, null, 2));

  const totalObserved = runs.reduce((a, r) => a + r.shiftCount, 0);
  expect(
    totalObserved,
    `layout shifts observed across ${REPEATS} repeats: ${JSON.stringify(runs)}`,
  ).toBe(0);
});
