// src/lib/matching.ts — DB-backed queue, pairing, and room access (LS0).
//
// All queue and room state lives in Postgres (queue_entries / rooms).
// Pairing runs inside a transaction using FOR UPDATE SKIP LOCKED so two
// concurrent joins can never both claim the same partner. A deliberately
// naive non-transactional twin (pairWaitingUsersNaive) exists ONLY as a
// concurrency-test witness: it demonstrates the race the transactional
// path prevents, and is never used by the app.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { queueEntries, rooms, users } from "@/db/schema";

export type QueueType = "casual" | "professional";

export type PartnerInfo = {
  id: number;
  name: string;
  avatarUrl: string;
};

export type QueueStateForUser =
  | { status: "idle" }
  | { status: "waiting"; queueType: QueueType; joinedAt: string }
  | { status: "matched"; queueType: QueueType; roomId: string; partner: PartnerInfo };

/** A queue entry older than this is stale and expires lazily. */
export const STALE_ENTRY_MS = 5 * 60_000;

/** True when a still-waiting entry has been waiting longer than the stale window. */
export function isQueueEntryStale(
  entry: { status: string; joinedAt: Date | string },
  now: Date = new Date(),
): boolean {
  if (entry.status !== "waiting") return false;
  const joined = typeof entry.joinedAt === "string" ? new Date(entry.joinedAt) : entry.joinedAt;
  return now.getTime() - joined.getTime() > STALE_ENTRY_MS;
}

/** Lazily expire stale waiting entries. Called on every queue touch. */
export async function expireStaleQueueEntries(now: Date = new Date()): Promise<void> {
  await db
    .update(queueEntries)
    .set({ status: "expired", exitedAt: now })
    .where(
      and(
        eq(queueEntries.status, "waiting"),
        sql`${queueEntries.joinedAt} < now() - interval '5 minutes'`,
      ),
    );
}

export async function queueJoin(options: {
  userId: number;
  queueType: QueueType;
  now?: Date;
}): Promise<{ status: "waiting" } | { status: "matched"; roomId: string }> {
  const { userId, queueType } = options;
  const now = options.now ?? new Date();

  await expireStaleQueueEntries(now);

  // Already waiting or matched? Report the live state instead of double-joining.
  const existing = await db.query.queueEntries.findFirst({
    where: and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])),
  });
  if (existing?.status === "waiting" && existing.queueType === queueType) {
    return { status: "waiting" };
  }
  if (existing?.status === "matched" && existing.roomId) {
    return { status: "matched", roomId: existing.roomId };
  }

  await db.insert(queueEntries).values({ userId, queueType, status: "waiting", joinedAt: now });

  // Try to pair immediately (our own entry can be the second member).
  const paired = await pairWaitingUsersTransactional(queueType, now);
  if (paired && (paired.winnerId === userId || paired.loserId === userId)) {
    return { status: "matched", roomId: paired.roomId };
  }
  return { status: "waiting" };
}

export async function queueCancel(userId: number, now: Date = new Date()): Promise<{ status: "idle" }> {
  await db
    .update(queueEntries)
    .set({ status: "exited", exitedAt: now })
    .where(and(eq(queueEntries.userId, userId), eq(queueEntries.status, "waiting")));
  return { status: "idle" };
}

export async function queueStateForUser(userId: number): Promise<QueueStateForUser> {
  await expireStaleQueueEntries();

  const entry = await db.query.queueEntries.findFirst({
    where: and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])),
  });

  if (!entry) return { status: "idle" };

  if (entry.status === "waiting") {
    return {
      status: "waiting",
      queueType: entry.queueType as QueueType,
      joinedAt: entry.joinedAt.toISOString(),
    };
  }

  if (entry.roomId) {
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, entry.roomId) });
    if (room && room.status === "active") {
      const partnerId = room.user1Id === userId ? room.user2Id : room.user1Id;
      const partner = await db.query.users.findFirst({ where: eq(users.id, partnerId) });
      return {
        status: "matched",
        queueType: room.queueType as QueueType,
        roomId: room.id,
        partner: {
          id: partnerId,
          name: partnerName(partner?.firstName, partner?.lastName, partner?.email),
          avatarUrl: "",
        },
      };
    }
  }

  return { status: "idle" };
}

export type RoomAccess =
  | {
      allowed: true;
      roomId: string;
      queueType: QueueType;
      me: PartnerInfo;
      partner: PartnerInfo;
    }
  | { allowed: false; reason: "room_not_found" | "room_ended" | "not_a_participant" };

/** Server-side room-membership check for the call route. */
export async function getRoomForUser(clerkUserId: string, roomId: string): Promise<RoomAccess> {
  const me = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
  if (!me) return { allowed: false, reason: "not_a_participant" };

  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) return { allowed: false, reason: "room_not_found" };
  if (room.status !== "active") return { allowed: false, reason: "room_ended" };

  if (room.user1Id !== me.id && room.user2Id !== me.id) {
    return { allowed: false, reason: "not_a_participant" };
  }

  const partnerId = room.user1Id === me.id ? room.user2Id : room.user1Id;
  const partner = await db.query.users.findFirst({ where: eq(users.id, partnerId) });

  const toInfo = (u: typeof me): PartnerInfo => ({
    id: u.id,
    name: partnerName(u.firstName, u.lastName, u.email),
    avatarUrl: "",
  });

  return {
    allowed: true,
    roomId: room.id,
    queueType: room.queueType as QueueType,
    me: toInfo(me),
    partner: partner ? toInfo(partner) : { id: partnerId, name: "Your match", avatarUrl: "" },
  };
}

/** Ends a room. Idempotent: ending an ended room is a no-op returning false. */
export async function endRoom(roomId: string, now: Date = new Date()): Promise<boolean> {
  const updated = await db
    .update(rooms)
    .set({ status: "ended", endedAt: now })
    .where(and(eq(rooms.id, roomId), eq(rooms.status, "active")))
    .returning({ id: rooms.id });
  return updated.length > 0;
}

/**
 * Transactional pairing. Reads two waiting entries with FOR UPDATE SKIP
 * LOCKED (no double-claim under concurrency), inserts the room, and flips
 * both entries to `matched` — all or nothing.
 */
export async function pairWaitingUsersTransactional(
  queueType: QueueType,
  now: Date = new Date(),
): Promise<{ roomId: string; winnerId: number; loserId: number } | null> {
  return db.transaction(async (tx) => {
    const winnerRows = await tx.execute<{ id: number }>(sql`
      SELECT id FROM queue_entries
      WHERE queue_type = ${queueType} AND status = 'waiting'
      ORDER BY joined_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const winner = winnerRows[0];
    if (!winner) return null;

    const loserRows = await tx.execute<{ id: number }>(sql`
      SELECT id FROM queue_entries
      WHERE queue_type = ${queueType} AND status = 'waiting' AND id != ${winner.id}
      ORDER BY joined_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const loser = loserRows[0];
    if (!loser) return null;

    const winnerEntry = await tx.query.queueEntries.findFirst({ where: eq(queueEntries.id, winner.id) });
    const loserEntry = await tx.query.queueEntries.findFirst({ where: eq(queueEntries.id, loser.id) });
    if (!winnerEntry || !loserEntry) return null;

    const [room] = await tx
      .insert(rooms)
      .values({
        queueType,
        status: "active",
        user1Id: winnerEntry.userId,
        user2Id: loserEntry.userId,
        createdAt: now,
      })
      .returning({ id: rooms.id });

    await tx
      .update(queueEntries)
      .set({ status: "matched", roomId: room.id })
      .where(inArray(queueEntries.id, [winner.id, loser.id]));

    return { roomId: room.id, winnerId: winnerEntry.userId, loserId: loserEntry.userId };
  });
}

/**
 * Non-transactional pairing witness for concurrency tests. Deliberately
 * reads both entries OUTSIDE any lock/transaction so two concurrent
 * calls can pick the same partner. Never called by the app.
 */
export async function pairWaitingUsersNaive(
  queueType: QueueType,
  now: Date = new Date(),
): Promise<{ roomId: string; winnerId: number; loserId: number } | null> {
  const winner = await db.query.queueEntries.findFirst({
    where: and(eq(queueEntries.queueType, queueType), eq(queueEntries.status, "waiting")),
    orderBy: [queueEntries.joinedAt],
  });
  if (!winner) return null;

  const loser = await db.query.queueEntries.findFirst({
    where: and(
      eq(queueEntries.queueType, queueType),
      eq(queueEntries.status, "waiting"),
      sql`${queueEntries.id} != ${winner.id}`,
    ),
    orderBy: [queueEntries.joinedAt],
  });
  if (!loser) return null;

  const [room] = await db
    .insert(rooms)
    .values({ queueType, status: "active", user1Id: winner.userId, user2Id: loser.userId, createdAt: now })
    .returning({ id: rooms.id });

  await db
    .update(queueEntries)
    .set({ status: "matched", roomId: room.id })
    .where(inArray(queueEntries.id, [winner.id, loser.id]));

  return { roomId: room.id, winnerId: winner.userId, loserId: loser.userId };
}

function partnerName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (email) return email.split("@")[0];
  return "Your match";
}
