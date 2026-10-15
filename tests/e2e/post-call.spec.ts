// tests/e2e/post-call.spec.ts — the two-browser post-call proof.
//
// Continues where normal-route.spec.ts stops: the room has ended and Postgres
// released its rows — what do the two people actually SEE then? Each presses
// Done and lands on a summary built from the REAL call (the other person, the
// truly-connected duration, the star rating they gave in the call screen),
// history reloads the same rows in a later navigation, and a signed-in
// outsider is refused both the room and the recap.
//
// Like the predecessor proof, the journey runs on the NORMAL routes when the
// middleware lets a finished persona through, otherwise on the labelled
// journey-proof path serving the same pages. Nothing intercepts the app.
//
// Focused run:  pnpm exec playwright test tests/e2e/post-call.spec.ts
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
  type Persona,
} from "./helpers/persona";
import { normalRouteReachable, sessionClaims } from "./helpers/normal-route";
import { deleteClerkUserByEmail } from "./helpers/clerk-keyless";
import { deleteJourneyRows, many, one, userRowByEmail } from "./helpers/db";

/** Everyone a test created, for cleanup whatever happened. */
let created: { context: BrowserContext; email: string }[] = [];

test.afterEach(async () => {
  for (const { context } of created) await context.close().catch(() => {});
  const emails = created.map((c) => c.email).filter(Boolean);
  await deleteJourneyRows(emails);
  for (const email of emails) await deleteClerkUserByEmail(email);
});

interface Actor {
  persona: Persona;
  context: BrowserContext;
  page: Page;
  userId: number;
}

/** A real person: Clerk sign-up, onboarding wizard, Postgres row, own browser. */
async function newActor(browser: Browser, letter: string): Promise<Actor> {
  const persona = makePersona(letter);
  const context = await browser.newContext();
  created.push({ context, email: persona.email });
  const page = await context.newPage();
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);
  const row = await userRowByEmail(persona.email);
  expect(row, `${letter}: users row`).not.toBeNull();
  expect(row!.onboarding_complete, `${letter}: onboarding_complete`).toBe(true);
  return { persona, context, page, userId: row!.id };
}

/** Which URL prefixes this run uses: normal app routes or the proof path. */
type Routes = {
  mode: "normal" | "proof";
  call: (roomId: string) => string;
  summary: (roomId: string) => string;
  history: string;
};

async function chooseRoutes(a: Actor): Promise<Routes> {
  const claims = await sessionClaims(a.context);
  const claimPresent =
    (claims as { metadata?: { onboardingComplete?: unknown } })?.metadata
      ?.onboardingComplete === true;
  if (claimPresent && (await normalRouteReachable(a.context))) {
    return {
      mode: "normal",
      call: (id) => `/app/call/${id}`,
      summary: (id) => `/app/call/${id}/summary`,
      history: "/app/history",
    };
  }
  return {
    mode: "proof",
    call: (id) => `/onboarding?journey-proof=call&room=${id}`,
    summary: (id) => `/onboarding?journey-proof=summary&room=${id}`,
    history: "/onboarding?journey-proof=history",
  };
}

/** Queue both people, pair them server-side, and land both on the call screen. */
async function matchAndEnterCall(
  a: Actor,
  b: Actor,
  routes: Routes,
): Promise<string> {
  const queue = async (actor: Actor) => {
    await gotoQueue(actor.page, "casual");
  };
  await Promise.all([queue(a), queue(b)]);
  await waitForQueuePhase(a.page, "matched", 30_000);
  await waitForQueuePhase(b.page, "matched", 30_000);
  const roomId = (await one<{ room_id: string }>(
    `SELECT q.room_id FROM queue_entries q WHERE q.user_id = $1 AND q.status = 'matched'`,
    [a.userId],
  ))!.room_id;

  const callUrlRe = /room=([0-9a-f-]{36})|\/app\/call\/([0-9a-f-]{36})/;
  const accept = async (actor: Actor) => {
    await actor.page.locator("[data-call-accept]").click();
    await actor.page.waitForURL(callUrlRe, { timeout: 30_000 });
    await actor.page
      .locator("[data-call-root]")
      .waitFor({ state: "visible", timeout: 60_000 });
  };
  await Promise.all([accept(a), accept(b)]);
  void routes;
  return roomId;
}

/** Both sides connected, seeing each other's video tile. */
async function expectConnected(a: Actor, b: Actor): Promise<void> {
  for (const actor of [a, b]) {
    await expect(
      actor.page.locator('[data-call-root][data-call-phase="connected"]'),
      `${actor.persona.email}: connected`,
    ).toBeVisible({ timeout: 60_000 });
  }
}

test("P1 both people see their own real summary, history reloads it, and an outsider is refused", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  const [a, b, c] = await Promise.all([
    newActor(browser, "A"),
    newActor(browser, "B"),
    newActor(browser, "C"),
  ]);
  const routes = await chooseRoutes(a);

  const roomId = await matchAndEnterCall(a, b, routes);
  await expectConnected(a, b);

  // A leaves, rates the call 4 stars, and presses Done.
  await a.page.locator('[data-testid="leave-call"]').click();
  await expect(
    a.page.locator('[data-call-root][data-call-phase="left"]'),
  ).toBeVisible();
  await a.page
    .locator('input[name="call-rating"][value="4"]')
    .check({ force: true });
  await a.page.locator('[data-testid="call-done"]').click();

  // A lands on the REAL call's summary: B's name, a positive duration, 4 stars.
  await expect(a.page, "A lands on the summary").toHaveURL(
    routes.summary(roomId),
    { timeout: 30_000 },
  );
  await expect(a.page.locator("[data-summary-root]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(a.page.locator('[data-testid="summary-peer"]')).toHaveText(
    `${b.persona.firstName} ${b.persona.lastName}`,
  );
  const durationText = await a.page
    .locator('[data-testid="summary-duration"]')
    .textContent();
  expect(durationText, "duration is rendered").not.toBe("0s");
  await expect(
    a.page.locator('[data-testid="summary-rating"]'),
  ).toHaveAttribute("aria-label", "4 of 5 stars");

  // The room ended for B too: their screen shows the ended call; Done opens
  // B's OWN summary — A's name, the same duration, not A's rating.
  await expect(
    b.page.locator('[data-call-root][data-call-phase="failed"]'),
    "B sees the ended call",
  ).toBeVisible({
    timeout: 30_000,
  });
  await b.page.locator('[data-testid="call-done"]').click();
  await expect(b.page, "B lands on the summary too").toHaveURL(
    routes.summary(roomId),
    { timeout: 30_000 },
  );
  await expect(b.page.locator('[data-testid="summary-peer"]')).toHaveText(
    `${a.persona.firstName} ${a.persona.lastName}`,
  );
  await expect(
    b.page.locator('[data-testid="summary-rating"]'),
  ).toHaveAttribute("aria-label", "Not rated");

  // ENDED, read back from the database: exactly one summary row per person.
  const summaryRows = await many<{
    user_id: number;
    peer_id: number;
    duration_seconds: number;
    rating: number | null;
  }>(
    `SELECT user_id, peer_id, duration_seconds, rating FROM call_summaries WHERE room_id = $1`,
    [roomId],
  );
  expect(
    summaryRows.map((r) => r.user_id).sort(),
    "one summary row per participant",
  ).toEqual([a.userId, b.userId].sort());
  expect(
    summaryRows.map((r) => r.peer_id).sort(),
    "each row points at the other person",
  ).toEqual([a.userId, b.userId].sort());
  expect(
    summaryRows.every((r) => r.duration_seconds > 0),
    "duration is positive",
  ).toBe(true);
  expect(
    summaryRows.find((r) => r.user_id === a.userId)?.rating,
    "A's rating persisted",
  ).toBe(4);
  expect(
    summaryRows.find((r) => r.user_id === b.userId)?.rating,
    "B never rated",
  ).toBeNull();

  // RELOAD: a full page reload of the summary still renders it (server-read),
  // and history loads the persisted row in a later navigation.
  await a.page.reload();
  await expect(a.page.locator("[data-summary-root]")).toBeVisible({
    timeout: 30_000,
  });
  await a.page.locator('[data-testid="summary-history"]').click();
  await expect(a.page, "A opens history").toHaveURL(routes.history, {
    timeout: 30_000,
  });
  await expect(a.page.locator("[data-history-root]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(a.page.locator('[data-testid="history-row"]')).toHaveCount(1);
  await expect(a.page.locator('[data-testid="history-row"]')).toHaveAttribute(
    "data-history-peer",
    `${b.persona.firstName} ${b.persona.lastName}`,
  );
  // The row's Recap link opens this room's recap — the proof path's link
  // builder produces a well-formed recap URL (a query-string prefix must not
  // get /<roomId>/summary appended to it).
  await a.page
    .locator('[data-testid="history-row"] a:has-text("Recap")')
    .click();
  await expect(a.page, "A opens the recap from history").toHaveURL(
    routes.summary(roomId),
    { timeout: 30_000 },
  );
  await expect(a.page.locator("[data-summary-root]")).toBeVisible({
    timeout: 30_000,
  });
  await a.page.locator('[data-testid="summary-history"]').click();
  await expect(a.page, "A back in history").toHaveURL(routes.history, {
    timeout: 30_000,
  });
  await a.page.reload();
  await expect(a.page.locator('[data-testid="history-row"]')).toHaveCount(1);
  await expect(a.page.locator('[data-testid="history-row"]')).toHaveAttribute(
    "data-history-peer",
    `${b.persona.firstName} ${b.persona.lastName}`,
  );

  // The ended room refuses re-entry honestly, and the recap still opens.
  await a.page.goto(routes.call(roomId));
  await expect(a.page.locator("[data-call-refusal]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(a.page.locator("[data-call-refusal]")).toHaveAttribute(
    "data-refusal-reason",
    "room_ended",
  );
  await a.page.goto(routes.summary(roomId));
  await expect(a.page.locator("[data-summary-root]")).toBeVisible({
    timeout: 30_000,
  });

  // UNAUTHORIZED: C never matched into this room; the room and the recap
  // refuse without leaking whether either exists, and C's history is empty.
  await c.page.goto(routes.call(roomId));
  await expect(c.page.locator("[data-call-refusal]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(c.page.locator("[data-call-refusal]")).toHaveAttribute(
    "data-refusal-reason",
    "not_a_participant",
  );
  await c.page.goto(routes.summary(roomId));
  await expect(c.page.locator("[data-summary-refusal]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(c.page.locator("[data-summary-refusal]")).toHaveAttribute(
    "data-refusal-reason",
    "not_a_participant",
  );
  await c.page.goto(routes.history);
  await expect(c.page.locator("[data-history-root]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    c.page.locator('[data-testid="history-row"]'),
    "C's history holds none of their calls",
  ).toHaveCount(0);
});
