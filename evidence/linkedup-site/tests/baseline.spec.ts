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
  // Let entry animations settle so the capture shows the resting state.
  await page.waitForTimeout(2500);
  const file = path.join(
    __dirname,
    "..",
    shotDir,
    `landing-${testInfo.project.name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
});
