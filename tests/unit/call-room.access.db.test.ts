/**
 * Real-database witnesses for the call room gate (the scripts/dev-up.mjs
 * stack, not a mock).
 *
 * The page-level access test (call-page.access.test.tsx) mocks the matching
 * seam; this suite witnesses the REAL server-side membership check against
 * the project Postgres that `pnpm dev:up` runs:
 *   - participants (both directions) are admitted with me/partner taken from
 *     the room record;
 *   - a signed-in non-participant and an unknown user are refused;
 *   - a missing room id is refused as room_not_found;
 *   - reloading while matched duplicates nothing (one room row, one matched
 *     queue entry, same access every read) — reload recovers honestly;
 *   - endRoom is idempotent, and after it both participants' reload refuses
 *     with room_ended while their queue state is honestly idle.
 *
 * Rows are synthetic and cleaned up in afterAll (cascades remove rooms and
 * queue entries with the users).
 */
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
// Pins DATABASE_URL to the dev-up stack's database and refuses any other.
import "./support/use-stack-db";

// Dynamic imports: @/db must evaluate only after DATABASE_URL is pinned.
const { getRoomForUser, endRoom, queueStateForUser } = await import("@/lib/matching");
const { db } = await import("@/db");
const { users, rooms, queueEntries } = await import("@/db/schema");

vi.setConfig({ testTimeout: 60_000 });

const RUN_ID = `r4call${Date.now().toString(36)}`;
const CLERK_IDS = {
  a: `clerk_r4call-a-${RUN_ID}`,
  b: `clerk_r4call-b-${RUN_ID}`,
  c: `clerk_r4call-c-${RUN_ID}`,
};

let userA: { id: number; clerkId: string };
let userB: { id: number; clerkId: string };
let room: { id: string };

beforeAll(async () => {
  const inserted = await db
    .insert(users)
    .values([
      {
        clerkId: CLERK_IDS.a,
        email: `synthetic-r4call-${RUN_ID}-a@example.com`,
        firstName: "Caller",
        lastName: "A",
      },
      {
        clerkId: CLERK_IDS.b,
        email: `synthetic-r4call-${RUN_ID}-b@example.com`,
        firstName: "Caller",
        lastName: "B",
      },
      {
        clerkId: CLERK_IDS.c,
        email: `synthetic-r4call-${RUN_ID}-c@example.com`,
        firstName: "Neighbor",
        lastName: "C",
      },
    ])
    .returning({ id: users.id, clerkId: users.clerkId });
  userA = inserted[0];
  userB = inserted[1];

  const insertedRoom = await db
    .insert(rooms)
    .values({ queueType: "casual", status: "active", user1Id: userA.id, user2Id: userB.id })
    .returning({ id: rooms.id });
  room = insertedRoom[0];

  await db.insert(queueEntries).values([
    { userId: userA.id, queueType: "casual", status: "matched", roomId: room.id },
    { userId: userB.id, queueType: "casual", status: "matched", roomId: room.id },
    { userId: inserted[2].id, queueType: "casual", status: "waiting" },
  ]);
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.clerkId, Object.values(CLERK_IDS)));
});

describe("getRoomForUser — server-side membership check against the real DB", () => {
  it("admits participant A with me/partner taken from the room record", async () => {
    const access = await getRoomForUser(CLERK_IDS.a, room.id);
    expect(access.allowed).toBe(true);
    if (!access.allowed) return;
    expect(access.me.id).toBe(userA.id);
    expect(access.partner.id).toBe(userB.id);
  });

  it("admits participant B symmetrically", async () => {
    const access = await getRoomForUser(CLERK_IDS.b, room.id);
    expect(access.allowed).toBe(true);
    if (!access.allowed) return;
    expect(access.me.id).toBe(userB.id);
    expect(access.partner.id).toBe(userA.id);
  });

  it("refuses a signed-in non-participant", async () => {
    const access = await getRoomForUser(CLERK_IDS.c, room.id);
    expect(access).toEqual({ allowed: false, reason: "not_a_participant" });
  });

  it("refuses an unknown (signed-in but never-seen) user", async () => {
    const access = await getRoomForUser(`clerk_r4call-unknown-${RUN_ID}`, room.id);
    expect(access).toEqual({ allowed: false, reason: "not_a_participant" });
  });

  it("refuses a missing room id", async () => {
    const access = await getRoomForUser(CLERK_IDS.a, "00000000-0000-0000-0000-000000000000");
    expect(access).toEqual({ allowed: false, reason: "room_not_found" });
  });
});

describe("reload recovery — repeat reads duplicate nothing (real DB)", () => {
  it("returns identical access on every reload and leaves one room row and one matched entry", async () => {
    const first = await getRoomForUser(CLERK_IDS.a, room.id);
    const second = await getRoomForUser(CLERK_IDS.a, room.id);
    const third = await getRoomForUser(CLERK_IDS.a, room.id);
    expect(second).toEqual(first);
    expect(third).toEqual(first);

    const roomRows = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, room.id));
    expect(roomRows).toHaveLength(1);

    const entries = await db
      .select({ id: queueEntries.id, status: queueEntries.status, roomId: queueEntries.roomId })
      .from(queueEntries)
      .where(eq(queueEntries.userId, userA.id));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: "matched", roomId: room.id });

    const state = await queueStateForUser(userA.id);
    expect(state.status).toBe("matched");
    if (state.status !== "matched") return;
    expect(state.roomId).toBe(room.id);
  });
});

describe("endRoom — closed peer leaves an honest ended state (real DB)", () => {
  it("is idempotent, then both reloads refuse with room_ended and the queue is idle", async () => {
    expect(await endRoom(room.id)).toBe(true);
    expect(await endRoom(room.id)).toBe(false);

    for (const clerkId of [CLERK_IDS.a, CLERK_IDS.b]) {
      const access = await getRoomForUser(clerkId, room.id);
      expect(access).toEqual({ allowed: false, reason: "room_ended" });
    }

    const state = await queueStateForUser(userA.id);
    expect(state.status).toBe("idle");
  });
});
