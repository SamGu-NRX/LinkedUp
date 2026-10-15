/**
 * Real-database witnesses for the after-call summary (the scripts/dev-up.mjs
 * stack, not a mock).
 *
 * The post-call path promises four things; each is witnessed against the
 * project Postgres:
 *   - COMPLETED: Done persists one summary row per participant, with the
 *     duration the two people were ACTUALLY connected (from the later of the
 *     two first joins to the room's end — queue waiting is not call time, a
 *     reload's second session does not reset it);
 *   - ENDED: ending twice (both sides press Done) never duplicates rows, the
 *     recap still reads after the room is ended, and a room that ended with
 *     no Done says summary_missing instead of inventing a recap;
 *   - UNAUTHORIZED: a signed-in outsider (and an unknown user, and a missing
 *     room) is refused without learning whether the room exists;
 *   - RELOAD: history reads the persisted rows fresh from the database, so a
 *     later session loads the same record.
 *
 * Rows are synthetic and cleaned up in afterAll (cascades remove rooms,
 * sessions and summaries with the users).
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Pins DATABASE_URL to the dev-up stack's database and refuses any other.
import "./support/use-stack-db";

// Dynamic imports: @/db must evaluate only after DATABASE_URL is pinned.
const {
  persistCallSummaries,
  getCallSummaryForUser,
  listCallSummaries,
  formatCallDuration,
} = await import("@/lib/call/summary");
const { db } = await import("@/db");
const { users, rooms, callSessions } = await import("@/db/schema");

const RUN_ID = `r4summ${Date.now().toString(36)}`;
const CLERK_IDS = {
  a: `clerk_r4summ-a-${RUN_ID}`,
  b: `clerk_r4summ-b-${RUN_ID}`,
  c: `clerk_r4summ-c-${RUN_ID}`,
};

let userA: {
  id: number;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
};
let userB: {
  id: number;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
};
let userC: { id: number; clerkId: string };
/** The call room: matched at t0, A joins at +60, B joins at +120 and reloads at +180, ends at +240. */
let room: { id: string };
const T0 = new Date("2026-10-15T12:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

beforeAll(async () => {
  const inserted = await db
    .insert(users)
    .values([
      {
        clerkId: CLERK_IDS.a,
        email: `synthetic-r4summ-${RUN_ID}-a@example.com`,
        firstName: "Ada",
        lastName: "Caller",
      },
      {
        clerkId: CLERK_IDS.b,
        email: `synthetic-r4summ-${RUN_ID}-b@example.com`,
        firstName: "Ben",
        lastName: "Peer",
      },
      {
        clerkId: CLERK_IDS.c,
        email: `synthetic-r4summ-${RUN_ID}-c@example.com`,
        firstName: "Cleo",
        lastName: "Outsider",
      },
    ])
    .returning({
      id: users.id,
      clerkId: users.clerkId,
      firstName: users.firstName,
      lastName: users.lastName,
    });
  userA = inserted[0];
  userB = inserted[1];
  userC = inserted[2];

  const insertedRoom = await db
    .insert(rooms)
    .values({
      queueType: "casual",
      status: "active",
      user1Id: userA.id,
      user2Id: userB.id,
      createdAt: T0,
    })
    .returning({ id: rooms.id });
  room = insertedRoom[0];

  // The real sessions a connected call writes: first joins, then B's reload.
  await db.insert(callSessions).values([
    {
      roomId: room.id,
      sessionId: `sess-a-${RUN_ID}`,
      userId: userA.id,
      createdAt: at(60),
    },
    {
      roomId: room.id,
      sessionId: `sess-b-${RUN_ID}`,
      userId: userB.id,
      createdAt: at(120),
    },
    {
      roomId: room.id,
      sessionId: `sess-b2-${RUN_ID}`,
      userId: userB.id,
      createdAt: at(180),
    },
  ]);
});

afterAll(async () => {
  await db
    .delete(users)
    .where(inArray(users.clerkId, Object.values(CLERK_IDS)));
});

describe("post-call summary (real database)", () => {
  it("formatCallDuration renders human durations", () => {
    expect(formatCallDuration(0)).toBe("0s");
    expect(formatCallDuration(45)).toBe("45s");
    expect(formatCallDuration(120)).toBe("2 min");
    expect(formatCallDuration(150)).toBe("2 min 30s");
  });

  it("COMPLETED: persists both rows with the truly-connected duration", async () => {
    // End the room the way Done does, then persist the way endRoomAction does.
    await db
      .update(rooms)
      .set({ status: "ended", endedAt: at(240) })
      .where(eq(rooms.id, room.id));
    const persisted = await persistCallSummaries(room.id, {
      now: at(240),
      ratingFor: userA.id,
      rating: 4,
    });
    expect(persisted).toBe(true);

    const forA = await getCallSummaryForUser(userA.clerkId, room.id);
    expect(forA.allowed).toBe(true);
    if (!forA.allowed) return;
    // Connected = max(A first join +60, B first join +120) → 240-120 = 120s.
    // B's reload session (+180) does not move the start; the wait before B
    // joined is not call time.
    expect(forA.summary.durationSeconds).toBe(120);
    expect(forA.summary.peerId).toBe(userB.id);
    expect(forA.summary.peerName).toBe("Ben Peer");
    expect(forA.summary.queueType).toBe("casual");
    expect(forA.summary.startedAt.toISOString()).toBe(at(120).toISOString());
    expect(forA.summary.endedAt.toISOString()).toBe(at(240).toISOString());
    expect(forA.summary.rating).toBe(4);

    // Each participant sees THEIR summary: B's peer is A, not B.
    const forB = await getCallSummaryForUser(userB.clerkId, room.id);
    expect(forB.allowed).toBe(true);
    if (!forB.allowed) return;
    expect(forB.summary.peerId).toBe(userA.id);
    expect(forB.summary.peerName).toBe("Ada Caller");
    expect(forB.summary.durationSeconds).toBe(120);
    expect(forB.summary.rating).toBeNull();
  });

  it("ENDED: both sides' Done writes once, ratings stick, the recap still reads", async () => {
    // B presses Done after the room already ended (their screen shows the
    // problem panel), rating 5. No duplicate rows; B's rating lands.
    const persisted = await persistCallSummaries(room.id, {
      now: at(245),
      ratingFor: userB.id,
      rating: 5,
    });
    expect(persisted).toBe(true);

    const rows = await db.query.callSummaries.findMany({
      where: (t, { eq }) => eq(t.roomId, room.id),
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === userA.id)?.rating).toBe(4);
    expect(rows.find((r) => r.userId === userB.id)?.rating).toBe(5);

    // A re-Dones with a new rating: the first rating given on the real call wins.
    await persistCallSummaries(room.id, {
      now: at(246),
      ratingFor: userA.id,
      rating: 2,
    });
    const [aRow] = await db.query.callSummaries.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.roomId, room.id), eq(t.userId, userA.id)),
    });
    expect(aRow?.rating).toBe(4);

    // The recap reads after the room is long ended.
    const forA = await getCallSummaryForUser(userA.clerkId, room.id);
    expect(forA.allowed).toBe(true);
  });

  it("UNAUTHORIZED: an outsider, an unknown user and a missing room learn nothing", async () => {
    // C is signed in and real, but was never in this room.
    const outsider = await getCallSummaryForUser(userC.clerkId, room.id);
    expect(outsider).toEqual({ allowed: false, reason: "not_a_participant" });

    // An unknown Clerk id, and a room id that does not exist: same refusal,
    // so a stranger cannot probe which rooms exist.
    const unknown = await getCallSummaryForUser(
      `clerk_nobody-${RUN_ID}`,
      room.id,
    );
    expect(unknown).toEqual({ allowed: false, reason: "not_a_participant" });
    const missing = await getCallSummaryForUser(
      userA.clerkId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(missing).toEqual({ allowed: false, reason: "not_a_participant" });
  });

  it("RELOAD: history reads the persisted rows fresh from the database", async () => {
    // A brand-new read (no cached state): the later-session view of history.
    const history = await listCallSummaries(userA.id);
    const mine = history.find((row) => row.roomId === room.id);
    expect(mine, "the finished call is in A's history").toBeDefined();
    expect(mine?.peerName).toBe("Ben Peer");
    expect(mine?.durationSeconds).toBe(120);
    expect(mine?.rating).toBe(4);

    // B's history holds B's row, not A's.
    const historyB = await listCallSummaries(userB.id);
    expect(historyB.map((row) => row.roomId)).toContain(room.id);
    expect(historyB.find((row) => row.roomId === room.id)?.peerId).toBe(
      userA.id,
    );

    // C's history is empty: other people's calls never leak in.
    expect(await listCallSummaries(userC.id)).toEqual([]);
  });

  it("a room that ended with no Done reports summary_missing instead of inventing a recap", async () => {
    // A declined match: a room that ends without anyone pressing Done.
    const declined = await db
      .insert(rooms)
      .values({
        queueType: "professional",
        status: "ended",
        user1Id: userA.id,
        user2Id: userB.id,
        createdAt: at(300),
        endedAt: at(310),
      })
      .returning({ id: rooms.id });

    const access = await getCallSummaryForUser(userA.clerkId, declined[0].id);
    expect(access).toEqual({ allowed: false, reason: "summary_missing" });

    // persisting it anyway records an honest zero: nobody ever connected.
    await persistCallSummaries(declined[0].id, { now: at(310) });
    const after = await getCallSummaryForUser(userA.clerkId, declined[0].id);
    expect(after.allowed).toBe(true);
    if (after.allowed) expect(after.summary.durationSeconds).toBe(0);
  });

  it("a room unknown to the database persists nothing", async () => {
    expect(
      await persistCallSummaries("00000000-0000-0000-0000-000000000000"),
    ).toBe(false);
  });
});
