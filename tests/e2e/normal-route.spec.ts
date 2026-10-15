// tests/e2e/normal-route.spec.ts — the focused two-browser normal-route proof.
//
// Two real people (Clerk's live form, the five-step onboarding wizard, the
// DB-backed queue engine, the P2P call over the app's own signaling) walk:
// onboarding -> match through the queue -> synthetic audio AND video both
// ways -> controls (mute, camera) -> a reload inside the call -> recovery ->
// one leaves (the other stays) -> Done ends the room and Postgres releases
// every row (room ended, queue entries exited, call sessions closed).
//
// The normal routes are gated by the reserved middleware on a session-token
// claim (metadata.onboardingComplete) that the keyless Clerk instance never
// issues (tests/e2e/helpers/normal-route.ts records the exact evidence, and
// tests/unit/middleware.onboarding-loop.witness.test.ts holds the unit
// witness). So:
//
//   - the first case is the blocker WITNESS: expected to fail until the
//     instance carries the claim, it records decoded claims, the middleware
//     bounce per normal URL, and Clerk's own CLI refusal;
//   - each seed's journey runs on the NORMAL routes when they are reachable,
//     otherwise on the labelled journey-proof path that serves the very same
//     DB-backed queue engine and call room — recorded in the run's notes as
//     "route: normal" or "route: proof". Nothing intercepts the app either
//     way; the only route handler is @clerk/testing's on Clerk's Frontend API.
//
// Focused run:  pnpm exec playwright test tests/e2e/normal-route.spec.ts
// Seeds:        N_SEEDS (default 3).
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
  type Persona,
} from "./helpers/persona";
import {
  blockedSetupSummary,
  gotoNormalQueue,
  normalRouteReachable,
  probeNormalRoutes,
  sessionClaims,
} from "./helpers/normal-route";
import { deleteClerkUserByEmail } from "./helpers/clerk-keyless";
import { appendScorecard, deleteJourneyRows, many, one, liveQueueRows, userRowByEmail } from "./helpers/db";

const SEEDS = Number(process.env.N_SEEDS ?? 3);

/** The RTCPeerConnection/getUserMedia probe, injected per context (tools/call-eval contract). */
const PROBE_INIT = (() => {
  const source = readFileSync(path.resolve(__dirname, "../../tools/call-eval/runner/probe.mjs"), "utf8");
  const start = source.indexOf("export const probeInit = String.raw`");
  if (start === -1) throw new Error("probe.mjs: no probeInit template found");
  const bodyStart = start + "export const probeInit = String.raw`".length;
  const end = source.indexOf("\n`;", bodyStart);
  if (end === -1) throw new Error("probe.mjs: unterminated probeInit template");
  return source.slice(bodyStart, end);
})();

/** Everyone a test created, for cleanup whatever happened. */
let created: { context: BrowserContext; email: string }[] = [];

test.beforeEach(() => {
  created = [];
});

test.afterEach(async ({}, testInfo) => {
  const seed = testInfo.title.match(/seed (\d+)/)?.[1];
  await appendScorecard({
    file: process.env.N_SCORECARD,
    case: testInfo.title.replace(/ · seed \d+$/, ""),
    seed: seed === undefined ? undefined : Number(seed),
    status: testInfo.status === testInfo.expectedStatus ? "passed" : "failed",
    durationMs: testInfo.duration,
    notes: testInfo.annotations.filter((n) => n.description).map((n) => `${n.type}: ${n.description}`),
    error: testInfo.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 600),
  } as never);
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
  await context.addInitScript(PROBE_INIT);
  const page = await context.newPage();
  await signUpPersona(page, persona);
  await completeOnboarding(page, persona);
  const row = await userRowByEmail(persona.email);
  expect(row, `${letter}: users row`).not.toBeNull();
  expect(row!.onboarding_complete, `${letter}: onboarding_complete`).toBe(true);
  return { persona, context, page, userId: row!.id };
}

/**
 * Which routes this run uses. "normal" only when the middleware actually
 * lets a finished persona through; the reason it does not is attached.
 */
async function chooseRoute(a: Actor, attach: (type: string, description: string) => void): Promise<"normal" | "proof"> {
  const claims = await sessionClaims(a.context);
  const claimPresent =
    (claims as { metadata?: { onboardingComplete?: unknown } })?.metadata?.onboardingComplete === true;
  if (claimPresent && (await normalRouteReachable(a.context))) {
    attach("route", "route: normal — the session token carries the middleware's claim");
    return "normal";
  }
  for (const line of await blockedSetupSummary(a.context)) attach("blocked-setup", line);
  attach("route", "route: proof — normal routes unreachable (evidence in blocked-setup notes)");
  return "proof";
}

/** Queue, get paired into one active room, and land on the same call screen. */
async function matchAndEnterCall(
  a: Actor,
  b: Actor,
  route: "normal" | "proof",
): Promise<{ roomId: string; callUrlPrefix: string }> {
  const queue = async (actor: Actor) =>
    route === "normal" ? gotoNormalQueue(actor.page, "casual") : gotoQueue(actor.page, "casual");
  await Promise.all([queue(a), queue(b)]);
  await waitForQueuePhase(a.page, "matched", 30_000);
  await waitForQueuePhase(b.page, "matched", 30_000);
  const [ea] = await liveQueueRows(a.userId);
  const [eb] = await liveQueueRows(b.userId);
  expect(ea?.status, "A's queue entry matched").toBe("matched");
  expect(eb?.status, "B's queue entry matched").toBe("matched");
  expect(ea.room_id, "paired into the same room").toBe(eb.room_id);
  const roomId = ea.room_id!;

  const callUrlRe = route === "normal" ? /\/app\/call\/([0-9a-f-]{36})/ : /room=([0-9a-f-]{36})/;
  const accept = async (actor: Actor) => {
    await actor.page.locator("[data-call-accept]").click();
    await actor.page.waitForURL(callUrlRe, { timeout: 30_000 });
    await actor.page.locator("[data-call-root]").waitFor({ state: "visible", timeout: 60_000 });
    expect(actor.page.url().match(callUrlRe)![1], "landed in the matched room").toBe(roomId);
  };
  await Promise.all([accept(a), accept(b)]);
  return { roomId, callUrlPrefix: route === "normal" ? `/app/call/${roomId}` : `/onboarding?journey-proof=call&room=${roomId}` };
}

/** Both sides connected, seeing each other's video tile. */
async function expectConnected(a: Actor, b: Actor): Promise<void> {
  for (const actor of [a, b]) {
    await expect(
      actor.page.locator('[data-call-root][data-call-phase="connected"]'),
      `${actor.persona.email}: connected`,
    ).toBeVisible({ timeout: 60_000 });
    await expect(actor.page.locator('[data-testid="remote-media"] video')).toBeVisible({ timeout: 60_000 });
  }
}

/** The remote <video> advances (frames keep arriving) on both sides. */
async function expectRemoteVideoFlows(a: Actor, b: Actor): Promise<void> {
  for (const actor of [a, b]) {
    await expect
      .poll(
        async () =>
          actor.page.evaluate(() => {
            const v = document.querySelector('[data-testid="remote-media"] video') as HTMLVideoElement | null;
            if (!v) return 0;
            const t0 = v.currentTime;
            return new Promise<number>((resolve) =>
              setTimeout(() => resolve((v as HTMLVideoElement).currentTime > t0 ? 1 : 0), 700),
            );
          }),
        { timeout: 15_000, message: `${actor.persona.email}: remote video frames advance` },
      )
      .toBe(1);
  }
}

/**
 * Polls a session-row predicate from the stack's Postgres until it holds.
 * expect.poll's matcher set lacks toSatisfy, so the poll is spelled out.
 */
async function expectSessionFlag<T>(
  query: () => Promise<T[]>,
  holds: (rows: T[]) => boolean,
  message: string,
): Promise<void> {
  const until = Date.now() + 15_000;
  for (;;) {
    if (holds(await query())) return;
    if (Date.now() > until) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  expect(holds(await query()), message).toBe(true);
}

/** Inbound audio RTP bytes grow on a side — the synthetic tone is arriving. */
async function expectAudioFlows(actor: Actor): Promise<void> {
  const bytes = () =>
    actor.page.evaluate(async () => {
      const pcs = (window as unknown as { __wrappedPcs?: RTCPeerConnection[] }).__wrappedPcs ?? [];
      let total = 0;
      for (const pc of pcs) {
        for (const receiver of pc.getReceivers()) {
          if (receiver.track?.kind !== "audio") continue;
          const stats = await receiver.getStats();
          stats.forEach((s) => {
            if (s.type === "inbound-rtp" && typeof (s as RTCInboundRtpStreamStats).bytesReceived === "number") {
              total += (s as RTCInboundRtpStreamStats).bytesReceived!;
            }
          });
        }
      }
      return total;
    });
  const [before, after] = await [await bytes(), await new Promise((r) => setTimeout(r, 1_500)).then(bytes)];
  expect(after, `${actor.persona.email}: inbound audio bytes grow`).toBeGreaterThan(before);
}

// ---------------------------------------------------------------------------
// The blocker witness. Expected to FAIL until the instance carries the claim;
// Playwright records it green while it fails, and red the day it passes —
// the day to delete it and run this whole file on normal routes.
// ---------------------------------------------------------------------------
test("witness (expected to fail until the instance carries the claim): a finished person reaches the normal app routes", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const actor = await newActor(browser, "W");
  test.fail(
    true,
    "src/middleware.ts gates on metadata.onboardingComplete; the keyless instance cannot issue it (evidence below)",
  );
  for (const line of await blockedSetupSummary(actor.context)) {
    testInfo.attach("blocked-setup", { body: line });
    console.log(`[blocked-setup] ${line}`);
  }
  const claims = await sessionClaims(actor.context);
  // The claim the middleware reads must reach the presented token...
  expect(
    (claims as { metadata?: { onboardingComplete?: unknown } }).metadata?.onboardingComplete,
    "session token carries metadata.onboardingComplete",
  ).toBe(true);
  // ...and then the normal routes must serve the app instead of bouncing.
  for (const outcome of await probeNormalRoutes(actor.context)) {
    expect(outcome.bouncedToOnboarding, `GET ${outcome.url} is served, not bounced`).toBe(false);
  }
});

for (let seed = 1; seed <= SEEDS; seed++) {
  test(`N1 two people match, talk, recover, leave, and release the room · seed ${seed}`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(420_000);
    const [a, b] = await Promise.all([newActor(browser, "A"), newActor(browser, "B")]);
    const route = await chooseRoute(a, (type, description) => testInfo.attach(type, { body: description }));

    const { roomId, callUrlPrefix } = await matchAndEnterCall(a, b, route);
    await expectConnected(a, b);
    await expectRemoteVideoFlows(a, b);
    await expectAudioFlows(a);
    await expectAudioFlows(b);

    // Controls: mute reaches the DOM contract AND the server's session row.
    await a.page.locator('[data-testid="toggle-mic"]').click();
    await expect(a.page.locator('[data-testid="toggle-mic"]'), "mic button shows muted").toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectSessionFlag(
      () =>
        many<{ mic_on: boolean }>(
          `SELECT mic_on FROM call_sessions WHERE room_id = $1 AND user_id = $2 AND state = 'open'`,
          [roomId, a.userId],
        ),
      (rows) => rows.length > 0 && rows.every((r) => !r.mic_on),
      "A's open call session reports mic_on=false",
    );
    await a.page.locator('[data-testid="toggle-mic"]').click(); // back live

    // Camera off: the local preview goes away and the session row agrees.
    await a.page.locator('[data-testid="toggle-camera"]').click();
    await expect(a.page.locator('[data-testid="toggle-camera"]')).toHaveAttribute("aria-pressed", "true");
    await expect(a.page.locator('[data-testid="local-video"]')).toHaveCount(0);
    await expectSessionFlag(
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
    // B kept receiving throughout the control churn.
    await expect(b.page.locator('[data-call-root][data-call-phase="connected"]')).toBeVisible();

    // Reload inside the call: B rejoins the same room and media flows again.
    await b.page.reload();
    await expect(b.page.locator("[data-call-root]"), "B is back on the call screen").toBeVisible({
      timeout: 60_000,
    });
    expect(b.page.url(), "reload returns to the same room").toContain(callUrlPrefix);
    await expectConnected(a, b);
    await expectRemoteVideoFlows(a, b);
    const bSessions = await many<{ id: number; state: string }>(
      `SELECT id, state FROM call_sessions WHERE room_id = $1 AND user_id = $2 ORDER BY id`,
      [roomId, b.userId],
    );
    expect(bSessions.length, "B's reload opened a second session in the room").toBeGreaterThanOrEqual(2);

    // A leaves: A sees the left screen; B stays connected, waiting alone.
    await a.page.locator('[data-testid="leave-call"]').click();
    await expect(a.page.locator('[data-call-root][data-call-phase="left"]')).toBeVisible();
    await expect(a.page.locator('[data-testid="call-done"]')).toBeVisible();
    await expect(b.page.locator("[data-call-partner-waiting]"), "B waits alone").toBeVisible({ timeout: 30_000 });
    expect(
      (await b.page.locator('[data-call-root]').getAttribute("data-call-phase")),
      "B is still in the call",
    ).not.toBe("failed");

    // A presses Done: the room ends for both, and Postgres releases everything.
    await a.page.locator('[data-testid="call-done"]').click();
    const exitRe = route === "normal" ? /\/app\/?$/ : /journey-proof=queue/;
    await expect(a.page, "A lands back on the queue").toHaveURL(exitRe, { timeout: 30_000 });
    await expect(b.page.locator('[data-call-root][data-call-phase="failed"]'), "B sees the ended call").toBeVisible({
      timeout: 30_000,
    });
    await b.page.locator('[data-testid="call-done"]').click();
    await expect(b.page, "B lands back on the queue too").toHaveURL(exitRe, { timeout: 30_000 });

    const room = await one<{ status: string; ended_at: Date | null }>(
      `SELECT status, ended_at FROM rooms WHERE id = $1`,
      [roomId],
    );
    expect(room?.status, "room ended").toBe("ended");
    expect(room?.ended_at, "room end timestamped").not.toBeNull();
    const entries = await many<{ user_id: number; status: string; exited_at: Date | null }>(
      `SELECT user_id, status, exited_at FROM queue_entries WHERE room_id = $1`,
      [roomId],
    );
    expect(entries.map((e) => e.user_id).sort(), "both entries released").toEqual([a.userId, b.userId].sort());
    for (const entry of entries) {
      expect(entry.status, "queue entry exited").toBe("exited");
      expect(entry.exited_at, "exit timestamped").not.toBeNull();
    }
    const openSessions = await many<{ id: number }>(
      `SELECT id FROM call_sessions WHERE room_id = $1 AND state = 'open'`,
      [roomId],
    );
    expect(openSessions, "no call session left open").toEqual([]);
  });
}
