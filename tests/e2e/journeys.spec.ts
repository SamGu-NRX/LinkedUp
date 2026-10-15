// tests/e2e/journeys.spec.ts — the J eval (docs/plan/CALL-PLAN.md).
//
// Each case: fresh synthetic people sign up through Clerk's real form (test
// code 424242), walk the five-step onboarding wizard, queue, are paired by
// the server, and land in the same call room. Every case runs once per
// seed; the seed shuffles who acts first and how long they wait.
// Assertions read the page and the stack's Postgres. Nothing intercepts the
// app's documents or APIs (the only route handler is @clerk/testing's, on
// Clerk's own Frontend API, to pass Clerk's bot check).
//
// After onboarding the journeys use the labelled journey-proof path
// (src/app/journey-proof/) when the reserved middleware blocks finished
// users back to /onboarding; the first test below witnesses that loop.
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  PROOF_CALL,
  acceptMatch,
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
  type Persona,
} from "./helpers/persona";
import { deleteClerkUserByEmail } from "./helpers/clerk-keyless";
import {
  appendScorecard,
  deleteJourneyRows,
  one,
  interestNamesForUser,
  liveQueueRows,
  queueRowsForUser,
  roomRow,
  roomsForUsers,
  userRowByEmail,
} from "./helpers/db";

const SEEDS = Number(process.env.J_SEEDS ?? 10);
const ONLY = process.env.J_CASES?.split(",");

/** Small deterministic PRNG so a seed replays the same order and waits. */
function rng(seed: number) {
  let a = (seed + 1) * 0x9e3779b9;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Actor {
  persona: Persona;
  context: BrowserContext;
  page: Page;
  userId: number;
  /** The name a partner sees: the Clerk profile name, else the email's local part. */
  shownName: string;
}

/** Everyone a test created, for cleanup whatever happened. */
let created: { context: BrowserContext; email: string }[] = [];

async function newActor(browser: Browser, letter: string): Promise<Actor> {
  const persona = makePersona(letter);
  const context = await browser.newContext();
  created.push({ context, email: persona.email });
  const page = await context.newPage();
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.name));
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);

  expect(runtimeErrors, `${letter}: authentication and onboarding runtime errors`).toEqual([]);
  // The wizard's answers are in Postgres, and the person is marked done.
  const row = await userRowByEmail(persona.email);
  expect(row, `${letter}: users row`).not.toBeNull();
  expect(row!.onboarding_complete, `${letter}: onboarding_complete`).toBe(true);
  expect(row!.age).toBe(persona.age);
  expect(row!.gender).toBe(persona.gender);
  expect(row!.field).not.toBeNull();
  expect(await interestNamesForUser(row!.id)).toEqual([...persona.interests].sort());
  const names = await one<{ first_name: string | null; last_name: string | null }>(
    `SELECT first_name, last_name FROM users WHERE id = $1`,
    [row!.id],
  );
  const shownName =
    [names?.first_name, names?.last_name].filter(Boolean).join(" ").trim() || persona.email.split("@")[0];
  return { persona, context, page, userId: row!.id, shownName };
}

/** Sign up and onboard several people at once, each in its own browser context. */
function actors(browser: Browser, letters: string[]): Promise<Actor[]> {
  return Promise.all(letters.map((l) => newActor(browser, l)));
}

async function partnerShown(page: Page): Promise<string> {
  return (await page.locator("[data-call-partner-name]").getAttribute("data-call-partner-name")) ?? "";
}

/** Both people matched to each other in one active room. */
async function expectPaired(a: Actor, b: Actor): Promise<string> {
  await waitForQueuePhase(a.page, "matched", 30_000);
  await waitForQueuePhase(b.page, "matched", 30_000);
  expect(await partnerShown(a.page)).toBe(b.shownName);
  expect(await partnerShown(b.page)).toBe(a.shownName);
  const [ea] = await liveQueueRows(a.userId);
  const [eb] = await liveQueueRows(b.userId);
  expect(ea?.status).toBe("matched");
  expect(eb?.status).toBe("matched");
  expect(ea.room_id).toBe(eb.room_id);
  const room = await roomRow(ea.room_id!);
  expect(room?.status).toBe("active");
  expect(new Set([room!.user1_id, room!.user2_id])).toEqual(new Set([a.userId, b.userId]));
  return ea.room_id!;
}

/** Both accept and land on the same room's call screen. */
async function expectSameRoom(a: Actor, b: Actor, roomId: string): Promise<void> {
  const [ra, rb] = await Promise.all([acceptMatch(a.page), acceptMatch(b.page)]);
  expect(ra, "A lands in the matched room").toBe(roomId);
  expect(rb, "B lands in the same room").toBe(roomId);
  for (const page of [a.page, b.page]) {
    await expect(page.locator("[data-call-root]")).toBeVisible();
    await expect(page.locator("[data-call-refusal]")).toHaveCount(0);
  }
}

async function stillWaiting(actor: Actor, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await expect(actor.page.locator('[data-queue-phase="waiting"]')).toBeVisible();
    const live = await liveQueueRows(actor.userId);
    expect(live.map((r) => r.status)).toEqual(["waiting"]);
    await actor.page.waitForTimeout(1_000);
  }
}

test.beforeEach(() => {
  created = [];
});

test.afterEach(async ({}, testInfo) => {
  const seed = testInfo.title.match(/seed (\d+)/)?.[1];
  await appendScorecard({
    case: testInfo.title.replace(/ · seed \d+$/, ""),
    seed: seed === undefined ? undefined : Number(seed),
    status: testInfo.status === testInfo.expectedStatus ? "passed" : "failed",
    durationMs: testInfo.duration,
    notes: testInfo.annotations.filter((n) => n.description).map((n) => `${n.type}: ${n.description}`),
    // An expected failure (the witness) keeps its message: it shows why.
    error: testInfo.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 400),
  });
  for (const { context } of created) await context.close().catch(() => {});
  const emails = created.map((c) => c.email).filter(Boolean);
  await deleteJourneyRows(emails);
  for (const email of emails) await deleteClerkUserByEmail(email);
});

test("a finished user without the configured session claim settles on recovery without looping", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const persona = makePersona("W");
  const context = await browser.newContext();
  created.push({ context, email: persona.email });
  const page = await context.newPage();
  let onboardingLoads = 0;
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/onboarding") onboardingLoads += 1;
  });
  await page.waitForTimeout(10_000);
  // Someone who finished onboarding should settle in the app, not bounce
  // between /app and /onboarding.
  expect(onboardingLoads, "requests for /onboarding in the 10 s after finishing").toBeLessThan(3);
  expect(new URL(page.url()).pathname).toBe("/onboarding");
  await expect(page.getByRole("heading", { name: "Finishing setup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  const captureRecovery = async (state: string) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `docs/lane-6/screenshots/${state}-${width}x${height}${reducedMotion === "reduce" ? "-reduced" : ""}.png` });
      }
    }
  };
  await captureRecovery("onboarding-missing-claim");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Check your connection");
  await captureRecovery("onboarding-refresh-error");
  await context.setOffline(false);
  const network = await context.newCDPSession(page);
  await network.send("Network.enable");
  // Hold the real response long enough to capture both viewport sizes.
  await network.send("Network.emulateNetworkConditions", { offline: false, latency: 20_000, downloadThroughput: -1, uploadThroughput: -1 });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toContainText("Updating your sign-in");
  await captureRecovery("onboarding-refreshing");
  await network.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await network.detach();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
});

const cases: Record<string, (browser: Browser, seed: number) => Promise<void>> = {
  "J1 both queue at once": async (browser, seed) => {
    const [a, b] = await actors(browser, ["A", "B"]);
    const order = rng(seed)() < 0.5 ? [a, b] : [b, a];
    await Promise.all(order.map((x) => gotoQueue(x.page, "casual")));
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
  },

  "J2 one queues first": async (browser, seed) => {
    const r = rng(seed);
    const [a, b] = await actors(browser, ["A", "B"]);
    const [first, second] = r() < 0.5 ? [a, b] : [b, a];
    await gotoQueue(first.page, "casual");
    const [entry] = await liveQueueRows(first.userId);
    expect(entry?.status).toBe("waiting");
    // Waiting alone for 3-8 s; polling keeps the entry alive.
    await stillWaiting(first, 3_000 + Math.floor(r() * 5_000));
    const [later] = await liveQueueRows(first.userId);
    expect(later.id, "same entry, no duplicate").toBe(entry.id);
    expect(later.last_seen_at.getTime(), "polls refresh liveness").toBeGreaterThan(entry.last_seen_at.getTime());
    await gotoQueue(second.page, "casual");
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
  },

  "J3 one cancels": async (browser, seed) => {
    const r = rng(seed);
    const [a, b] = await actors(browser, ["A", "B"]);
    const [quitter, stayer] = r() < 0.5 ? [a, b] : [b, a];

    // Cancel while waiting: the entry exits and nothing is left to pair.
    await gotoQueue(quitter.page, "casual");
    await quitter.page.locator("[data-queue-leave]").click();
    await quitter.page.locator('[data-journey-proof="left"]').waitFor();
    expect(await liveQueueRows(quitter.userId)).toEqual([]);
    expect((await queueRowsForUser(quitter.userId))[0]?.status).toBe("exited");
    await gotoQueue(stayer.page, "casual");
    await stillWaiting(stayer, 4_000);

    // Decline an offered match: the room ends and the other person waits again.
    await quitter.page.locator("[data-journey-proof-rejoin]").click();
    const declined = await expectPaired(a, b);
    await quitter.page.locator("[data-call-decline]").click();
    await quitter.page.locator('[data-journey-proof="left"]').waitFor();
    expect((await roomRow(declined))?.status, "declined room ends").toBe("ended");
    await waitForQueuePhase(stayer.page, "waiting", 15_000);
    await expect(stayer.page.locator('[data-queue-notice="partner-left"]')).toBeVisible();
    const [back] = await liveQueueRows(stayer.userId);
    expect(back?.status).toBe("waiting");
    expect(back?.room_id).toBeNull();

    // They meet again in a new room.
    await quitter.page.locator("[data-journey-proof-rejoin]").click();
    const roomId = await expectPaired(a, b);
    expect(roomId).not.toBe(declined);
    await expectSameRoom(a, b, roomId);
  },

  "J4 three users": async (browser, seed) => {
    const people = await actors(browser, ["A", "B", "C"]);
    const r = rng(seed);
    const order = [...people].sort(() => r() - 0.5);
    await Promise.all(order.map((x) => gotoQueue(x.page, "casual")));

    // Exactly one pair forms; the third keeps waiting.
    const phase = (x: Actor) =>
      x.page.locator("[data-queue-phase]").first().getAttribute("data-queue-phase");
    await expect
      .poll(async () => (await Promise.all(people.map(phase))).filter((p) => p === "matched").length, {
        timeout: 30_000,
      })
      .toBe(2);
    const phases = await Promise.all(people.map(phase));
    const third = people[phases.indexOf("waiting")];
    expect(third, "one person still waiting").toBeDefined();
    const [a, b] = people.filter((x) => x !== third);
    await stillWaiting(third, 5_000);
    const rooms = await roomsForUsers(people.map((x) => x.userId));
    expect(rooms, "exactly one room among the three").toHaveLength(1);
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
    await stillWaiting(third, 2_000);
  },

  "J5 reload while queued": async (browser, seed) => {
    const [a, b] = await actors(browser, ["A", "B"]);
    const [first, second] = rng(seed)() < 0.5 ? [a, b] : [b, a];
    await gotoQueue(first.page, "casual");
    await first.page.waitForTimeout(2_500);
    const [entry] = await liveQueueRows(first.userId);
    const before = Number(
      await first.page.locator("[data-queue-elapsed-seconds]").getAttribute("data-queue-elapsed-seconds"),
    );
    await first.page.reload();
    await waitForQueuePhase(first.page, "waiting", 30_000);
    const live = await liveQueueRows(first.userId);
    expect(live.map((x) => x.id), "the reload rejoined nothing new").toEqual([entry.id]);
    const after = Number(
      await first.page.locator("[data-queue-elapsed-seconds]").getAttribute("data-queue-elapsed-seconds"),
    );
    expect(after, "the wait clock survives the reload").toBeGreaterThanOrEqual(before);
    await gotoQueue(second.page, "casual");
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
  },

  "J6 Back from the call": async (browser, seed) => {
    const [a, b] = await actors(browser, ["A", "B"]);
    await Promise.all([gotoQueue(a.page, "casual"), gotoQueue(b.page, "casual")]);
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
    const goer = rng(seed)() < 0.5 ? a : b;
    const other = goer === a ? b : a;
    const entriesBefore = (await queueRowsForUser(goer.userId)).length;

    await goer.page.goBack();
    // Back on the queue screen, the match is still theirs; nothing new formed.
    await waitForQueuePhase(goer.page, "matched", 30_000);
    expect(await partnerShown(goer.page)).toBe(other.shownName);
    expect((await queueRowsForUser(goer.userId)).length, "no new queue entry").toBe(entriesBefore);
    expect(await roomsForUsers([a.userId, b.userId]), "still one room").toHaveLength(1);
    expect((await roomRow(roomId))?.status).toBe("active");
    await expect(other.page.locator("[data-call-root]")).toBeVisible();

    // Accepting again returns to the same room.
    expect(await acceptMatch(goer.page)).toBe(roomId);
  },

  "J8 post-call rating persists and retries after a lost connection": async (browser, seed) => {
    const [a, b] = await actors(browser, ["A", "B"]);
    await Promise.all([gotoQueue(a.page, "casual"), gotoQueue(b.page, "casual")]);
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);
    await a.page.getByTestId("leave-call").click();
    await expect(a.page.getByRole("heading", { name: "You left the call" })).toBeFocused();
    await a.page.keyboard.press("Tab");
    await a.page.keyboard.press("Space");
    for (let i = 0; i < 3; i += 1) await a.page.keyboard.press("ArrowRight");
    await expect(a.page.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();

    const capture = async (state: string) => {
      if (seed !== 0) return;
      for (const reducedMotion of ["no-preference", "reduce"] as const) {
        await a.page.emulateMedia({ reducedMotion });
        for (const [width, height] of [[1440, 900], [390, 844]]) {
          await a.page.setViewportSize({ width, height });
          expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (state === "rating-saving") await expect(a.page.getByTestId("call-done")).toBeDisabled();
          await a.page.screenshot({ path: `docs/lane-6/screenshots/${state}-${width}x${height}${reducedMotion === "reduce" ? "-reduced" : ""}.png` });
        }
      }
    };
    await capture("rating-selected");
    await a.context.setOffline(true);
    await a.page.getByTestId("call-done").click();
    await expect(a.page.locator('[data-call-finish-status="error"]')).toContainText("Choose Done to retry");
    await expect(a.page.getByTestId("call-done")).toBeEnabled();
    await expect(a.page.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
    await capture("rating-save-error");
    expect(await one('SELECT count(*)::int AS count FROM call_ratings WHERE room_id = $1', [roomId])).toEqual({ count: 0 });
    await a.context.setOffline(false);

    // Slow the real link to inspect pending feedback without intercepting requests.
    const network = await a.context.newCDPSession(a.page);
    await network.send("Network.enable");
    await network.send("Network.emulateNetworkConditions", { offline: false, latency: 20_000, downloadThroughput: -1, uploadThroughput: -1 });
    await a.page.getByTestId("call-done").click();
    await expect(a.page.getByTestId("call-done")).toBeDisabled();
    await capture("rating-saving");
    await network.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await network.detach();
    await expect(a.page.locator('[data-journey-proof="queue"]')).toBeVisible({ timeout: 60_000 });
    expect(await one('SELECT user_id, rating FROM call_ratings WHERE room_id = $1', [roomId])).toEqual({ user_id: a.userId, rating: 4 });
    expect((await roomRow(roomId))?.status).toBe("ended");
    await b.page.getByTestId("leave-call").click();
    await b.page.getByRole("radio", { name: "5 stars", exact: true }).check();
    await b.page.getByTestId("call-done").click();
    await expect(b.page.locator('[data-journey-proof="queue"]')).toBeVisible();
    expect(await one('SELECT count(*)::int AS count FROM call_ratings WHERE room_id = $1', [roomId])).toEqual({ count: 2 });
  },

  "J7 signed-out access to the call": async (browser) => {
    const [a, b] = await actors(browser, ["A", "B"]);
    await Promise.all([gotoQueue(a.page, "casual"), gotoQueue(b.page, "casual")]);
    const roomId = await expectPaired(a, b);
    await expectSameRoom(a, b, roomId);

    const stranger = await browser.newContext();
    created.push({ context: stranger, email: "" });
    const page = await stranger.newPage();
    const refusals: string[] = [];
    for (const target of [`/app/call/${roomId}`, `${PROOF_CALL}${roomId}`]) {
      // Two refusals were observed on this stack, depending on Clerk's
      // development handshake: the middleware redirects to Clerk's hosted
      // sign-in, or it lets the document through and the call room's own
      // server check renders the signed_out refusal. Either way the served
      // document has no call and no member's name. (In the second case a
      // keyless-mode Clerk server action then fails in the browser and Next
      // shows its client error screen, so the served document is checked.)
      const res = await page.goto(target);
      const served = (await res?.text()) ?? "";
      const landed = new URL(page.url());
      const toSignIn = landed.host !== new URL(res!.request().url()).host || landed.pathname.includes("sign-in");
      if (toSignIn) {
        expect(landed.pathname).toMatch(/sign-in/);
        refusals.push("redirect to sign-in");
      } else {
        expect(served).toContain('data-refusal-reason="signed_out"');
        refusals.push("signed_out refusal");
      }
      expect(served).not.toContain("data-call-root");
      for (const x of [a, b]) expect(served, "no member's name reaches a stranger").not.toContain(x.shownName);
      await expect(page.locator("[data-call-root]")).toHaveCount(0);
    }
    test.info().annotations.push({ type: "signed-out refusals", description: refusals.join(", ") });
    expect((await roomRow(roomId))?.status, "the room is untouched").toBe("active");
    for (const x of [a, b]) await expect(x.page.locator("[data-call-root]")).toBeVisible();
  },
};

for (const [name, run] of Object.entries(cases)) {
  if (ONLY && !ONLY.some((c) => name.startsWith(c))) continue;
  for (let seed = 0; seed < SEEDS; seed += 1) {
    test(`${name} · seed ${seed}`, async ({ browser }) => {
      test.setTimeout(420_000);
      await run(browser, seed);
    });
  }
}
