// @vitest-environment node
// Call signaling against the stack's Postgres (src/lib/call/mesh.ts): who
// gets in, where signals go, and every limit, each with one right answer.
import "./support/use-stack-db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { callSessions, callSignals, rooms, users } from "@/db/schema";
import {
  CLEANUP_BATCH,
  HEARTBEAT_EXPIRY_MS,
  JOIN_RATE_LIMIT,
  MeshError,
  SIGNAL_QUEUE_LIMIT,
  SIGNAL_RATE_LIMIT,
  SIGNAL_RETENTION_MS,
  SWEEP_BATCH,
  cleanupCallData,
  joinCall,
  leaveCall,
  pollCall,
  sendSignals,
  setMediaState,
  sweepStaleSessions,
} from "@/lib/call/mesh";
import { endRoom } from "@/lib/matching";
import type { WireSignal } from "@/lib/call/signal-protocol";

const PREFIX = "witness_mesh_";
let a: number, b: number, o: number;
let room: string;

async function makeUser(tag: string) {
  const clerkId = `${PREFIX}${tag}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const [row] = await db
    .insert(users)
    .values({ clerkId, email: `${clerkId}@witness.local`, firstName: "Mesh", lastName: tag, onboardingComplete: true })
    .returning({ id: users.id });
  return row.id;
}
async function makeRoom(u1: number, u2: number) {
  const [row] = await db.insert(rooms).values({ queueType: "casual", status: "active", user1Id: u1, user2Id: u2 }).returning({ id: rooms.id });
  return row.id;
}
const sid = (tag: string) => `${tag}-${Math.random().toString(36).slice(2, 10)}`;
const offer: WireSignal = { kind: "description", type: "offer", sdp: "v=0 offer" };
const cand = (i: number): WireSignal => ({ kind: "candidate", candidate: `candidate:${i} 1 udp 1 127.0.0.1 9 typ host`, sdpMid: "0", sdpMLineIndex: 0 });

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    if (error instanceof MeshError) return error.code;
    throw error;
  }
  return "no refusal";
}
async function sessionRow(roomId: string, sessionId: string) {
  const [row] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.sessionId, sessionId)));
  return row;
}

beforeEach(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
  a = await makeUser("a");
  b = await makeUser("b");
  o = await makeUser("outsider");
  room = await makeRoom(a, b);
});
afterAll(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
});

describe("only the room's two members get in", () => {
  it("an outsider is refused by every operation, and a missing room answers the same", async () => {
    const as = sid("a");
    await joinCall(a, room, as);
    const os = sid("o");
    expect(await refusal(joinCall(o, room, os))).toBe("FORBIDDEN");
    expect(await refusal(pollCall(o, room, as))).toBe("FORBIDDEN");
    expect(await refusal(sendSignals(o, room, os, [{ toSessionId: as, signal: offer }]))).toBe("FORBIDDEN");
    expect(await refusal(setMediaState(o, room, as, { micOn: false, cameraOn: false }))).toBe("FORBIDDEN");
    expect(await refusal(leaveCall(o, room, as))).toBe("FORBIDDEN");
    expect(await refusal(joinCall(a, "00000000-0000-4000-8000-000000000000", sid("x")))).toBe("FORBIDDEN");
    expect((await sessionRow(room, as)).state).toBe("open");
  });

  it("a member cannot use the other member's session", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    expect(await refusal(pollCall(b, room, as))).toBe("FORBIDDEN");
    expect(await refusal(sendSignals(b, room, as, [{ toSessionId: bs, signal: offer }]))).toBe("FORBIDDEN");
    expect(await refusal(leaveCall(b, room, as))).toBe("FORBIDDEN");
    expect(await refusal(setMediaState(b, room, as, { micOn: false, cameraOn: false }))).toBe("FORBIDDEN");
    expect(await refusal(joinCall(b, room, as))).toBe("FORBIDDEN");
    expect((await sessionRow(room, as)).state).toBe("open");
  });
});

describe("sessions", () => {
  it("joining again closes the person's older session as replaced; presence shows one per person", async () => {
    const a1 = sid("a1");
    const a2 = sid("a2");
    const bs = sid("b");
    await joinCall(a, room, a1);
    await joinCall(a, room, a2);
    await joinCall(b, room, bs);
    expect((await sessionRow(room, a1)).closedReason).toBe("replaced");
    const polled = await pollCall(b, room, bs);
    expect(polled.alive && polled.presence.map((p) => p.sessionId)).toEqual([a2]);
    expect(await pollCall(a, room, a1)).toEqual({ alive: false, reason: "replaced" });
  });

  it("a room never holds more than two open sessions", async () => {
    const now = new Date();
    await db.insert(callSessions).values([
      { roomId: room, sessionId: sid("a1"), userId: a, lastHeartbeatAt: now },
      { roomId: room, sessionId: sid("a2"), userId: a, lastHeartbeatAt: now },
    ]);
    expect(await refusal(joinCall(b, room, sid("b")))).toBe("CALL_FULL");
  });

  it("a session whose polls stop is closed as expired by the other person's next poll", async () => {
    const as = sid("a");
    const bs = sid("b");
    const t0 = new Date();
    await joinCall(a, room, as, t0);
    await joinCall(b, room, bs, t0);
    const later = new Date(t0.getTime() + HEARTBEAT_EXPIRY_MS + 1000);
    const polled = await pollCall(b, room, bs, [], new Date(t0.getTime() + 2000));
    expect(polled.alive && polled.presence).toHaveLength(1);
    await pollCall(b, room, bs, [], later);
    const after = await pollCall(b, room, bs, [], later);
    expect(after.alive && after.presence).toEqual([]);
    expect((await sessionRow(room, as)).closedReason).toBe("expired");
  });

  it("joins are limited per person per minute", async () => {
    const now = new Date();
    for (let i = 0; i < JOIN_RATE_LIMIT.maxRequests; i++) await joinCall(a, room, sid(`a${i}`), now);
    expect(await refusal(joinCall(a, room, sid("over"), now))).toBe("RATE_LIMITED");
    await joinCall(a, room, sid("later"), new Date(now.getTime() + JOIN_RATE_LIMIT.windowMs + 1000));
  });

  it("rejects a malformed session id", async () => {
    await expect(joinCall(a, room, "short")).rejects.toThrow(/sessionId/);
    await expect(joinCall(a, room, "x".repeat(65))).rejects.toThrow(/sessionId/);
  });

  it("mic and camera state reach the other person's presence", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    await setMediaState(a, room, as, { micOn: false, cameraOn: true });
    const polled = await pollCall(b, room, bs);
    expect(polled.alive && polled.presence[0]).toMatchObject({ participantId: String(a), micOn: false, cameraOn: true });
  });
});

describe("signals are addressed to a session", () => {
  it("a signal reaches the target session once, in order, and is gone after the ack", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    const sent = await sendSignals(a, room, as, [
      { toSessionId: bs, signal: offer },
      { toSessionId: bs, signal: cand(1) },
    ]);
    expect(sent.delivered).toEqual([true, true]);
    const first = await pollCall(b, room, bs);
    if (!first.alive) throw new Error("not alive");
    expect(first.signals.map((s) => s.signal.kind)).toEqual(["description", "candidate"]);
    expect(first.signals.every((s) => s.fromSessionId === as && s.fromParticipantId === String(a))).toBe(true);
    const second = await pollCall(b, room, bs, first.signals.map((s) => s.id));
    expect(second.alive && second.signals).toEqual([]);
  });

  it("nothing is stored for a session that is not open, or for oneself", async () => {
    const as = sid("a");
    const oldB = sid("b-old");
    const newB = sid("b-new");
    await joinCall(a, room, as);
    await joinCall(b, room, oldB);
    await joinCall(b, room, newB);
    const sent = await sendSignals(a, room, as, [
      { toSessionId: oldB, signal: offer },
      { toSessionId: "never-joined-01", signal: offer },
      { toSessionId: as, signal: offer },
    ]);
    expect(sent.delivered).toEqual([false, false, false]);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(callSignals).where(eq(callSignals.roomId, room));
    expect(n).toBe(0);
  });

  it("a same-named session in another room never sees this room's signals, and acks cannot cross rooms", async () => {
    const c = await makeUser("c");
    const room2 = await makeRoom(a, c);
    const shared = sid("shared");
    const as = sid("a");
    await joinCall(a, room, as);
    await joinCall(b, room, shared);
    await joinCall(c, room2, shared);
    await sendSignals(a, room, as, [{ toSessionId: shared, signal: offer }]);
    const other = await pollCall(c, room2, shared);
    expect(other.alive && other.signals).toEqual([]);
    const mine = await pollCall(b, room, shared);
    const ids = mine.alive ? mine.signals.map((s) => s.id) : [];
    expect(ids).toHaveLength(1);
    await pollCall(c, room2, shared, ids);
    const again = await pollCall(b, room, shared);
    expect(again.alive && again.signals.map((s) => s.id)).toEqual(ids);
  });

  it("refuses oversized fields", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    const big = (n: number) => "x".repeat(n);
    for (const signal of [
      { kind: "description", type: "offer", sdp: big(32_769) },
      { kind: "candidate", candidate: big(1_025) },
      { kind: "candidate", candidate: "c", sdpMid: big(65) },
      { kind: "candidate", candidate: "c", usernameFragment: big(257) },
    ] as WireSignal[]) {
      expect(await refusal(sendSignals(a, room, as, [{ toSessionId: bs, signal }]))).toBe("VALIDATION");
    }
  });

  it(`allows ${SIGNAL_RATE_LIMIT.maxRequests} signals per session per window, then refuses until the window passes`, async () => {
    const as = sid("a");
    const bs = sid("b");
    const t0 = new Date();
    await joinCall(a, room, as, t0);
    await joinCall(b, room, bs, t0);
    for (let sent = 0; sent < SIGNAL_RATE_LIMIT.maxRequests; sent += 20) {
      // Acks between batches keep the recipient's queue from filling first.
      await sendSignals(a, room, as, Array.from({ length: 20 }, (_, i) => ({ toSessionId: bs, signal: cand(sent + i) })), t0);
      const polled = await pollCall(b, room, bs, [], t0);
      if (polled.alive) await pollCall(b, room, bs, polled.signals.map((s) => s.id), t0);
    }
    expect(await refusal(sendSignals(a, room, as, [{ toSessionId: bs, signal: cand(999) }], t0))).toBe("RATE_LIMITED");
    // Both keep polling, so neither expires while the window runs out.
    const mid = new Date(t0.getTime() + SIGNAL_RATE_LIMIT.windowMs / 2);
    await pollCall(a, room, as, [], mid);
    await pollCall(b, room, bs, [], mid);
    const later = new Date(t0.getTime() + SIGNAL_RATE_LIMIT.windowMs + 1);
    expect((await sendSignals(a, room, as, [{ toSessionId: bs, signal: cand(1000) }], later)).delivered).toEqual([true]);
  });

  it(`refuses a send to a session with ${SIGNAL_QUEUE_LIMIT} unread signals`, async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    for (let i = 0; i < SIGNAL_QUEUE_LIMIT; i += 20) {
      await sendSignals(a, room, as, Array.from({ length: 20 }, (_, j) => ({ toSessionId: bs, signal: cand(i + j) })));
    }
    expect(await refusal(sendSignals(a, room, as, [{ toSessionId: bs, signal: cand(500) }]))).toBe("SIGNAL_QUEUE_FULL");
    const polled = await pollCall(b, room, bs);
    expect(polled.alive && polled.signals).toHaveLength(SIGNAL_QUEUE_LIMIT);
  });
});

describe("leaving and ending", () => {
  it("leaving closes the session as left and drops its unread signals", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    await sendSignals(a, room, as, [{ toSessionId: bs, signal: offer }]);
    await leaveCall(b, room, bs);
    expect((await sessionRow(room, bs)).closedReason).toBe("left");
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(callSignals)
      .where(and(eq(callSignals.toSessionId, bs), eq(callSignals.processed, false)));
    expect(n).toBe(0);
    expect(await pollCall(b, room, bs)).toEqual({ alive: false, reason: "left" });
  });

  it("ending the room closes its sessions as ended and refuses joins and sends", async () => {
    const as = sid("a");
    const bs = sid("b");
    await joinCall(a, room, as);
    await joinCall(b, room, bs);
    await endRoom(room);
    expect((await sessionRow(room, as)).closedReason).toBe("ended");
    expect(await pollCall(a, room, as)).toEqual({ alive: false, reason: "ended" });
    expect(await refusal(sendSignals(a, room, as, [{ toSessionId: bs, signal: offer }]))).toBe("ROOM_ENDED");
    expect(await refusal(joinCall(a, room, sid("again")))).toBe("ROOM_ENDED");
  });

  it("a poll in a room ended behind the mesh's back closes the session as ended", async () => {
    const as = sid("a");
    await joinCall(a, room, as);
    await db.update(rooms).set({ status: "ended" }).where(eq(rooms.id, room));
    expect(await pollCall(a, room, as)).toEqual({ alive: false, reason: "ended" });
    expect((await sessionRow(room, as)).closedReason).toBe("ended");
  });
});

describe("housekeeping is bounded", () => {
  it(`the stale-session sweep closes ${SWEEP_BATCH} per run and says when more are left`, async () => {
    // Close whatever stale sessions other runs left, so the counts are this test's.
    while ((await sweepStaleSessions()).more);
    const old = new Date(Date.now() - HEARTBEAT_EXPIRY_MS * 10);
    await db.insert(callSessions).values(
      Array.from({ length: SWEEP_BATCH + 1 }, (_, i) => ({ roomId: room, sessionId: `stale-${i}-xxxxx`, userId: a, lastHeartbeatAt: old })),
    );
    expect(await sweepStaleSessions()).toEqual({ closed: SWEEP_BATCH, more: true });
    expect(await sweepStaleSessions()).toEqual({ closed: 1, more: false });
  });

  it(`cleanup deletes ${CLEANUP_BATCH} old read signals per run and keeps recent or unread ones`, async () => {
    while ((await cleanupCallData()).more);
    const old = new Date(Date.now() - SIGNAL_RETENTION_MS - 60_000);
    const row = { roomId: room, fromSessionId: "from-xxxxxxxx", fromUserId: a, toSessionId: "to-xxxxxxxxxx", payload: offer };
    await db.insert(callSignals).values(Array.from({ length: CLEANUP_BATCH + 1 }, () => ({ ...row, processed: true, createdAt: old })));
    await db.insert(callSignals).values([
      { ...row, processed: false, createdAt: old },
      { ...row, processed: true, createdAt: new Date() },
    ]);
    const first = await cleanupCallData();
    expect(first.signals).toBe(CLEANUP_BATCH);
    expect(first.more).toBe(true);
    const second = await cleanupCallData();
    expect(second.signals).toBe(1);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(callSignals).where(eq(callSignals.roomId, room));
    expect(n).toBe(2);
  });
});
