import { test } from "@playwright/test";
import path from "path";

// Full-page landing screenshots for the evidence trail.
// EVIDENCE_SHOT_DIR picks the target folder ("baseline" or "final") so the
// same spec records both states of the page.
const shotDir =
  process.env.EVIDENCE_SHOT_DIR === "final" ? "final" : "baseline";

test("capture full-page landing screenshot", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Sections animate in on first view (framer-motion whileInView), so walk
  // the page to the bottom to trigger every entrance before capturing.
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  // Let the in-view transitions settle, return to the top, and capture the
  // resting state.
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const file = path.join(
    __dirname,
    "..",
    shotDir,
    `landing-${testInfo.project.name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
});
