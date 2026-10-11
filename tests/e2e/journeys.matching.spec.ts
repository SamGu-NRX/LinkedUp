// tests/e2e/journeys.matching.spec.ts — J1–J7: the real matching journeys.
//
// Every test drives the live keyless-Clerk stack: real sign-ups, the real
// five-step onboarding wizard, the real DB-backed matcher (FIFO pairing of
// waiting entries with FOR UPDATE SKIP LOCKED), and the real call route.
// Assertions cover BOTH the UI ([data-queue-phase], [data-call-*]) and the
// Postgres rows the actions wrote (users, queue_entries, rooms).
//
// A JSONL scorecard (test-results/j-scorecard.jsonl) records one line per
// case: the run summary a human can read with plain jq.
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  acceptMatch,
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
  type Persona,
} from "./helpers/persona";
import {
  appendScorecard,
  queueRowsForUser,
  roomRow,
  userRowByEmail,
} from "./helpers/db";

interface Onboarded {
  persona: Persona;
  context: { close: () => Promise<void> };
  page: Page;
}

/** Sign-up + onboarding in a fresh browser context; returns page + persona. */
async function onboard(
  browser: Browser,
  letter: string,
  overrides: Partial<Persona> = {},
): Promise<Onboarded> {
  const persona = makePersona(letter, overrides);
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);
  return { persona, context, page };
}

test.describe("matching journeys", () => {
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

  test("J1: two users queue simultaneously, match, and land in the same room", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);

    const a = await onboard(browser, "A", { age: 21, gender: "non-binary" });
    open.push(a.context);
    const b = await onboard(browser, "B", { age: 24 });

    // The users table must hold what the wizard actually submitted.
    const rowA = await userRowByEmail(a.persona.email);
    const rowB = await userRowByEmail(b.persona.email);
    expect(rowA, "persona A must have a users row").not.toBeNull();
    expect(rowB, "persona B must have a users row").not.toBeNull();
    expect(rowA!.onboarding_complete).toBe(true);
    expect(rowA!.age).toBe(a.persona.age);
    expect(rowA!.gender).toBe(a.persona.gender);
    expect(rowA!.field).toBe(a.persona.field);

    // Queue both ~simultaneously.
    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "casual");

    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    const roomA = await acceptMatch(a.page);
    const roomB = await acceptMatch(b.page);
    expect(roomA, "both actors must land in the same call room").toBe(roomB);

    const room = await roomRow(roomA);
    expect(room, "room row must exist").not.toBeNull();
    expect(room!.status).toBe("active");
    const ids = [rowA!.id, rowB!.id].sort((x, y) => x - y);
    expect([room!.user1_id, room!.user2_id].sort((x, y) => x - y)).toEqual(ids);
  });

  test("J2: staggered joins still pair the two waiting users", async ({
    browser,
  }) => {
    test.setTimeout(300_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    await gotoQueue(a.page, "casual");
    await waitForQueuePhase(a.page, "waiting", 30_000);
    // First joiner must be DB-verified waiting, not just UI-waiting.
    const rowA = await userRowByEmail(a.persona.email);
    const aRows = await queueRowsForUser(rowA!.id);
    expect(aRows[0]?.status).toBe("waiting");

    // Stagger: B joins ten seconds later and must still find A.
    await a.page.waitForTimeout(10_000);

    const b = await onboard(browser, "B");
    open.push(b.context);
    await gotoQueue(b.page, "casual");

    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    const roomA = await acceptMatch(a.page);
    const roomB = await acceptMatch(b.page);
    expect(roomA).toBe(roomB);
    expect((await roomRow(roomA))!.status).toBe("active");
  });

  test("J3: leaving the queue cancels the entry; a later rejoin still pairs", async ({
    browser,
  }) => {
    test.setTimeout(420_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    await gotoQueue(a.page, "casual");
    await waitForQueuePhase(a.page, "waiting", 30_000);

    const rowA = await userRowByEmail(a.persona.email);
    await a.page.locator("[data-queue-leave]").click();
    await a.page.waitForURL(/\/app/, { timeout: 30_000 });

    // The cancelled entry must be exited, and no waiting slot may survive.
    const aRowsAfterLeave = await queueRowsForUser(rowA!.id);
    expect(
      aRowsAfterLeave.some((r) => r.status === "exited"),
      "cancelled entry must be exited",
    ).toBe(true);
    expect(
      aRowsAfterLeave.some((r) => r.status === "waiting"),
      "no waiting slot may survive a cancel",
    ).toBe(false);

    // B now waits alone; A rejoins and the pair must still match.
    const b = await onboard(browser, "B");
    open.push(b.context);
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(b.page, "waiting", 30_000);

    await gotoQueue(a.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    const roomA = await acceptMatch(a.page);
    const roomB = await acceptMatch(b.page);
    expect(roomA).toBe(roomB);
  });

  test("J4: three users queue; exactly one pair matches, the third keeps waiting", async ({
    browser,
  }) => {
    test.setTimeout(600_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    const b = await onboard(browser, "B");
    open.push(b.context);
    const c = await onboard(browser, "C");
    open.push(c.context);

    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    // Only now may C join — after the first pair is already matched.
    await gotoQueue(c.page, "casual");
    await waitForQueuePhase(c.page, "waiting", 30_000);

    const rowA = await userRowByEmail(a.persona.email);
    const rowB = await userRowByEmail(b.persona.email);
    const rowC = await userRowByEmail(c.persona.email);

    const roomA = await acceptMatch(a.page);
    const room = await roomRow(roomA);
    expect(room!.status).toBe("active");
    const pairIds = [rowA!.id, rowB!.id].sort((x, y) => x - y);
    expect([room!.user1_id, room!.user2_id].sort((x, y) => x - y)).toEqual(pairIds);

    // C must still be waiting — never pulled into someone else's room.
    const cRows = await queueRowsForUser(rowC!.id);
    expect(
      cRows.some((r) => r.status === "matched"),
      "third user must not be matched",
    ).toBe(false);
    await waitForQueuePhase(c.page, "waiting", 15_000);
  });

  test("J5: a non-participant is refused from the matched pair's call room", async ({
    browser,
  }) => {
    test.setTimeout(420_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    const b = await onboard(browser, "B");
    open.push(b.context);
    const c = await onboard(browser, "C");
    open.push(c.context);

    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    const roomId = await acceptMatch(a.page);

    // C (never matched into this room) must hit the server-side refusal.
    await c.page.goto(`/app/call/${roomId}`);
    const refusal = c.page.locator("[data-call-refusal]");
    await refusal.waitFor({ state: "visible", timeout: 30_000 });
    await expect(refusal).toHaveAttribute(
      "data-refusal-reason",
      "not_a_participant",
    );
  });

  test("J6: casual and professional queues pair separately", async ({
    browser,
  }) => {
    test.setTimeout(600_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    const b = await onboard(browser, "B");
    open.push(b.context);
    const c = await onboard(browser, "C");
    open.push(c.context);

    // A waits in casual; B joins professional — they must NOT pair.
    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "professional");
    await waitForQueuePhase(a.page, "waiting", 30_000);
    await waitForQueuePhase(b.page, "waiting", 30_000);

    // C joins professional and must pair with B, in a professional room,
    // while A is untouched and still waiting in casual.
    await gotoQueue(c.page, "professional");
    await waitForQueuePhase(b.page, "matched", 30_000);
    await waitForQueuePhase(c.page, "matched", 30_000);
    await waitForQueuePhase(a.page, "waiting", 15_000);

    const roomB = await acceptMatch(b.page);
    const room = await roomRow(roomB);
    expect(room!.queue_type).toBe("professional");
    const rowA = await userRowByEmail(a.persona.email);
    const aRows = await queueRowsForUser(rowA!.id);
    expect(aRows[0]?.queue_type).toBe("casual");
    expect(aRows[0]?.status).toBe("waiting");
  });

  test("J7: declining the match keeps the room active for the partner", async ({
    browser,
  }) => {
    test.setTimeout(420_000);

    const a = await onboard(browser, "A");
    open.push(a.context);
    const b = await onboard(browser, "B");
    open.push(b.context);

    await gotoQueue(a.page, "casual");
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);

    // A declines ("Leave queue instead") and is sent back to /app.
    await a.page.locator("[data-call-decline]").click();
    await a.page.waitForURL(/\/app$/, { timeout: 30_000 });

    // B's room stays active: B can still join the same call.
    const roomB = await acceptMatch(b.page);
    const room = await roomRow(roomB);
    expect(room!.status).toBe("active");
  });
});
