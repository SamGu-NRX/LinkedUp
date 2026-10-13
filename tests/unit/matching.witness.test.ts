// @vitest-environment node
// tests/unit/matching.witness.test.ts — Postgres witness tests for the
// transactional queue (CALL-PLAN.md, J eval cases). Every test in this file
// runs against the REAL project Postgres that `pnpm dev:up` runs
// (127.0.0.1:54329, pinned and checked by ./support/use-stack-db). No
// database mocks anywhere.
//
// Witness users are synthetic rows with clerk ids prefixed `witness_pair_`;
// each test cleans its own rows through the users cascade (rooms and queue
// entries reference users with onDelete cascade / set null).

import "./support/use-stack-db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, inArray, notLike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { queueEntries, rooms, users } from "@/db/schema";
import {
  STALE_ENTRY_MS,
  endRoom,
  expireStaleQueueEntries,
  getRoomForUser,
  pairWaitingUsersTransactional,
  pairWaitingUsersWith,
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
  // Pairing takes the oldest waiting entries of a type, whoever owns them.
  // A live entry left by someone else (a journey run, a dev session) would
  // pair with these witnesses and make every count below wrong, so refuse
  // to start instead of guessing.
  const foreign = await db
    .select({ id: queueEntries.id, clerkId: users.clerkId })
    .from(queueEntries)
    .innerJoin(users, eq(users.id, queueEntries.userId))
    .where(and(inArray(queueEntries.status, ["waiting", "matched"]), notLike(users.clerkId, WITNESS_PREFIX)));
  if (foreign.length > 0) {
    throw new Error(
      `matching witnesses need a queue with no other live entries; found ${foreign.length} ` +
        `(clerk ids ${foreign.map((f) => f.clerkId).join(", ")}). Stop the other run or let them expire.`,
    );
  }
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

  // The pairing body forced through one interleaving: the first pairing
  // claims (SELECT ... FOR UPDATE SKIP LOCKED), then the second claims, and
  // only then does either write. Run once inside the production transaction
  // and once with the transaction removed; only the transaction separates a
  // single pair from a double one.
  type Exec = Parameters<typeof pairWaitingUsersWith>[0];
  function around(exec: Exec, before: () => Promise<void>, after: () => Promise<void>): Exec {
    const execute = (async (query: Parameters<Exec["execute"]>[0]) => {
      await before();
      const claimed = await exec.execute(query);
      await after();
      return claimed;
    }) as Exec["execute"];
    return { execute, insert: exec.insert.bind(exec), update: exec.update.bind(exec) } as Exec;
  }
  function claimSequence() {
    let firstClaimed!: () => void;
    let secondClaimed!: () => void;
    const first = new Promise<void>((resolve) => {
      firstClaimed = resolve;
    });
    const second = new Promise<void>((resolve) => {
      secondClaimed = resolve;
    });
    return {
      first: (exec: Exec) =>
        around(exec, async () => {}, async () => {
          firstClaimed();
          await second;
        }),
      second: (exec: Exec) => around(exec, () => first, async () => secondClaimed()),
    };
  }
  async function twoWaiting(tag: string) {
    const a = await makeUser(`${tag}_a`);
    const b = await makeUser(`${tag}_b`);
    await db.insert(queueEntries).values([
      { userId: a.id, queueType: "casual", status: "waiting" },
      { userId: b.id, queueType: "casual", status: "waiting" },
    ]);
    return [a, b] as const;
  }

  it("the production pairing, two claims interleaved inside its transaction, forms one room", async () => {
    for (let round = 0; round < 10; round += 1) {
      const [a, b] = await twoWaiting(`tx${round}`);
      const seq = claimSequence();
      const results = await Promise.all([
        db.transaction((tx) => pairWaitingUsersWith(seq.first(tx), "casual")),
        db.transaction((tx) => pairWaitingUsersWith(seq.second(tx), "casual")),
      ]);
      expect(results.filter(Boolean), `round ${round}: one pairing claimed the pair`).toHaveLength(1);
      expect(await roomsFor([a.id, b.id]), `round ${round}: one room`).toHaveLength(1);
      await deleteWitnessRows();
    }
  }, 60_000);

  it("witness: the same body and interleaving with the transaction removed double-pairs", async () => {
    const [a, b] = await twoWaiting("notx");
    // Without a transaction each statement commits alone, so the row locks
    // from FOR UPDATE end with the first SELECT and the second claim sees
    // both entries too.
    const seq = claimSequence();
    const results = await Promise.all([
      pairWaitingUsersWith(seq.first(db), "casual"),
      pairWaitingUsersWith(seq.second(db), "casual"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(2);
    expect((await roomsFor([a.id, b.id])).length, "double-pairing without the transaction").toBe(2);
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

    // Even a direct pairing attempt finds nothing to pair with B.
    expect(await pairWaitingUsersTransactional("casual", new Date())).toBeNull();

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

  async function matchedPair(tag: string) {
    const a = await makeUser(`${tag}_a`);
    const b = await makeUser(`${tag}_b`);
    await queueJoin({ userId: a.id, queueType: "casual" });
    await queueJoin({ userId: b.id, queueType: "casual" });
    const [sa, sb] = await Promise.all([settleState(a.id), settleState(b.id)]);
    expect(sa.status).toBe("matched");
    expect(sb.status).toBe("matched");
    return { a, b, roomId: (sa as Extract<QueueStateForUser, { status: "matched" }>).roomId };
  }

  it("declining an offered match releases it: the room ends and the partner waits again", async () => {
    const { a, b, roomId } = await matchedPair("decline");

    await queueCancel(a.id);

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status, "the offered room ends").toBe("ended");
    const [aLatest] = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.userId, a.id))
      .orderBy(desc(queueEntries.id));
    expect(aLatest.status).toBe("exited");
    const liveB = await liveEntriesFor(b.id);
    expect(liveB, "the partner has one live entry").toHaveLength(1);
    expect(liveB[0].status).toBe("waiting");
    expect(liveB[0].roomId).toBeNull();
    expect((await queueStateForUser(b.id)).status).toBe("waiting");
    expect((await getRoomForUser(b.clerkId, roomId)).allowed, "the released room admits nobody").toBe(false);

    // The partner is matchable again: the next person pairs with them.
    const c = await makeUser("decline_c");
    await queueJoin({ userId: c.id, queueType: "casual" });
    const [sb, sc] = await Promise.all([settleState(b.id), settleState(c.id)]);
    expect(sb.status).toBe("matched");
    expect(sc.status).toBe("matched");
    if (sb.status === "matched" && sc.status === "matched") expect(sb.roomId).toBe(sc.roomId);
    expect(await roomsFor([a.id]), "A is in no new room").toHaveLength(1);
  }, 60_000);

  it("both members declining at once: no deadlock, both leave, the room ends", async () => {
    for (let round = 0; round < 10; round += 1) {
      const { a, b, roomId } = await matchedPair(`bothdecline${round}`);
      await Promise.all([queueCancel(a.id), queueCancel(b.id)]);
      expect(await liveEntriesFor(a.id), `round ${round}: A left`).toHaveLength(0);
      expect(await liveEntriesFor(b.id), `round ${round}: B left`).toHaveLength(0);
      const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      expect(room?.status).toBe("ended");
      await deleteWitnessRows();
    }
  }, 120_000);
});

describe("J-case: liveness", () => {
  it("a waiting person who keeps polling is never expired, however long they wait", async () => {
    const a = await makeUser("patient_a");
    const longAgo = new Date(Date.now() - 10 * 60_000);
    await db.insert(queueEntries).values({
      userId: a.id,
      queueType: "casual",
      status: "waiting",
      joinedAt: longAgo,
      lastSeenAt: new Date(Date.now() - 2_000),
    });

    const state = await queueStateForUser(a.id);
    expect(state.status, "ten minutes in the queue, polled two seconds ago").toBe("waiting");
    const [row] = await liveEntriesFor(a.id);
    expect(Math.abs(row.lastSeenAt.getTime() - Date.now()), "the poll refreshed liveness").toBeLessThan(5_000);
    expect(row.joinedAt.getTime(), "the join time is kept for ordering and the wait clock").toBe(longAgo.getTime());
  }, 60_000);

  it("polling pushes expiry out: a sweep just after the old deadline keeps the entry", async () => {
    const a = await makeUser("poll_a");
    const seen = new Date(Date.now() - (STALE_ENTRY_MS - 1_000));
    await db.insert(queueEntries).values({
      userId: a.id,
      queueType: "casual",
      status: "waiting",
      joinedAt: seen,
      lastSeenAt: seen,
    });
    await queueStateForUser(a.id);
    await expireStaleQueueEntries(new Date(seen.getTime() + STALE_ENTRY_MS + 5_000));
    expect(await liveEntriesFor(a.id)).toHaveLength(1);
  }, 60_000);

  it("a person who stops polling expires once the window passes and is never paired afterward", async () => {
    const a = await makeUser("stale_a");
    const b = await makeUser("stale_b");

    // A joined a minute ago and has not polled for longer than the window.
    await db.insert(queueEntries).values({
      userId: a.id,
      queueType: "casual",
      status: "waiting",
      joinedAt: new Date(Date.now() - 60_000),
      lastSeenAt: new Date(Date.now() - (STALE_ENTRY_MS + 5_000)),
    });

    // B joining runs the lazy expiry first, then pairing.
    const joinB = await queueJoin({ userId: b.id, queueType: "casual" });
    expect(joinB.status).toBe("waiting");

    const aEntries = await db.select().from(queueEntries).where(eq(queueEntries.userId, a.id));
    expect(aEntries).toHaveLength(1);
    expect(aEntries[0].status).toBe("expired");

    // Forcing pairing still never pairs the stale entry: B waits alone.
    expect(await pairWaitingUsersTransactional("casual", new Date())).toBeNull();
    expect(await roomsFor([a.id])).toHaveLength(0);
    expect(await liveEntriesFor(a.id)).toHaveLength(0);
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

describe("ended rooms: re-joining after the call", () => {
  it("ending and declining the same room concurrently releases the caller without deadlocking", async () => {
    const a = await makeUser("enddecline_a");
    const b = await makeUser("enddecline_b");
    await queueJoin({ userId: a.id, queueType: "casual" });
    await queueJoin({ userId: b.id, queueType: "casual" });
    const matched = await queueStateForUser(a.id);
    expect(matched.status).toBe("matched");
    if (matched.status !== "matched") throw new Error("pair did not form");

    await Promise.all([endRoom(matched.roomId), queueCancel(a.id)]);

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, matched.roomId) });
    expect(room?.status).toBe("ended");
    expect(await queueStateForUser(a.id)).toEqual({ status: "idle" });
    const partner = await queueStateForUser(b.id);
    // Decline returns the partner to waiting if it wins; end releases both
    // if it wins. Neither ordering may leave a match to the ended room.
    expect(["idle", "waiting"]).toContain(partner.status);
  }, 60_000);

  it("a matched user whose room ended can re-join the queue (no matched-to-dead-room loop)", async () => {
    const a = await makeUser("endloop_a");
    const b = await makeUser("endloop_b");

    await queueJoin({ userId: a.id, queueType: "casual" });
    await queueJoin({ userId: b.id, queueType: "casual" });
    const sa = (await settleState(a.id, { budgetMs: 5_000 })) as Extract<
      Awaited<ReturnType<typeof queueStateForUser>>,
      { status: "matched" }
    >;
    expect(sa.status).toBe("matched");

    // The call ends (as the call route's leave action does).
    await endRoom(sa.roomId);

    // Inspect persisted state before any queue touch can lazily repair it.
    const endedEntries = await db
      .select({ userId: queueEntries.userId, status: queueEntries.status })
      .from(queueEntries)
      .where(eq(queueEntries.roomId, sa.roomId))
      .orderBy(queueEntries.userId);
    expect(endedEntries).toEqual([
      { userId: a.id, status: "exited" },
      { userId: b.id, status: "exited" },
    ]);

    // A tries to queue again immediately.
    const rejoinA = await queueJoin({ userId: a.id, queueType: "casual" });
    expect(rejoinA.status, "re-join after room end must not return the dead room").toBe("waiting");

    // The state read agrees, and no stranded matched entry blocks the user.
    const stateA = await queueStateForUser(a.id);
    expect(stateA.status).toBe("waiting");

    // The stale matched row was released (terminal), leaving one live entry.
    const allA = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.userId, a.id))
      .orderBy(desc(queueEntries.id));
    expect(allA[0].status).toBe("waiting");
    if (allA.length > 1) {
      expect(allA[1].status === "waiting" || allA[1].status === "matched").toBe(false);
    }

    // B is freed by the same lazy release on their next touch.
    const stateB = await queueStateForUser(b.id);
    expect(stateB.status).toBe("idle");
    const liveB = await liveEntriesFor(b.id);
    expect(liveB).toHaveLength(0);
  }, 60_000);
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

describe("one person, two joins at once", () => {
  it("never makes two live entries or two active rooms for the same person", async () => {
    const problems: string[] = [];
    for (let round = 0; round < 20; round += 1) {
      const x = await makeUser(`twice${round}_x`);
      const y = await makeUser(`twice${round}_y`);
      await queueJoin({ userId: y.id, queueType: "casual" });
      // X presses join twice at the same moment, on two connections.
      const results = await Promise.allSettled([
        queueJoin({ userId: x.id, queueType: "casual" }),
        queueJoin({ userId: x.id, queueType: "casual" }),
      ]);
      for (const r of results) if (r.status === "rejected") problems.push(`round ${round}: ${String(r.reason?.message).slice(0, 60)}`);
      // Someone else joins after: X must not pair a second time.
      const w = await makeUser(`twice${round}_w`);
      await queueJoin({ userId: w.id, queueType: "casual" });
      const live = await liveEntriesFor(x.id);
      if (live.length > 1) problems.push(`round ${round}: ${live.length} live entries`);
      const active = (await roomsFor([x.id])).filter((r) => r.status === "active");
      if (active.length > 1) problems.push(`round ${round}: ${active.length} active rooms`);
      await deleteWitnessRows();
    }
    expect(problems).toEqual([]);
  }, 120_000);
});
