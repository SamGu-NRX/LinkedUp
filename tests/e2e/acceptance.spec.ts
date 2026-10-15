// tests/e2e/acceptance.spec.ts — the single full-journey acceptance run.
//
// One command (`pnpm test:acceptance`, scripts/acceptance/run.mjs) proves the
// whole local story of docs/plan/CALL-PLAN.md on the real keyless dev stack:
// local Postgres (scripts/dev-up.mjs), generated media (Chromium's synthetic
// mic/cam), and three ISOLATED browser contexts — A and B walk the whole
// journey, C supplies the third-user and cancellation cases:
//
//   real sign-up -> five-step onboarding -> interests persisted in Postgres
//   -> queue pairing (A waits, B joins) -> C queues and keeps waiting while
//   exactly one room exists -> C cancels (entry exits, pair untouched)
//   -> both accept -> real two-way media over the app's own signaling
//   (inbound audio RTP bytes grow, remote video frames advance, both sides)
//   -> controls mirrored in call_sessions -> reload recovers -> A leaves,
//   rates, Done -> both land on their own persisted summaries -> history
//   reloads -> ended room and outsider refused -> Postgres releases the room,
//   both queue entries and every call session.
//
// Fail-closed: absent remote media or absent cleanup fails the run (the
// validator demands the counters and rows themselves, not green step names),
// and a failure names its step. LINKEDUP_ACCEPTANCE_FAIL_AT=<step> injects a
// failure at a named step for proving exactly that.
//
// The journey runs on the NORMAL routes when the middleware lets a finished
// persona through, otherwise on the labelled journey-proof path serving the
// same DB-backed queue engine and call room (the route is recorded in the
// evidence either way). Nothing intercepts the app's documents or APIs; the
// only route handler is @clerk/testing's, on Clerk's own Frontend API.
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
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
  blockedSetupSummary,
  normalRouteReachable,
  sessionClaims,
} from "./helpers/normal-route";
import { deleteClerkUserByEmail } from "./helpers/clerk-keyless";
import {
  deleteJourneyRows,
  interestNamesForUser,
  liveQueueRows,
  many,
  one,
  queueRowsForUser,
  roomRow,
  roomsForUsers,
  userRowByEmail,
} from "./helpers/db";
import {
  AcceptanceRun,
  PROBE_INIT,
  acceptanceStep,
  remoteMediaSideDetail,
} from "./helpers/acceptance";

const INJECTED_FAIL_AT = process.env.LINKEDUP_ACCEPTANCE_FAIL_AT ?? null;

interface Actor {
  persona: Persona;
  context: BrowserContext;
  page: Page;
  userId: number;
}

/** Everyone the test created, cleaned up whatever happened. */
let created: { context: BrowserContext; email: string }[] = [];
let run: AcceptanceRun;
let startedAt = "";

test.beforeEach(() => {
  created = [];
  run = new AcceptanceRun();
  startedAt = new Date().toISOString();
});

test.afterEach(async () => {
  const testInfo = test.info();
  await run.finalize({
    testStatus: testInfo.status,
    testError: testInfo.error?.message,
    startedAt,
    injectedFailAt: INJECTED_FAIL_AT,
  });
  for (const { context } of created) await context.close().catch(() => {});
  const emails = created.map((c) => c.email).filter(Boolean);
  await deleteJourneyRows(emails);
  for (const email of emails) await deleteClerkUserByEmail(email);
});

/** A real person: Clerk sign-up, onboarding wizard, Postgres row, own browser. */
async function newActor(browser: Browser, persona: Persona): Promise<Actor> {
  const context = await browser.newContext();
  created.push({ context, email: persona.email });
  await context.addInitScript(PROBE_INIT);
  const page = await context.newPage();
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);
  const row = await userRowByEmail(persona.email);
  expect(row, `${persona.email}: users row`).not.toBeNull();
  expect(row!.onboarding_complete).toBe(true);
  return { persona, context, page, userId: row!.id };
}

/** Which routes this run uses; the reason for the proof path is attached. */
async function chooseRoute(a: Actor): Promise<"normal" | "proof"> {
  const claims = await sessionClaims(a.context);
  const claimPresent =
    (claims as { metadata?: { onboardingComplete?: unknown } })?.metadata
      ?.onboardingComplete === true;
  if (claimPresent && (await normalRouteReachable(a.context))) return "normal";
  const blocked = await blockedSetupSummary(a.context);
  run.note("blockedSetup", blocked.slice(0, 4));
  return "proof";
}

/** Both sides connected and seeing each other's video tile. */
async function expectConnected(a: Actor, b: Actor): Promise<void> {
  for (const actor of [a, b]) {
    await expect(
      actor.page.locator('[data-call-root][data-call-phase="connected"]'),
      `${actor.persona.email}: connected`,
    ).toBeVisible({ timeout: 90_000 });
    await expect(
      actor.page.locator('[data-testid="remote-media"] video'),
    ).toBeVisible({ timeout: 60_000 });
  }
}

/** Polls a DB predicate until it holds (expect.poll lacks toSatisfy). */
async function expectDbEventually<T>(
  query: () => Promise<T[]>,
  holds: (rows: T[]) => boolean,
  message: string,
) {
  const until = Date.now() + 15_000;
  for (;;) {
    if (holds(await query())) return;
    if (Date.now() > until) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  expect(holds(await query()), message).toBe(true);
}

test("acceptance: onboarding, interests, queue pairing, third-user wait, cancellation, real two-way media, reload recovery, persisted summaries, full cleanup", async ({
  browser,
}) => {
  test.setTimeout(900_000);

  const personaA = makePersona("A", {
    interests: ["Programming", "Video Games"],
  });
  const personaB = makePersona("B", {
    interests: ["Programming", "Video Games"],
  });
  const personaC = makePersona("C", {
    interests: ["Photography", "Playing Music"],
  });
  const step = <T>(name: string, body: () => Promise<T>) =>
    acceptanceStep(run, name, INJECTED_FAIL_AT, body);

  // --- onboarding: three real people in three isolated browsers -----------
  let actors: Actor[] = [];
  await step("onboarding-signup", async () => {
    actors = await Promise.all([
      newActor(browser, personaA),
      newActor(browser, personaB),
      newActor(browser, personaC),
    ]);
    run.note(
      "personas",
      actors.map((x) => ({
        email: x.persona.email,
        userId: x.userId,
        interests: x.persona.interests,
      })),
    );
    return { users: actors.length, isolatedContexts: 3 };
  });
  const [a, b, c] = actors;

  // The route decision needs an actor; recording it immediately after sign-up
  // keeps a mid-journey failure's summary validatable (the validator requires
  // the route note on passing and failing runs alike).
  run.note("route", await chooseRoute(a));

  await step("onboarding-rows", async () => {
    const detail: Record<string, unknown> = {};
    for (const [label, actor, persona] of [
      ["a", a, personaA],
      ["b", b, personaB],
      ["c", c, personaC],
    ] as const) {
      const row = await userRowByEmail(actor.persona.email);
      expect(row, `${label}: users row`).not.toBeNull();
      expect(row!.age).toBe(persona.age);
      expect(row!.gender).toBe(persona.gender);
      expect(row!.field).not.toBeNull();
      const interests = await interestNamesForUser(actor.userId);
      expect(interests, `${label}: interests persisted`).toEqual(
        [...persona.interests].sort(),
      );
      detail[label] = { userId: actor.userId, interests };
    }
    // C's interests genuinely differ: the queue pairs people, not duplicates.
    expect(detail.c, "C carries their own interests").not.toEqual(detail.a);
    return detail;
  });

  // --- queue: A waits alone, B joins, the server pairs them ---------------
  const { roomId } = await step("queue-pair", async () => {
    await gotoQueue(a.page, "casual");
    const [entry] = await liveQueueRows(a.userId);
    expect(entry?.status).toBe("waiting");
    await a.page.waitForTimeout(2_000);
    await gotoQueue(b.page, "casual");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);
    const [ea] = await liveQueueRows(a.userId);
    const [eb] = await liveQueueRows(b.userId);
    expect(ea?.status).toBe("matched");
    expect(eb?.status).toBe("matched");
    expect(ea!.room_id, "paired into the same room").toBe(eb!.room_id);
    const assignedRoomId = ea!.room_id;
    if (assignedRoomId == null)
      throw new Error("the pair was assigned no room");
    const room = await roomRow(assignedRoomId);
    expect(room?.status).toBe("active");
    expect(new Set([room!.user1_id, room!.user2_id])).toEqual(
      new Set([a.userId, b.userId]),
    );
    run.note("roomId", assignedRoomId);
    return { roomId: assignedRoomId, paired: true };
  });

  // --- third user: C queues, exactly one room, C keeps waiting ------------
  await step("third-user-waits", async () => {
    await gotoQueue(c.page, "casual");
    await waitForQueuePhase(c.page, "waiting", 30_000);
    const rooms = await roomsForUsers([a.userId, b.userId, c.userId]);
    expect(rooms, "exactly one room among the three").toHaveLength(1);
    // C keeps waiting with a live entry for five full seconds.
    const until = Date.now() + 5_000;
    while (Date.now() < until) {
      await expect(
        c.page.locator('[data-queue-phase="waiting"]'),
      ).toBeVisible();
      const live = await liveQueueRows(c.userId);
      expect(live.map((r) => r.status)).toEqual(["waiting"]);
      await c.page.waitForTimeout(1_000);
    }
    return { roomsAmongThree: 1, cStillWaiting: true };
  });

  // --- cancellation: C leaves the queue; the pair is untouched ------------
  await step("cancellation", async () => {
    await c.page.locator("[data-queue-leave]").click();
    await c.page
      .locator('[data-journey-proof="left"]')
      .waitFor({ timeout: 30_000 });
    expect(await liveQueueRows(c.userId), "C has no live entry").toEqual([]);
    const rows = await queueRowsForUser(c.userId);
    expect(rows[0]?.status).toBe("exited");
    const exitedAt = await one<{ exited_at: Date | null }>(
      `SELECT exited_at FROM queue_entries WHERE user_id = $1 AND status = 'exited' ORDER BY id DESC`,
      [c.userId],
    );
    expect(exitedAt?.exited_at, "C's exit is timestamped").not.toBeNull();
    // The pair is untouched: still one active room, both still matched.
    const rooms = await roomsForUsers([a.userId, b.userId, c.userId]);
    expect(rooms, "still exactly one room").toHaveLength(1);
    expect((await roomRow(roomId))?.status).toBe("active");
    await waitForQueuePhase(a.page, "matched", 30_000);
    await waitForQueuePhase(b.page, "matched", 30_000);
    return { cancelled: "waiting", cExited: true, pairUntouched: true };
  });

  // --- the call: both accept, land in the same room -----------------------
  await step("call-enter", async () => {
    const [ra, rb] = await Promise.all([
      acceptMatch(a.page),
      acceptMatch(b.page),
    ]);
    expect(ra).toBe(roomId);
    expect(rb).toBe(roomId);
    for (const actor of [a, b]) {
      await expect(actor.page.locator("[data-call-root]")).toBeVisible({
        timeout: 60_000,
      });
      await expect(actor.page.locator("[data-call-refusal]")).toHaveCount(0);
    }
    return { entered: true };
  });

  // --- real two-way media, fail-closed on the counters themselves ---------
  await step("remote-media", async () => {
    await expectConnected(a, b);
    const detail: Record<string, unknown> = {};
    for (const [label, actor] of [
      ["a", a],
      ["b", b],
    ] as const) {
      const side = await remoteMediaSideDetail(actor.page);
      expect(
        side.peerConnections,
        `${label}: probe saw RTCPeerConnections`,
      ).toBe(true);
      expect(
        side.audioBytesGrew,
        `${label}: inbound audio RTP bytes grow`,
      ).toBe(true);
      expect(
        side.videoFramesAdvanced,
        `${label}: remote video frames advance`,
      ).toBe(true);
      detail[label] = side;
    }
    return detail;
  });

  // --- controls: the DOM contract is mirrored in call_sessions ------------
  await step("controls-mirrored", async () => {
    await a.page.locator('[data-testid="toggle-mic"]').click();
    await expect(a.page.locator('[data-testid="toggle-mic"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectDbEventually(
      () =>
        many<{ mic_on: boolean }>(
          `SELECT mic_on FROM call_sessions WHERE room_id = $1 AND user_id = $2 AND state = 'open'`,
          [roomId, a.userId],
        ),
      (rows) => rows.length > 0 && rows.every((r) => !r.mic_on),
      "A's open call session reports mic_on=false",
    );
    await a.page.locator('[data-testid="toggle-mic"]').click();
    await a.page.locator('[data-testid="toggle-camera"]').click();
    await expect(a.page.locator('[data-testid="local-video"]')).toHaveCount(0);
    await expectDbEventually(
      () =>
        many<{ camera_on: boolean }>(
          `SELECT camera_on FROM call_sessions WHERE room_id = $1 AND user_id = $2 AND state = 'open'`,
          [roomId, a.userId],
        ),
      (rows) => rows.length > 0 && rows.every((r) => !r.camera_on),
      "A's open call session reports camera_on=false",
    );
    await a.page.locator('[data-testid="toggle-camera"]').click();
    await expect(a.page.locator('[data-testid="local-video"]')).toBeVisible();
    await expect(
      b.page.locator('[data-call-root][data-call-phase="connected"]'),
    ).toBeVisible();
    return { micMirrored: true, cameraMirrored: true };
  });

  // --- recovery: a reload mid-call rejoins and restores media -------------
  await step("reload-recovery", async () => {
    await b.page.reload();
    await expect(b.page.locator("[data-call-root]")).toBeVisible({
      timeout: 90_000,
    });
    expect(b.page.url()).toContain(roomId);
    await expectConnected(a, b);
    const bDetail = await remoteMediaSideDetail(b.page);
    expect(bDetail.audioBytesGrew, "B: audio flows again after reload").toBe(
      true,
    );
    expect(
      bDetail.videoFramesAdvanced,
      "B: video flows again after reload",
    ).toBe(true);
    const sessions = await many<{ id: number }>(
      `SELECT id FROM call_sessions WHERE room_id = $1 AND user_id = $2 ORDER BY id`,
      [roomId, b.userId],
    );
    expect(
      sessions.length,
      "B's reload opened a second session in the room",
    ).toBeGreaterThanOrEqual(2);
    return { rejoined: true, mediaRestored: true, bSessions: sessions.length };
  });

  // --- leave and rate: A goes, B waits alone, A rates and leaves for good --
  await step("leave-and-rate", async () => {
    await a.page.locator('[data-testid="leave-call"]').click();
    await expect(
      a.page.locator('[data-call-root][data-call-phase="left"]'),
    ).toBeVisible();
    await expect(
      b.page.locator("[data-call-partner-waiting]"),
      "B waits alone",
    ).toBeVisible({ timeout: 30_000 });
    await a.page
      .locator('input[name="call-rating"][value="4"]')
      .check({ force: true });
    await a.page.locator('[data-testid="call-done"]').click();
    await expect(a.page, "A lands on their summary").toHaveURL(
      new RegExp(`summary|journey-proof=summary`),
      { timeout: 30_000 },
    );
    await expect(a.page.locator("[data-summary-root]")).toBeVisible({
      timeout: 30_000,
    });
    return { aLeft: true, aRated: 4 };
  });

  // --- persisted after-call state: summaries, history, refusals -----------
  await step("after-call-persisted", async () => {
    const summaryRe = /journey-proof=summary|\/summary/;
    await expect(a.page.locator('[data-testid="summary-peer"]')).toHaveText(
      `${b.persona.firstName} ${b.persona.lastName}`,
    );
    const durationText = await a.page
      .locator('[data-testid="summary-duration"]')
      .textContent();
    expect(durationText, "duration is rendered and positive").not.toBe("0s");
    await expect(
      a.page.locator('[data-testid="summary-rating"]'),
    ).toHaveAttribute("aria-label", "4 of 5 stars");

    await expect(
      b.page.locator('[data-call-root][data-call-phase="failed"]'),
      "B sees the ended call",
    ).toBeVisible({
      timeout: 30_000,
    });
    await b.page.locator('[data-testid="call-done"]').click();
    await expect(b.page, "B lands on their own summary").toHaveURL(summaryRe, {
      timeout: 30_000,
    });
    await expect(b.page.locator('[data-testid="summary-peer"]')).toHaveText(
      `${a.persona.firstName} ${a.persona.lastName}`,
    );
    await expect(
      b.page.locator('[data-testid="summary-rating"]'),
    ).toHaveAttribute("aria-label", "Not rated");

    // The persisted rows: exactly one per participant, peer-pointer correct,
    // real duration, A's rating saved, B's left null.
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
      "durations are positive",
    ).toBe(true);
    expect(
      summaryRows.find((r) => r.user_id === a.userId)?.rating,
      "A's rating persisted",
    ).toBe(4);
    expect(
      summaryRows.find((r) => r.user_id === b.userId)?.rating,
      "B never rated",
    ).toBeNull();

    // History reloads the row in a later navigation; the recap link opens it.
    await a.page.reload();
    await expect(a.page.locator("[data-summary-root]")).toBeVisible({
      timeout: 30_000,
    });
    await a.page.locator('[data-testid="summary-history"]').click();
    await expect(a.page.locator("[data-history-root]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(a.page.locator('[data-testid="history-row"]')).toHaveCount(1);
    await expect(a.page.locator('[data-testid="history-row"]')).toHaveAttribute(
      "data-history-peer",
      `${b.persona.firstName} ${b.persona.lastName}`,
    );
    await a.page
      .locator('[data-testid="history-row"] a:has-text("Recap")')
      .click();
    await expect(a.page).toHaveURL(summaryRe, { timeout: 30_000 });
    await expect(a.page.locator("[data-summary-root]")).toBeVisible({
      timeout: 30_000,
    });

    // The ended room refuses A honestly...
    await a.page.goto(`/onboarding?journey-proof=call&room=${roomId}`);
    await expect(a.page.locator("[data-call-refusal]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(a.page.locator("[data-call-refusal]")).toHaveAttribute(
      "data-refusal-reason",
      "room_ended",
    );
    // ...and C, who never joined this room, is refused room and recap alike.
    await c.page.goto(`/onboarding?journey-proof=call&room=${roomId}`);
    await expect(c.page.locator("[data-call-refusal]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(c.page.locator("[data-call-refusal]")).toHaveAttribute(
      "data-refusal-reason",
      "not_a_participant",
    );
    await c.page.goto(`/onboarding?journey-proof=summary&room=${roomId}`);
    await expect(c.page.locator("[data-summary-refusal]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(c.page.locator("[data-summary-refusal]")).toHaveAttribute(
      "data-refusal-reason",
      "not_a_participant",
    );
    await c.page.goto(`/onboarding?journey-proof=history`);
    await expect(
      c.page.locator('[data-testid="history-row"]'),
      "C's history holds none of it",
    ).toHaveCount(0);

    return {
      summariesPersisted: 2,
      historyReloaded: true,
      outsiderRefused: true,
    };
  });

  // --- cleanup: Postgres released every row (fail-closed) ------------------
  await step("cleanup-released", async () => {
    const room = await one<{ status: string; ended_at: Date | null }>(
      `SELECT status, ended_at FROM rooms WHERE id = $1`,
      [roomId],
    );
    const roomEnded = room?.status === "ended";
    const roomEndedAt = room?.ended_at != null;
    expect(roomEnded, "room ended").toBe(true);
    expect(roomEndedAt, "room end timestamped").toBe(true);
    const entries = await many<{
      user_id: number;
      status: string;
      exited_at: Date | null;
    }>(
      `SELECT user_id, status, exited_at FROM queue_entries WHERE room_id = $1`,
      [roomId],
    );
    expect(
      entries.map((e) => e.user_id).sort(),
      "both entries released",
    ).toEqual([a.userId, b.userId].sort());
    for (const entry of entries) {
      expect(entry.status, "queue entry exited").toBe("exited");
      expect(entry.exited_at, "exit timestamped").not.toBeNull();
    }
    const openSessions = await many<{ id: number }>(
      `SELECT id FROM call_sessions WHERE room_id = $1 AND state = 'open'`,
      [roomId],
    );
    expect(openSessions, "no call session left open").toEqual([]);
    return {
      roomEnded,
      roomEndedAt,
      openSessions: openSessions.length,
      exitedEntries: entries.map((e) => ({
        user_id: e.user_id,
        status: e.status,
      })),
    };
  });
});
