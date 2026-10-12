// @vitest-environment node
// Witnesses for the security review of alpha 584acc5 (src/lib/call/mesh.ts).
// Each fails against 584acc5. They run on the stack's Postgres; the
// concurrency cases use real parallel transactions on separate connections.
import "./support/use-stack-db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { rooms, users } from "@/db/schema";
import {
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
