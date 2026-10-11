// tests/e2e/journeys.call.spec.ts — J8: the real call journey.
//
// A matched pair opens the room: Chromium's fake media device feeds the
// local preview without a webcam, the call reaches its ready phase with a
// running timer, and ending the call flips the room to `ended` in Postgres
// so the partner sees an ended call — not a ghost room.
import { expect, test, type Browser } from "@playwright/test";
import {
  acceptMatch,
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
  type Persona,
} from "./helpers/persona";
import { appendScorecard, roomRow } from "./helpers/db";

test.describe("call journeys", () => {
  const open: { close: () => Promise<void> }[] = [];

  test.afterEach(async ({}, testInfo) => {
    await appendScorecard({
      case: testInfo.title,
      status: testInfo.status === "passed" ? "passed" : "failed",
      durationMs: testInfo.duration,
      error: testInfo.status === "passed" ? undefined : testInfo.error?.message?.slice(0, 400),
    });
    for (const context of open.splice(0)) {
      await context.close().catch(() => {});
    }
  });

  test("J8: a matched pair talks; ending the call ends the room for both", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(420_000);

    async function onboard(browser: Browser, letter: string): Promise<{
      persona: Persona;
      context: { close: () => Promise<void> };
      page: import("@playwright/test").Page;
    }> {
      const persona = makePersona(letter);
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUpPersona(page, persona);
      await completeOnboarding(page, persona);
      return { persona, context, page };
    }

    const a = await onboard(browser, "A");
    open.push(a.context);
    const b = await onboard(browser, "B");
    open.push(b.context);

    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    const roomId = await acceptMatch(a.page);
    await acceptMatch(b.page);

    // Both participants must reach the live call screen with a REAL local
    // preview (Chromium's fake device supplies the stream headlessly).
    for (const page of [a.page, b.page]) {
      const root = page.locator("[data-call-root]");
      await root.waitFor({ state: "visible", timeout: 60_000 });
      await expect(root).toHaveAttribute("data-call-phase", "connected", {
        timeout: 30_000,
      });
      await expect(page.locator("[data-call-local-preview]")).toBeVisible();
    }

    // The timer ticks from the server-persisted window, not a local guess.
    await expect(a.page.locator("[data-call-timer]")).toBeVisible();

    // A ends the call: the room row flips to `ended`.
    await a.page.locator("[data-call-end]").click();
    await a.page.waitForURL(/\/app/, { timeout: 30_000 });

    const room = await roomRow(roomId);
    expect(room, "room row must exist").not.toBeNull();
    expect(room!.status, "ended call must flip the room row").toBe("ended");

    // B's next look at the room must see it ended — no ghost room.
    await b.page.goto(`/app/call/${roomId}`);
    const refusal = b.page.locator("[data-call-refusal]");
    await refusal.waitFor({ state: "visible", timeout: 30_000 });
    await expect(refusal).toHaveAttribute("data-refusal-reason", "room_ended");
  });
});
