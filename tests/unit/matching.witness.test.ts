// @vitest-environment node
// tests/unit/matching.witness.test.ts — Postgres witness tests for the
// transactional queue (CALL-PLAN.md, J eval cases). Every test in this file
// runs against the REAL local Postgres (DATABASE_URL → this thread's own
// instance on 127.0.0.1:54331). No database mocks anywhere.
//
// Witness users are synthetic rows with clerk ids prefixed `witness_`; each
// run cleans its own rows through the users cascade (rooms and queue
// entries reference users with onDelete cascade / set null).

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/db";
import { queueEntries, rooms, users } from "@/db/schema";
import {
  STALE_ENTRY_MS,
  getRoomForUser,
  pairWaitingUsersNaive,
  queueCancel,
  queueJoin,
  queueStateForUser,
  type QueueStateForUser,
} from "@/lib/matching";

const WITNESS_PREFIX = "witness_pair_%";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Insert a synthetic user row and return its db id. */
async function makeUser(tag: string): Promise<{ id: number; clerkId: string }> {
  const clerkId = `witness_pair_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const [row] = await db
    .insert(users)
    .values({ clerkId, email: `${clerkId}@witness.local`, firstName: "Witness", lastName: tag })
    .returning({ id: users.id });
  return { id: row.id, clerkId };
}

async function deleteWitnessRows(): Promise<void> {
  await db.execute(sql`DELETE FROM users WHERE clerk_id LIKE ${WITNESS_PREFIX}`);
}

/** Rooms that mention any of the given user ids. */
async function roomsFor(userIds: number[]) {
  return db
    .select()
    .from(rooms)
    .where(or(inArray(rooms.user1Id, userIds), inArray(rooms.user2Id, userIds)));
}

/** The live (waiting/matched) queue entries for a user. */
async function liveEntriesFor(userId: number) {
  return db
    .select()
    .from(queueEntries)
    .where(and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])));
}

/**
 * Poll the user's queue state until they leave `waiting` (matched or idle),
 * mirroring what the real queue engine does every 2 s. Returns the final
 * state. Timeout fails the enclosing assertion via a thrown Error.
 */
async function settleState(
  userId: number,
  { budgetMs = 5_000 }: { budgetMs?: number } = {},
): Promise<QueueStateForUser> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const state = await queueStateForUser(userId);
    if (state.status !== "waiting") return state;
    if (Date.now() > deadline) return state;
    await sleep(40);
  }
}

beforeAll(async () => {
  await deleteWitnessRows();
});

// Each test starts from an empty witness namespace — leftover live entries
// from one test must never be pairable with the next test's users.
afterEach(async () => {
  await deleteWitnessRows();
});

afterAll(async () => {
  await deleteWitnessRows();
  await db.execute(sql`SELECT 1`);
});

describe("J-case: both queue at once (concurrency)", () => {
  it("two simultaneous queue entries form exactly one pair, every time", async () => {
    for (let round = 0; round < 25; round += 1) {
      const a = await makeUser(`conc${round}_a`);
      const b = await makeUser(`conc${round}_b`);
      const ids = [a.id, b.id];

      // Drive the two joins CONCURRENTLY — separate pool connections, so the
      // pairing transactions genuinely race on the same rows.
      await Promise.all([
        queueJoin({ userId: a.id, queueType: "casual" }),
        queueJoin({ userId: b.id, queueType: "casual" }),
      ]);

      // Settle like the real clients: each side keeps polling its state.
      const [sa, sb] = await Promise.all([
        settleState(a.id, { budgetMs: 5_000 }),
        settleState(b.id, { budgetMs: 5_000 }),
      ]);
      expect(sa.status, `round ${round}: user a state`).toBe("matched");
      expect(sb.status, `round ${round}: user b state`).toBe("matched");
      if (sa.status === "matched" && sb.status === "matched") {
        expect(sa.roomId, `round ${round}: same room`).toBe(sb.roomId);
      }

      // Exactly one room, and it holds exactly these two users.
      const roomRows = await roomsFor(ids);
      expect(roomRows, `round ${round}: exactly one room`).toHaveLength(1);
      const room = roomRows[0];
      expect(new Set([room.user1Id, room.user2Id])).toEqual(new Set(ids));
      expect(room.user1Id, "no self-pairing").not.toBe(room.user2Id);
      expect(room.status).toBe("active");

      // No partial rows: both entries are matched into that room, nothing else.
      for (const id of ids) {
        const live = await liveEntriesFor(id);
        expect(live, `round ${round}: one live entry for ${id}`).toHaveLength(1);
        expect(live[0].status).toBe("matched");
        expect(live[0].roomId).toBe(room.id);
      }
    }
  }, 120_000);

  it("100 simultaneous joins form exactly 50 disjoint pairs with no partial rows", async () => {
    const N = 100;
    const people = await Promise.all(
      Array.from({ length: N }, (_, i) => makeUser(`hundred${i}`)),
    );

    await Promise.all(
      people.map((p) => queueJoin({ userId: p.id, queueType: "casual" })),
    );
    // Every client settles its own state; the queue self-heals stragglers.
    const states = await Promise.all(
      people.map((p) => settleState(p.id, { budgetMs: 30_000 })),
    );
    states.forEach((s, i) => {
      expect(s.status, `user ${i} matched`).toBe("matched");
    });

    const ids = people.map((p) => p.id);
    const roomRows = await roomsFor(ids);
    expect(roomRows, "exactly N/2 rooms").toHaveLength(N / 2);

    // Every user sits in exactly one room; no room shares a user with another.
    const seen = new Map<number, string>();
    for (const room of roomRows) {
      expect(room.status).toBe("active");
      expect(room.user1Id).not.toBe(room.user2Id);
      for (const uid of [room.user1Id, room.user2Id]) {
        expect(seen.has(uid), `user ${uid} in two rooms`).toBe(false);
        seen.set(uid, room.id);
      }
    }
    for (const p of people) {
      expect(seen.has(p.id), `user ${p.id} paired`).toBe(true);
      const live = await liveEntriesFor(p.id);
      expect(live, `one live entry for ${p.id}`).toHaveLength(1);
      expect(live[0].status).toBe("matched");
      expect(live[0].roomId).toBe(seen.get(p.id));
    }
  }, 240_000);

  it("witness: the same interleaving without the transaction double-pairs users", async () => {
    // Deterministic demo that the invariants above bite when the pairing
    // transaction is removed: two raw connections both read the two waiting
    // entries WITHOUT locks (the naive path), then both blindly write.
    const a = await makeUser("naive_a");
    const b = await makeUser("naive_b");
    await db.insert(queueEntries).values([
      { userId: a.id, queueType: "casual", status: "waiting" },
      { userId: b.id, queueType: "casual", status: "waiting" },
    ]);

    const url = process.env.DATABASE_URL as string;
    const c1 = postgres(url, { max: 1, idle_timeout: 1 });
    const c2 = postgres(url, { max: 1, idle_timeout: 1 });
    try {
      const pick = (conn: postgres.Sql) =>
        conn`SELECT id, user_id FROM queue_entries
             WHERE queue_type = 'casual' AND status = 'waiting'
             ORDER BY joined_at ASC, id ASC LIMIT 2`;
      const r1 = await pick(c1);
      const r2 = await pick(c2);
      expect(r1.length).toBe(2);
      expect(r2.length).toBe(2);
      const u1 = r1[0].user_id as number;
      const u2 = r1[1].user_id as number;
      const e1 = r1[0].id as number;
      const e2 = r1[1].id as number;

      // Both connections saw the same two entries — each now "pairs" them.
      for (const conn of [c1, c2]) {
        const [room] = await conn`INSERT INTO rooms (queue_type, status, user1_id, user2_id)
          VALUES ('casual', 'active', ${u1}, ${u2}) RETURNING id`;
        await conn`UPDATE queue_entries SET status = 'matched', room_id = ${room.id}
          WHERE id IN (${e1}, ${e2})`;
      }

      // The invariant the transactional test asserts is violated: two rooms
      // share the same two users.
      const roomRows = await roomsFor([a.id, b.id]);
      expect(roomRows.length, "double-pairing without the transaction").toBeGreaterThan(1);
    } finally {
      await c1.end({ timeout: 1 });
      await c2.end({ timeout: 1 });
    }
  }, 60_000);
});

describe("J-case: one cancels", () => {
  it("a user cancelling while queued leaves no matchable row", async () => {
    const a = await makeUser("cancel_a");
    const b = await makeUser("cancel_b");

    await queueJoin({ userId: a.id, queueType: "casual" });
    await queueCancel(a.id);

    // B joins afterwards; pairing attempts (join-time and read-path) must
    // never resurrect the cancelled user.
    const joinB = await queueJoin({ userId: b.id, queueType: "casual" });
    expect(joinB.status).toBe("waiting");
    const stateB = await settleState(b.id, { budgetMs: 2_000 });
    expect(stateB.status).toBe("waiting");

    // Even a direct pairing attempt finds nothing to pair with B — and never
    // touches A's exited row.
    const paired = await pairWaitingUsersNaive("casual", new Date());
    if (paired) {
      expect([paired.winnerId, paired.loserId]).not.toContain(a.id);
    }

    // A's latest entry is terminal (exited), not matchable.
    const aEntries = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.userId, a.id))
      .orderBy(desc(queueEntries.id));
    expect(aEntries.length).toBeGreaterThan(0);
    expect(aEntries[0].status).toBe("exited");

    // No room ever mentioned A.
    const aRooms = await roomsFor([a.id]);
    expect(aRooms).toHaveLength(0);
  }, 60_000);
});

describe("J-case: staleness", () => {
  it("an entry that ages past the timeout expires and is never paired afterward", async () => {
    const a = await makeUser("stale_a");
    const b = await makeUser("stale_b");

    // A's entry is already older than the stale window when it appears.
    await db.insert(queueEntries).values({
      userId: a.id,
      queueType: "casual",
      status: "waiting",
      joinedAt: new Date(Date.now() - (STALE_ENTRY_MS + 60_000)),
    });

    // B joining runs the lazy expiry first, then pairing.
    const joinB = await queueJoin({ userId: b.id, queueType: "casual" });
    expect(joinB.status).toBe("waiting");

    // A's entry was expired, not matched.
    const aEntries = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.userId, a.id));
    expect(aEntries).toHaveLength(1);
    expect(aEntries[0].status).toBe("expired");

    // Forcing pairing still never pairs the stale entry: B waits alone.
    const forced = await pairWaitingUsersNaive("casual", new Date());
    if (forced) {
      expect([forced.winnerId, forced.loserId]).not.toContain(a.id);
    }
    const aRooms = await roomsFor([a.id]);
    expect(aRooms).toHaveLength(0);

    // ...and A's row can never become matchable again: it is terminal.
    const live = await liveEntriesFor(a.id);
    expect(live).toHaveLength(0);
  }, 60_000);
});

describe("J-case: three users", () => {
  it("exactly one pair forms; the third keeps waiting and remains matchable", async () => {
    const a = await makeUser("three_a");
    const b = await makeUser("three_b");
    const c = await makeUser("three_c");

    await queueJoin({ userId: a.id, queueType: "casual" });
    await queueJoin({ userId: b.id, queueType: "casual" });
    const [sa, sb] = await Promise.all([
      settleState(a.id, { budgetMs: 5_000 }),
      settleState(b.id, { budgetMs: 5_000 }),
    ]);
    expect(sa.status).toBe("matched");
    expect(sb.status).toBe("matched");

    // The third user joins an occupied queue: exactly one pair exists and C
    // keeps waiting.
    const joinC = await queueJoin({ userId: c.id, queueType: "casual" });
    expect(joinC.status).toBe("waiting");
    const roomsABC = await roomsFor([a.id, b.id, c.id]);
    expect(roomsABC).toHaveLength(1);
    const stateC = await settleState(c.id, { budgetMs: 2_000 });
    expect(stateC.status).toBe("waiting");

    // C remains matchable: a fourth user pairs with C, not with A or B.
    const d = await makeUser("three_d");
    await queueJoin({ userId: d.id, queueType: "casual" });
    const [sc, sd] = await Promise.all([
      settleState(c.id, { budgetMs: 5_000 }),
      settleState(d.id, { budgetMs: 5_000 }),
    ]);
    expect(sc.status).toBe("matched");
    expect(sd.status).toBe("matched");
    if (sc.status === "matched" && sd.status === "matched") {
      expect(sc.roomId).toBe(sd.roomId);
    }
    const roomsFinal = await roomsFor([a.id, b.id, c.id, d.id]);
    expect(roomsFinal).toHaveLength(2);
    const pairSets = roomsFinal.map((r) => new Set([r.user1Id, r.user2Id]));
    expect(pairSets.some((set) => set.has(a.id) && set.has(c.id))).toBe(false);
  }, 120_000);
});

describe("professional queue pairing contract", () => {
  it("a professional match routes to a persisted room both members can enter", async () => {
    const a = await makeUser("prof_a");
    const b = await makeUser("prof_b");

    await queueJoin({ userId: a.id, queueType: "professional" });
    await queueJoin({ userId: b.id, queueType: "professional" });
    const [sa, sb] = await Promise.all([
      settleState(a.id, { budgetMs: 5_000 }),
      settleState(b.id, { budgetMs: 5_000 }),
    ]);
    expect(sa.status).toBe("matched");
    expect(sb.status).toBe("matched");
    if (sa.status !== "matched" || sb.status !== "matched") return;

    // The id the client is routed to must be a real, server-enforced room.
    const access = await getRoomForUser(a.clerkId, sa.roomId);
    expect(access.allowed).toBe(true);
    if (access.allowed) {
      expect(access.partner.id).toBe(b.id);
      expect(access.roomId).toBe(sa.roomId);
    }
    const accessB = await getRoomForUser(b.clerkId, sa.roomId);
    expect(accessB.allowed).toBe(true);
  }, 60_000);
});
