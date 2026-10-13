// @vitest-environment node
// Witnesses for the security review of alpha 584acc5 (src/lib/call/mesh.ts).
// Each fails against 584acc5. They run on the stack's Postgres; the
// concurrency cases use real parallel transactions on separate connections.
import "./support/use-stack-db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { callSignals, rooms, users } from "@/db/schema";
import {
  CLEANUP_BATCH,
  MAINTENANCE_INTERVAL_MS,
  SIGNAL_RETENTION_MS,
  joinCall,
  pollCall,
  sendSignals,
} from "@/lib/call/mesh";
import type { WireSignal } from "@/lib/call/signal-protocol";

const PREFIX = "witness_harden_";
let a: number, b: number;
let room: string;

async function makeUser(tag: string) {
  const clerkId = `${PREFIX}${tag}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const [row] = await db
    .insert(users)
    .values({ clerkId, email: `${clerkId}@witness.local`, onboardingComplete: true })
    .returning({ id: users.id });
  return row.id;
}
async function makeRoom(u1: number, u2: number) {
  const [row] = await db.insert(rooms).values({ queueType: "casual", status: "active", user1Id: u1, user2Id: u2 }).returning({ id: rooms.id });
  return row.id;
}
const sid = (tag: string) => `${tag}-${Math.random().toString(36).slice(2, 10)}`;
const cand = (i: number): WireSignal => ({ kind: "candidate", candidate: `candidate:${i} 1 udp 1 127.0.0.1 9 typ host`, sdpMid: "0", sdpMLineIndex: 0 });

beforeEach(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
  a = await makeUser("a");
  b = await makeUser("b");
  room = await makeRoom(a, b);
});
afterAll(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
});

describe("1. simultaneous sends in both directions", () => {
  it("never deadlock: every A->B and B->A send commits", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    const failures: string[] = [];
    for (let round = 0; round < 40; round++) {
      const results = await Promise.allSettled([
        sendSignals(a, room, as, [{ toSessionId: bs, signal: cand(round) }]),
        sendSignals(b, room, bs, [{ toSessionId: as, signal: cand(round) }]),
      ]);
      for (const r of results) if (r.status === "rejected") failures.push(String((r.reason as Error).message).slice(0, 80));
      // Keep both queues short so the queue cap never refuses.
      for (const [user, s] of [[a, as], [b, bs]] as const) {
        const polled = await pollCall(user, room, s);
        if (polled.alive) await pollCall(user, room, s, polled.signals.map((x) => x.id));
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

describe("2. maintenance keeps up without joins", () => {
  const countRoomSignals = async () =>
    (await db.select({ n: sql<number>`count(*)::int` }).from(callSignals).where(eq(callSignals.roomId, room)))[0].n;

  it("a poll catches up on a backlog larger than one batch", async () => {
    const as = sid("a");
    const t0 = new Date();
    await joinCall(a, room, as, t0);
    const old = new Date(t0.getTime() - SIGNAL_RETENTION_MS - 60_000);
    const row = { roomId: room, fromSessionId: "from-xxxxxxxx", fromUserId: a, toSessionId: "to-xxxxxxxxxx", payload: cand(0), processed: true, createdAt: old };
    await db.insert(callSignals).values(Array.from({ length: CLEANUP_BATCH * 2 + 250 }, () => row));
    // Due: the last run was long enough ago.
    await pollCall(a, room, as, [], new Date(t0.getTime() + MAINTENANCE_INTERVAL_MS + 1000));
    expect(await countRoomSignals()).toBe(0);
  }, 60_000);

  it("a long call's signal table stays bounded with no joins after the start", async () => {
    const as = sid("a");
    const bs = sid("b");
    const t0 = new Date();
    await joinCall(a, room, as, t0);
    await joinCall(b, room, bs, t0);
    // Both poll every 6 s (inside the 10 s heartbeat expiry), A sends two
    // candidates each step (20 a minute), B acknowledges them.
    const STEP_MS = 6_000;
    const PER_MINUTE = 20;
    const MINUTES = 25;
    let delivered = 0;
    for (let step = 1; step <= (MINUTES * 60_000) / STEP_MS; step++) {
      const now = new Date(t0.getTime() + step * STEP_MS);
      await pollCall(a, room, as, [], now);
      const polled = await pollCall(b, room, bs, [], now);
      const sent = await sendSignals(a, room, as, [0, 1].map((i) => ({ toSessionId: bs, signal: cand(i) })), now);
      delivered += sent.delivered.filter(Boolean).length;
      if (polled.alive) await pollCall(b, room, bs, polled.signals.map((s) => s.id), now);
    }
    expect(delivered, "every signal was stored").toBe(MINUTES * PER_MINUTE);
    // Read signals live SIGNAL_RETENTION_MS, so about ten minutes' worth
    // remain (plus one maintenance interval); 25 minutes' would be 500.
    const retainedMinutes = (SIGNAL_RETENTION_MS + MAINTENANCE_INTERVAL_MS) / 60_000 + 1;
    expect(await countRoomSignals()).toBeLessThanOrEqual(Math.ceil(retainedMinutes) * PER_MINUTE);
  }, 600_000);
});
