// Keyboard-only navigation and reduced-motion evidence for the sample demo.
// Keyboard runs use only Tab and Enter — no pointer events anywhere.

import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { SAMPLE_MODE_BANNER } from "../../../../src/lib/demo/sample-mode";

import { openDemo, screenshot, settleForAxe, tabTo } from "./helpers";

const AXE_EVIDENCE = path.resolve(
  process.cwd(),
  "docs/demo-fixture/evidence/axe-results.jsonl",
);
mkdirSync(path.dirname(AXE_EVIDENCE), { recursive: true });

test.describe("keyboard-only navigation", () => {
  test("the whole sample journey completes with Tab and Enter alone @desktop", async ({ page }) => {
    await openDemo(page);

    // Profile choice → select → continue
    await tabTo(page, /sample profile option/i);
    await page.keyboard.press("Enter");
    await tabTo(page, /Continue to the simulated queue/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveTitle(/simulated queue wait/);
    await expect(page.getByText(SAMPLE_MODE_BANNER)).toBeVisible();

    // Skip the wait → open → enter
    await tabTo(page, /Skip the simulated wait/);
    await page.keyboard.press("Enter");
    await tabTo(page, /Open the simulated meeting/);
    await page.keyboard.press("Enter");
    await tabTo(page, /Enter the simulated meeting/);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("demo-in-call")).toBeVisible();
    await expect(page.getByText(SAMPLE_MODE_BANNER)).toBeVisible();

    // Leave → ended screen → restart
    await tabTo(page, /Leave the simulated meeting/);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "You left the simulated meeting" }),
    ).toBeVisible();
    await tabTo(page, /Start the sample flow again/);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Choose a sample profile" }),
    ).toBeVisible();

    await settleForAxe(page);
    const axe = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    appendFileSync(
      AXE_EVIDENCE,
      JSON.stringify({
        stage: "keyboard-only:restart",
        project: test.info().project.name,
        keyboardOnly: true,
        seriousCritical: seriousOrCritical.length,
        violations: seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact })),
      }) + "\n",
    );
    expect(seriousOrCritical, "keyboard walk serious/critical").toHaveLength(0);
    await screenshot(page, "keyboard", "keyboard-full-walk-restarted");
  });
});

test.describe("reduced motion", () => {
  test("the sample journey completes under prefers-reduced-motion: reduce @desktop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDemo(page);

    await page.getByRole("button", { name: /sample profile option/i }).first().click();
    await page.getByRole("button", { name: "Continue to the simulated queue" }).click();
    await page.getByRole("button", { name: "Skip the simulated wait" }).click();
    await page.getByRole("button", { name: "Open the simulated meeting" }).click();
    await page.getByRole("button", { name: "Enter the simulated meeting" }).click();
    await expect(page.getByTestId("demo-in-call")).toBeVisible();

    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced, "emulation must be active in the page").toBe(true);

    const axe = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    appendFileSync(
      AXE_EVIDENCE,
      JSON.stringify({
        stage: "reduced-motion:in-call",
        project: test.info().project.name,
        reducedMotion: true,
        seriousCritical: seriousOrCritical.length,
        violations: seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact })),
      }) + "\n",
    );
    expect(seriousOrCritical, "reduced-motion serious/critical").toHaveLength(0);
    await screenshot(page, "reduced-motion", "reduced-motion-in-call");
  });
});
