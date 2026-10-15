// @vitest-environment node
import "./support/use-stack-db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerk.userId }),
}));

const { db } = await import("@/db");
const { callRatings, rooms, users } = await import("@/db/schema");
const { saveCallRatingAction } = await import("@/app/app/call/[id]/_actions");
const { endRoomAction } = await import("@/app/app/smart-connection/_actions");

const prefix = `rating_${Date.now()}_`;
let members: { id: number; clerkId: string }[] = [];
let activeRoom = "";
let endedRoom = "";

beforeAll(async () => {
  members = await db
    .insert(users)
    .values(
      ["a", "b", "outsider"].map((tag) => ({
        clerkId: prefix + tag,
        email: `${prefix}${tag}@example.test`,
      })),
    )
    .returning({ id: users.id, clerkId: users.clerkId });
  const created = await db
    .insert(rooms)
    .values([
      { queueType: "casual", user1Id: members[0].id, user2Id: members[1].id },
      {
        queueType: "casual",
        user1Id: members[0].id,
        user2Id: members[1].id,
        status: "ended",
        endedAt: new Date(),
      },
    ])
    .returning({ id: rooms.id, status: rooms.status });
  activeRoom = created.find((row) => row.status === "active")!.id;
  endedRoom = created.find((row) => row.status === "ended")!.id;
});
afterAll(async () => {
  if (members.length)
    await db.delete(users).where(
      inArray(
        users.id,
        members.map((user) => user.id),
      ),
    );
});

describe("post-call ratings stored in Postgres", () => {
  it("stores the authenticated participant's selected stars", async () => {
    clerk.userId = members[0].clerkId;
    expect(
      await saveCallRatingAction({ roomId: activeRoom, rating: 4 }),
    ).toEqual({ success: true });
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, activeRoom));
    expect(rows).toEqual([{ userId: members[0].id, rating: 4 }]);
  });

  it("upserts repeated and concurrent submissions to one row per person", async () => {
    clerk.userId = members[0].clerkId;
    expect(
      await Promise.all(
        [1, 2, 3].map((rating) =>
          saveCallRatingAction({ roomId: activeRoom, rating }),
        ),
      ),
    ).toEqual([{ success: true }, { success: true }, { success: true }]);
    expect(
      await saveCallRatingAction({ roomId: activeRoom, rating: 5 }),
    ).toEqual({ success: true });
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, activeRoom));
    expect(rows).toEqual([{ userId: members[0].id, rating: 5 }]);
  });

  it("lets both participants rate after the room has ended and finish Done again", async () => {
    for (const [index, member] of members.slice(0, 2).entries()) {
      clerk.userId = member.clerkId;
      expect(
        await saveCallRatingAction({ roomId: endedRoom, rating: index + 3 }),
      ).toEqual({ success: true });
      expect(await endRoomAction(endedRoom)).toEqual({
        success: true,
        ended: false,
      });
    }
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, endedRoom))
      .orderBy(callRatings.userId);
    expect(rows).toEqual([
      { userId: members[0].id, rating: 3 },
      { userId: members[1].id, rating: 4 },
    ]);
  });

  it("rejects outsiders and signed-out callers without changing the saved rating", async () => {
    clerk.userId = members[2].clerkId;
    expect(
      await saveCallRatingAction({ roomId: activeRoom, rating: 1 }),
    ).toEqual({
      success: false,
      error: "Only participants can rate this call.",
    });
    expect(await endRoomAction(activeRoom)).toEqual({
      success: false,
      error: "not_a_participant",
    });
    clerk.userId = null;
    expect(
      await saveCallRatingAction({ roomId: activeRoom, rating: 1 }),
    ).toEqual({
      success: false,
      error: "Sign in again to save your rating, then choose Done.",
    });
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, activeRoom));
    expect(rows).toEqual([{ userId: members[0].id, rating: 5 }]);
  });

  it.each([0, 6, 1.5, "4", null, NaN])(
    "rejects invalid rating %s",
    async (rating) => {
      clerk.userId = members[0].clerkId;
      expect(
        await saveCallRatingAction({ roomId: activeRoom, rating }),
      ).toEqual({
        success: false,
        error: "Choose a rating from 1 to 5 for this call.",
      });
    },
  );

  it("refuses identity injection and malformed room ids", async () => {
    clerk.userId = members[0].clerkId;
    for (const input of [
      { roomId: activeRoom, rating: 1, userId: members[1].id },
      { roomId: "invalid", rating: 1 },
    ]) {
      expect(await saveCallRatingAction(input)).toEqual({
        success: false,
        error: "Choose a rating from 1 to 5 for this call.",
      });
    }
    expect(await endRoomAction("invalid")).toEqual({
      success: false,
      error: "not_a_participant",
    });
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, activeRoom));
    expect(rows).toEqual([{ userId: members[0].id, rating: 5 }]);
  });

  it("the database also enforces the rating range and room/person uniqueness", async () => {
    await expect(
      db
        .insert(callRatings)
        .values({ roomId: activeRoom, userId: members[1].id, rating: 6 }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db
        .insert(callRatings)
        .values({ roomId: activeRoom, userId: members[0].id, rating: 1 }),
    ).rejects.toMatchObject({ code: "23505" });
    const rows = await db
      .select({ userId: callRatings.userId, rating: callRatings.rating })
      .from(callRatings)
      .where(eq(callRatings.roomId, activeRoom));
    expect(rows).toEqual([{ userId: members[0].id, rating: 5 }]);
  });

  it("ends the active room once and lets the partner finish it again", async () => {
    clerk.userId = members[0].clerkId;
    expect(await endRoomAction(activeRoom)).toEqual({ success: true, ended: true });
    clerk.userId = members[1].clerkId;
    expect(await endRoomAction(activeRoom)).toEqual({ success: true, ended: false });
    const [room] = await db.select({ status: rooms.status }).from(rooms).where(eq(rooms.id, activeRoom));
    expect(room).toEqual({ status: "ended" });
  });
});
