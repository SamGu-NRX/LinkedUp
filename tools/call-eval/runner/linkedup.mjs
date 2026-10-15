/**
 * LinkedUp's side of the harness: the people in a call and how they get
 * there.
 *
 * - Personas A, B and the outsider O are Clerk users on the stack's keyless
 *   development instance (created once through Clerk's Backend API) with
 *   onboarded users rows in the stack's Postgres. Sign-up and onboarding are
 *   the J suite's job (tests/e2e/journeys.spec.ts); the harness starts from
 *   people who have done both.
 * - A peer signs in with @clerk/testing (a sign-in token, no password typed),
 *   then queues on the journey-proof queue page and accepts the match, so
 *   every call room comes from the real queue.
 * - Between scenarios the personas are freed: their active rooms end and
 *   their queue entries exit, so the next scenario's queue pairs them anew.
 *
 * The keyless instance's keys are read from .clerk/.tmp/keyless.json into
 * this process only. Nothing here prints them.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { LOCAL_DATABASE_URL, PG_DATA_DIR } = require(path.join(ROOT, "scripts", "stack-paths.cjs"));
const KEYLESS_PATH = path.join(ROOT, ".clerk", ".tmp", "keyless.json");

/** Every harness persona's email carries this marker (and Clerk's +clerk_test). */
export const PERSONA_MARK = "+clerk_test_callh";
export const PERSONAS = ["A", "B", "O"];
export const emailOf = (letter) => `peer-${letter.toLowerCase()}${PERSONA_MARK}@example.com`;
const nameOf = (letter) => ({ first: "Peer", last: letter });

/** The stack database, refusing any other (the same two checks as tests/stack-db.ts). */
export async function openStackDb() {
  // Fleet TURN proof shares the localhost server but owns this one database.
  const fleetUrl = process.env.LINKEDUP_EVAL_DATABASE_URL;
  if (fleetUrl) {
    const parsed = new URL(fleetUrl);
    if (parsed.hostname !== "127.0.0.1" || parsed.port !== "54329" || parsed.pathname !== "/linkedup_turn") {
      throw new Error("Fleet eval writes only to 127.0.0.1:54329/linkedup_turn.");
    }
    const sql = postgres(fleetUrl, { max: 2, idle_timeout: 5, onnotice: () => {} });
    const [identity] = await sql`SELECT current_database() AS name, inet_server_addr()::text AS host, inet_server_port() AS port`;
    if (identity.name !== "linkedup_turn" || (identity.host !== "127.0.0.1/32" && identity.host !== "127.0.0.1") || identity.port !== 54329) {
      await sql.end();
      throw new Error("Fleet eval database identity did not match.");
    }
    return sql;
  }
  const inherited = process.env.DATABASE_URL;
  if (inherited !== undefined && inherited !== LOCAL_DATABASE_URL) {
    throw new Error("Refusing DATABASE_URL: the harness writes only to this checkout's stack database. Unset it.");
  }
  const sql = postgres(LOCAL_DATABASE_URL, { max: 2, idle_timeout: 5, onnotice: () => {} });
  const [{ data_directory: dir }] = await sql`SHOW data_directory`;
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  };
  if (real(dir) !== real(PG_DATA_DIR)) {
    await sql.end();
    throw new Error(`Refusing the Postgres on ${LOCAL_DATABASE_URL}: it serves ${dir}, not ${PG_DATA_DIR}`);
  }
  return sql;
}

/** Load the keyless keys into this process (for Clerk's Backend API and @clerk/testing). */
export async function loadClerkKeys(baseUrl, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let provoked = false;
  for (;;) {
    if (fs.existsSync(KEYLESS_PATH)) {
      const keys = JSON.parse(fs.readFileSync(KEYLESS_PATH, "utf8"));
      if (keys.publishableKey && keys.secretKey) {
        process.env.CLERK_PUBLISHABLE_KEY = keys.publishableKey;
        process.env.CLERK_SECRET_KEY = keys.secretKey;
        const { clerkSetup } = await import("@clerk/testing/playwright");
        await clerkSetup();
        return;
      }
    }
    if (!provoked) {
      // Keyless mode provisions its instance from the browser (a server
      // action Clerk's components call on first load), not on a bare fetch.
      provoked = true;
      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(new URL("/sign-in", baseUrl).toString(), { waitUntil: "networkidle", timeout: 120_000 });
        for (let i = 0; i < 60 && !fs.existsSync(KEYLESS_PATH); i++) await page.waitForTimeout(1000);
      } finally {
        await browser.close();
      }
      continue;
    }
    if (Date.now() > deadline) throw new Error(`no keyless Clerk keys at ${KEYLESS_PATH}; is the stack up in keyless mode?`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function clerkApi(method, apiPath, body) {
  const res = await fetch(`https://api.clerk.com/v1${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Clerk Backend API ${method} ${apiPath.split("?")[0]} answered ${res.status}`);
  return res.json();
}

/**
 * Make sure every persona exists in Clerk and as an onboarded users row.
 * Returns { A: { email, clerkId, userId }, ... }.
 */
export async function ensurePersonas(sql) {
  const out = {};
  for (const letter of PERSONAS) {
    const email = emailOf(letter);
    let [user] = await clerkApi("GET", `/users?email_address=${encodeURIComponent(email)}`);
    if (!user) {
      const { first, last } = nameOf(letter);
      user = await clerkApi("POST", "/users", {
        email_address: [email],
        first_name: first,
        last_name: last,
        skip_password_requirement: true,
      });
    }
    const { first, last } = nameOf(letter);
    const [row] = await sql`
      INSERT INTO users (clerk_id, email, first_name, last_name, age, gender, field, onboarding_complete)
      VALUES (${user.id}, ${email}, ${first}, ${last}, 30, 'prefer-not-to-say', 'software', true)
      ON CONFLICT (clerk_id) DO UPDATE SET onboarding_complete = true
      RETURNING id`;
    out[letter] = { email, clerkId: user.id, userId: row.id };
  }
  return out;
}

/**
 * Free the personas for the next scenario: end their active rooms (closing
 * call sessions with them) and exit their live queue entries. Refuses to go
 * on if someone else is waiting in the casual queue: pairing takes the
 * oldest waiting entries, whoever owns them.
 */
export async function freePersonas(sql, personas) {
  const ids = Object.values(personas).map((p) => p.userId);
  await sql`
    UPDATE call_sessions SET state = 'closed', closed_reason = 'ended', updated_at = now()
    WHERE state = 'open' AND room_id IN (
      SELECT id FROM rooms WHERE status = 'active' AND (user1_id = ANY(${ids}) OR user2_id = ANY(${ids})))`;
  await sql`
    UPDATE rooms SET status = 'ended', ended_at = now()
    WHERE status = 'active' AND (user1_id = ANY(${ids}) OR user2_id = ANY(${ids}))`;
  await sql`
    UPDATE queue_entries SET status = 'exited', exited_at = now()
    WHERE user_id = ANY(${ids}) AND status IN ('waiting', 'matched')`;
  const foreign = await sql`
    SELECT count(*)::int AS n FROM queue_entries
    WHERE status IN ('waiting', 'matched') AND NOT (user_id = ANY(${ids}))`;
  if (foreign[0].n > 0) {
    throw new Error(`${foreign[0].n} other live queue entries exist; the harness's people would pair with them. Stop the other run first.`);
  }
}

/** Closed call sessions in a room, oldest first, as { participant: "A", reason, at }. */
export async function closedSessions(sql, roomId, personas) {
  const letterOf = new Map(Object.entries(personas).map(([letter, p]) => [p.userId, letter]));
  const rows = await sql`
    SELECT user_id, closed_reason, updated_at FROM call_sessions
    WHERE room_id = ${roomId} AND state = 'closed' ORDER BY updated_at`;
  return rows.map((r) => ({ participant: letterOf.get(r.user_id) ?? `user ${r.user_id}`, reason: r.closed_reason, at: r.updated_at.getTime() }));
}

/** Sign a peer's browser in as a persona, the way @clerk/testing does it. */
export async function signIn(page, baseUrl, email) {
  const { clerk, setupClerkTestingToken } = await import("@clerk/testing/playwright");
  await setupClerkTestingToken({ page });
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await clerk.signIn({ page, emailAddress: email });
}
