// @vitest-environment node
import "./support/use-stack-db";
import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { callSessions, queueEntries, rooms, users } from "@/db/schema";
import { getRoomForUser, queueJoin, queueStateForUser } from "@/lib/matching";
import { pollCall } from "@/lib/call/mesh";

const createdUsers: number[] = [];
async function pair(ageMs = 180_000) {
  const now = new Date();
  const old = new Date(now.getTime() - ageMs);
  const tag = crypto.randomUUID();
  const people = await db
    .insert(users)
    .values(
      ["a", "b"].map((who) => ({
        clerkId: `inactivity_${tag}_${who}`,
        email: `${tag}_${who}@witness.local`,
      })),
    )
    .returning();
  createdUsers.push(...people.map((person) => person.id));
  const [room] = await db
    .insert(rooms)
    .values({
      queueType: "casual",
      user1Id: people[0].id,
      user2Id: people[1].id,
      createdAt: old,
    })
    .returning();
  await db.insert(queueEntries).values(
    people.map((person) => ({
      userId: person.id,
      queueType: "casual",
      status: "matched",
      roomId: room.id,
      joinedAt: old,
      lastSeenAt: old,
    })),
  );
  return { people, room, now, old };
}
async function sessions(
  fixture: Awaited<ReturnType<typeof pair>>,
  heartbeat: Date,
) {
  await db.insert(callSessions).values(
    fixture.people.map((person) => ({
      userId: person.id,
      roomId: fixture.room.id,
      sessionId: `session-${person.id}`,
      lastHeartbeatAt: heartbeat,
      createdAt: fixture.old,
      updatedAt: heartbeat,
    })),
  );
}
afterEach(async () => {
  if (createdUsers.length)
    await db.delete(users).where(inArray(users.id, createdUsers.splice(0)));
});

describe("abandoned matches", () => {
  it("retires an offer nobody answered and releases both people before rejoining", async () => {
    const { people, room } = await pair();
    expect(
      await queueJoin({ userId: people[0].id, queueType: "casual" }),
    ).toEqual({ status: "waiting" });
    expect(
      (await db.query.rooms.findFirst({ where: eq(rooms.id, room.id) }))
        ?.status,
    ).toBe("ended");
    const entries = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.roomId, room.id));
    expect(entries.map((entry) => entry.status)).toEqual(["exited", "exited"]);
  });

  it("releases the active offer viewer too when the other person disappeared", async () => {
    const { people, room, now } = await pair();
    await db
      .update(queueEntries)
      .set({ lastSeenAt: now })
      .where(eq(queueEntries.userId, people[0].id));
    expect(await queueStateForUser(people[0].id)).toEqual({ status: "idle" });
    const entries = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.roomId, room.id));
    expect(entries.map((entry) => entry.status)).toEqual(["exited", "exited"]);
  });

  it("retires a call whose two tabs stopped heartbeat without Done", async () => {
    const fixture = await pair();
    await sessions(fixture, fixture.old);
    expect(
      await getRoomForUser(fixture.people[0].clerkId, fixture.room.id),
    ).toEqual({ allowed: false, reason: "room_ended" });
    const rows = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.roomId, fixture.room.id));
    expect(rows.map((row) => [row.state, row.closedReason])).toEqual([
      ["closed", "ended"],
      ["closed", "ended"],
    ]);
    expect(await queueStateForUser(fixture.people[1].id)).toEqual({
      status: "idle",
    });
  });

  it("refuses both participants when they reopen an abandoned room together", async () => {
    const fixture = await pair();
    const access = await Promise.all(
      fixture.people.map((person) =>
        getRoomForUser(person.clerkId, fixture.room.id),
      ),
    );
    expect(access).toEqual([
      { allowed: false, reason: "room_ended" },
      { allowed: false, reason: "room_ended" },
    ]);
  });

  it("keeps a live call when both queue screens stopped polling", async () => {
    const fixture = await pair();
    await sessions(fixture, new Date(fixture.now.getTime() - 5_000));
    for (const person of fixture.people) {
      expect(
        await pollCall(
          person.id,
          fixture.room.id,
          `session-${person.id}`,
          [],
          fixture.now,
        ),
      ).toMatchObject({ alive: true });
    }
    expect(
      await queueJoin({ userId: fixture.people[0].id, queueType: "casual" }),
    ).toEqual({ status: "matched", roomId: fixture.room.id });
    expect(
      (await getRoomForUser(fixture.people[1].clerkId, fixture.room.id))
        .allowed,
    ).toBe(true);
  });

  it("keeps a heartbeat at the two-minute boundary and expires it one millisecond later", async () => {
    const fixture = await pair();
    await sessions(fixture, fixture.now);
    expect(
      await queueJoin({
        userId: fixture.people[0].id,
        queueType: "casual",
        now: new Date(fixture.now.getTime() + 120_000),
      }),
    ).toEqual({ status: "matched", roomId: fixture.room.id });
    expect(
      await queueJoin({
        userId: fixture.people[0].id,
        queueType: "casual",
        now: new Date(fixture.now.getTime() + 120_001),
      }),
    ).toEqual({ status: "waiting" });
    const entries = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.roomId, fixture.room.id));
    expect(entries.map((entry) => entry.status)).toEqual(["exited", "exited"]);
  });

  it("expires a missing participant even when the other call session keeps heartbeating", async () => {
    const fixture = await pair();
    await sessions(fixture, fixture.old);
    expect(
      await pollCall(
        fixture.people[0].id,
        fixture.room.id,
        `session-${fixture.people[0].id}`,
        [],
        fixture.now,
      ),
    ).toMatchObject({ alive: true });
    expect(
      await queueJoin({
        userId: fixture.people[0].id,
        queueType: "casual",
        now: fixture.now,
      }),
    ).toEqual({ status: "waiting" });
    const rows = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.roomId, fixture.room.id));
    expect(rows.map((row) => row.state)).toEqual(["closed", "closed"]);
    expect(
      (await db.query.rooms.findFirst({ where: eq(rooms.id, fixture.room.id) }))
        ?.status,
    ).toBe("ended");
  });

  it("preserves a reload during the two-minute grace, then refuses the abandoned room", async () => {
    const fixture = await pair();
    const recent = new Date(fixture.now.getTime() - 90_000);
    await sessions(fixture, recent);
    await db
      .update(callSessions)
      .set({ state: "closed", closedReason: "left" })
      .where(eq(callSessions.roomId, fixture.room.id));
    expect(
      (await getRoomForUser(fixture.people[0].clerkId, fixture.room.id))
        .allowed,
    ).toBe(true);
    expect(
      await queueJoin({
        userId: fixture.people[0].id,
        queueType: "casual",
        now: new Date(fixture.now.getTime() + 40_000),
      }),
    ).toEqual({ status: "waiting" });
    expect(
      (await db.query.rooms.findFirst({ where: eq(rooms.id, fixture.room.id) }))
        ?.status,
    ).toBe("ended");
  });

  it("rechecks an in-flight call heartbeat before retiring a stale candidate", async () => {
    const fixture = await pair();
    await sessions(fixture, fixture.old);
    let reportHeartbeat!: (pid: number) => void;
    let commitHeartbeat!: () => void;
    const heartbeatReady = new Promise<number>((resolve) => {
      reportHeartbeat = resolve;
    });
    const commit = new Promise<void>((resolve) => {
      commitHeartbeat = resolve;
    });
    const heartbeat = db.transaction(async (tx) => {
      const [backend] = await tx.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      await tx
        .update(callSessions)
        .set({ lastHeartbeatAt: fixture.now })
        .where(eq(callSessions.roomId, fixture.room.id));
      reportHeartbeat(backend.pid);
      await commit;
    });
    const pid = await heartbeatReady;
    const joining = queueJoin({
      userId: fixture.people[0].id,
      queueType: "casual",
    });
    try {
      const deadline = Date.now() + 5_000;
      for (;;) {
        const [waiter] = await db.execute<{ blocked: boolean }>(sql`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS blocked
        `);
        if (waiter.blocked) break;
        if (Date.now() > deadline)
          throw new Error("Expiry did not reach the locked heartbeat row");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      commitHeartbeat();
      await heartbeat;
    }
    expect(await joining).toEqual({
      status: "matched",
      roomId: fixture.room.id,
    });
    expect(
      (await db.query.rooms.findFirst({ where: eq(rooms.id, fixture.room.id) }))
        ?.status,
    ).toBe("active");
    const rows = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.roomId, fixture.room.id));
    expect(rows.map((row) => row.state)).toEqual(["open", "open"]);
  });

  it("an offer poll refreshes matched liveness while it is still in the grace window", async () => {
    const fixture = await pair(90_000);
    expect((await queueStateForUser(fixture.people[0].id)).status).toBe(
      "matched",
    );
    expect((await queueStateForUser(fixture.people[1].id)).status).toBe(
      "matched",
    );
    const refreshed = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.roomId, fixture.room.id));
    expect(
      refreshed.every(
        (entry) => entry.lastSeenAt.getTime() >= fixture.now.getTime(),
      ),
    ).toBe(true);
    const later = new Date(fixture.now.getTime() + 60_000);
    expect(
      await queueJoin({
        userId: fixture.people[0].id,
        queueType: "casual",
        now: later,
      }),
    ).toEqual({ status: "matched", roomId: fixture.room.id });
  });
});
