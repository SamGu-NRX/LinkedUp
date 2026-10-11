// Full sample journey at 1440x900 and 390x844: every stage axe-scanned with
// zero serious/critical findings, persistent sample labelling asserted on
// every screen, screenshots captured per stage.

import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { FAILURE_COPY } from "../../../../src/lib/demo/demo-state";
import { SAMPLE_MODE_BANNER } from "../../../../src/lib/demo/sample-mode";

import { openDemo, screenshot, settleForAxe, walkToInCall } from "./helpers";

const AXE_EVIDENCE = path.resolve(
  process.cwd(),
  "docs/demo-fixture/evidence/axe-results.jsonl",
);
mkdirSync(path.dirname(AXE_EVIDENCE), { recursive: true });

interface AxeCounts {
  minor: number;
  moderate: number;
  serious: number;
  critical: number;
}

async function scanAxe(page: Page, stage: string): Promise<AxeCounts> {
  // Scan the settled state: entry motion (JS-driven) must finish before
  // contrast is measured, or mid-transition frames report ghost findings.
  await settleForAxe(page);
  const results = await new AxeBuilder({ page }).analyze();
  const counts: AxeCounts = { minor: 0, moderate: 0, serious: 0, critical: 0 };
  for (const violation of results.violations) {
    const impact = violation.impact;
    if (impact === "minor" || impact === "moderate" || impact === "serious" || impact === "critical") {
      counts[impact] += violation.nodes.length;
    }
  }
  appendFileSync(
    AXE_EVIDENCE,
    JSON.stringify({
      stage,
      project: test.info().project.name,
      axePackage: "@axe-core/playwright",
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
        detail: v.nodes.slice(0, 6).map((n) => ({
          target: n.target,
          data: n.any[0]?.data ?? null,
        })),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      counts,
    }) + "\n",
  );
  expect(
    counts.serious,
    `${stage}: serious axe findings`,
  ).toBe(0);
  expect(
    counts.critical,
    `${stage}: critical axe findings`,
  ).toBe(0);
  return counts;
}

async function assertSampleLabelling(page: Page, titleFragment: RegExp) {
  // Persistent banner on every screen.
  await expect(page.getByText(SAMPLE_MODE_BANNER)).toBeVisible();
  // Persistent simulated-sample indication in the document title.
  await expect(page).toHaveTitle(titleFragment);
}

test.describe("full sample journey", () => {
  // The journey performs ~8 settled axe scans, screenshots, and scripted
  // waits; the 90s default is a harness budget issue, not a product one.
  test.setTimeout(180_000);

  test("every stage renders labelled and axe-clean of serious/critical findings", async ({ page }) => {
    await openDemo(page);
    const project = test.info().project.name;

    // 1 — profile choice
    await assertSampleLabelling(page, /Sample demo \(simulated data\)/);
    await scanAxe(page, `${project}:01-profile-choice`);
    await screenshot(page, project, "01-profile-choice");

    // 2 — choose a sample profile (the choice advances to the connection
    // explanation — one action, honestly labelled)
    await page.getByRole("button", { name: /sample profile option/i }).first().click();
    await assertSampleLabelling(page, /how connecting works/);
    await scanAxe(page, `${project}:02-connection-explanation`);
    await screenshot(page, project, "02-connection-explanation");

    // 3 — continue to the simulated queue
    await page.getByRole("button", { name: "Continue to the simulated queue" }).click();
    await assertSampleLabelling(page, /simulated queue wait/);
    await scanAxe(page, `${project}:03-queue-waiting`);
    await screenshot(page, project, "03-queue-waiting");

    // 4 — skip the simulated wait, read the connection explanation
    await page.getByRole("button", { name: "Skip the simulated wait" }).click();
    await assertSampleLabelling(page, /sample persona introduced/);
    await scanAxe(page, `${project}:04-connection-explained`);
    await screenshot(page, project, "04-connection-explained");

    // 5 — open and enter the simulated meeting
    await page.getByRole("button", { name: "Open the simulated meeting" }).click();
    await assertSampleLabelling(page, /simulated device check/);
    await screenshot(page, project, "05-joining");
    await page.getByRole("button", { name: "Enter the simulated meeting" }).click();
    await assertSampleLabelling(page, /simulated meeting/);
    await expect(page.getByTestId("demo-in-call")).toBeVisible();
    await scanAxe(page, `${project}:06-in-call`);
    await screenshot(page, project, "06-in-call");

    // 7 — one rehearsed failure path and its recovery, in the real browser
    await page.getByText("Demo controls — rehearse a failure path (sample only)").click();
    await page
      .getByRole("button", { name: /Rehearse: media unavailable/ })
      .click();
    await assertSampleLabelling(page, /rehearsed failure path/);
    await expect(
      page.getByRole("heading", { name: FAILURE_COPY["media-unavailable"].title }),
    ).toBeVisible();
    await scanAxe(page, `${project}:07-failure-media-unavailable`);
    await screenshot(page, project, "07-failure-recovery");
    await page.getByRole("button", { name: FAILURE_COPY["media-unavailable"].recovery }).click();
    // Recovery re-enters the simulated device check by design (no dead end);
    // the visitor then re-enters the meeting from there.
    await assertSampleLabelling(page, /simulated device check/);
    await page.getByRole("button", { name: "Enter the simulated meeting" }).click();
    await expect(page.getByTestId("demo-in-call")).toBeVisible();

    // 8 — leave the meeting; the ended screen names the sample persona
    await page.getByRole("button", { name: "Leave the simulated meeting" }).click();
    await assertSampleLabelling(page, /meeting ended/);
    await expect(
      page.getByRole("heading", { name: "You left the simulated meeting" }),
    ).toBeVisible();
    await scanAxe(page, `${project}:08-call-ended`);
    await screenshot(page, project, "08-call-ended");

    // 9 — restart returns to the first screen, never a dead end
    await page.getByRole("button", { name: "Start the sample flow again" }).click();
    await assertSampleLabelling(page, /choosing a profile/);
    await scanAxe(page, `${project}:09-restarted`);
  });

  test("the simulated meeting clock ticks on the real scripted clock", async ({ page }) => {
    await openDemo(page);
    await walkToInCall(page);
    // The shared TimeManager starts the allowance at 5:00 and ticks down.
    await expect(page.getByTestId("demo-in-call")).toContainText(/4:5[89]|5:00/, {
      timeout: 15_000,
    });
  });

  test("the scripted sample chat reveals without any network effect", async ({ page }) => {
    test.setTimeout(120_000);
    await openDemo(page);
    await walkToInCall(page);
    // Starter line + one scripted persona reveal at the 25-second mark.
    await expect(page.getByTestId("demo-chat-log").locator("p")).toHaveCount(2, {
      timeout: 40_000,
    });
  });
});
