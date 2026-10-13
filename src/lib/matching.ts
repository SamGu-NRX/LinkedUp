// src/lib/matching.ts — DB-backed queue, pairing, and room access (LS0).
//
// All queue and room state lives in Postgres (queue_entries / rooms).
// Pairing runs inside a transaction using FOR UPDATE SKIP LOCKED so two
// concurrent joins can never both claim the same partner. The pairing body
// (pairWaitingUsersWith) takes its executor as an argument: the app passes
// a transaction; the concurrency witness passes the bare connection, which
// is the production pairing with its transaction removed.
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { queueEntries, rooms, users } from "@/db/schema";
import { closeRoomSessions } from "@/lib/call/mesh";

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

/**
 * A waiting entry nobody has polled for this long is stale and expires
 * lazily. The queue screen polls every 2 s, so 30 s is fifteen missed polls:
 * the person closed the tab or lost the connection. Liveness is the last
 * poll (lastSeenAt), not the join time, so a person who keeps waiting stays
 * in the queue however long it takes. The 30 s is a judgment; no measured
 * poll-gap distribution exists.
 */
export const STALE_ENTRY_MS = 30_000;

/** True when a waiting entry has not been seen within the stale window. */
export function isQueueEntryStale(
  entry: { status: string; lastSeenAt: Date | string },
  now: Date = new Date(),
): boolean {
  if (entry.status !== "waiting") return false;
  const seen = typeof entry.lastSeenAt === "string" ? new Date(entry.lastSeenAt) : entry.lastSeenAt;
  return now.getTime() - seen.getTime() > STALE_ENTRY_MS;
}

/**
 * Lazily expire stale waiting entries. Called on every queue touch.
 * The window comes from STALE_ENTRY_MS and the caller's `now` — one source
 * of truth, deterministic for tests.
 */
export async function expireStaleQueueEntries(now: Date = new Date()): Promise<void> {
  await db
    .update(queueEntries)
    .set({ status: "expired", exitedAt: now })
    .where(
      and(
        eq(queueEntries.status, "waiting"),
        lt(queueEntries.lastSeenAt, new Date(now.getTime() - STALE_ENTRY_MS)),
      ),
    );
}

/** The person is still here: refresh their waiting entry's liveness. */
export async function touchWaitingEntry(userId: number, now: Date = new Date()): Promise<void> {
  await db
    .update(queueEntries)
    .set({ lastSeenAt: now })
    .where(and(eq(queueEntries.userId, userId), eq(queueEntries.status, "waiting")));
}

/**
 * Lazily release matched entries whose room is gone or no longer active.
 * Without this, a finished call strands its entries `matched` forever:
 * queueJoin keeps returning the dead room and the user can never re-queue.
 * Called on every queue touch, like the staleness sweep.
 */
export async function releaseEndedRoomEntries(now: Date = new Date()): Promise<void> {
  // A raw sql`` parameter goes to postgres-js untyped, and postgres-js
  // cannot serialize a Date it has no column type for: pass ISO text.
  await db.execute(sql`
    UPDATE queue_entries
    SET status = 'exited', exited_at = ${now.toISOString()}::timestamptz
    WHERE status = 'matched'
      AND (
        room_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM rooms r
          WHERE r.id = queue_entries.room_id AND r.status = 'active'
        )
      )
  `);
}

export async function queueJoin(options: {
  userId: number;
  queueType: QueueType;
  now?: Date;
}): Promise<{ status: "waiting" } | { status: "matched"; roomId: string }> {
  const { userId, queueType } = options;
  const now = options.now ?? new Date();

  await expireStaleQueueEntries(now);
  await releaseEndedRoomEntries(now);

  // Already waiting or matched? Report the live state instead of double-joining.
  const liveState = async () => {
    const existing = await db.query.queueEntries.findFirst({
      where: and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])),
    });
    if (existing?.status === "waiting") return { status: "waiting" as const };
    if (existing?.status === "matched" && existing.roomId) return { status: "matched" as const, roomId: existing.roomId };
    return null;
  };
  const before = await liveState();
  if (before) return before;

  // One live entry per person, waiting or matched, is a unique index
  // (queue_entries_user_live_unique). Two joins that both found nothing
  // above race here; the loser inserts nothing and reports the winner's
  // entry, instead of becoming a second entry that pairs into a second room.
  const inserted = await db
    .insert(queueEntries)
    .values({ userId, queueType, status: "waiting", joinedAt: now, lastSeenAt: now })
    .onConflictDoNothing()
    .returning({ id: queueEntries.id });
  if (inserted.length === 0) return (await liveState()) ?? { status: "waiting" };

  // Try to pair immediately (our own entry can be the second member).
  const paired = await pairIfPartnerWaiting(queueType, now);
  if (paired && (paired.winnerId === userId || paired.loserId === userId)) {
    return { status: "matched", roomId: paired.roomId };
  }
  return { status: "waiting" };
}

/**
 * Leave the queue. A waiting entry just exits. An offered match is released
 * too: its room ends, and the other person's entry goes back to waiting
 * (liveness refreshed, original join time kept) so the queue pairs them with
 * someone else instead of leaving them matched to a room nobody will join.
 */
export async function queueCancel(userId: number, now: Date = new Date()): Promise<{ status: "idle" }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await cancelOnce(userId, now)) return { status: "idle" };
  }
  throw new Error(`queueCancel: user ${userId}'s queue entry changed under three cancel attempts in a row`);
}

/** One cancel transaction. False when the entry changed before it was locked. */
async function cancelOnce(userId: number, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [peek] = await tx
      .select()
      .from(queueEntries)
      .where(and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])));
    if (!peek) return true;

    // Lock every entry this cancel writes in id order, so the two members of
    // a match cancelling at once queue up behind each other instead of
    // deadlocking (each holding its own row while waiting for the other's).
    const matchedRoom = peek.status === "matched" ? peek.roomId : null;
    const locked = await tx
      .select()
      .from(queueEntries)
      .where(
        matchedRoom
          ? or(
              eq(queueEntries.id, peek.id),
              and(eq(queueEntries.roomId, matchedRoom), eq(queueEntries.status, "matched")),
            )
          : eq(queueEntries.id, peek.id),
      )
      .orderBy(queueEntries.id)
      .for("update");
    const mine = locked.find((row) => row.id === peek.id);
    if (!mine || mine.status !== peek.status || mine.roomId !== peek.roomId) return false;

    await tx.update(queueEntries).set({ status: "exited", exitedAt: now }).where(eq(queueEntries.id, mine.id));
    if (!matchedRoom) return true;

    await tx
      .update(rooms)
      .set({ status: "ended", endedAt: now })
      .where(and(eq(rooms.id, matchedRoom), eq(rooms.status, "active")));
    const partners = locked.filter(
      (row) => row.id !== mine.id && row.roomId === matchedRoom && row.status === "matched",
    );
    if (partners.length > 0) {
      await tx
        .update(queueEntries)
        .set({ status: "waiting", roomId: null, lastSeenAt: now })
        .where(inArray(queueEntries.id, partners.map((row) => row.id)));
    }
    return true;
  });
}

export async function queueStateForUser(userId: number): Promise<QueueStateForUser> {
  // A poll is the person saying they are still here.
  await touchWaitingEntry(userId);
  await expireStaleQueueEntries();
  await releaseEndedRoomEntries();

  let entry = await db.query.queueEntries.findFirst({
    where: and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])),
  });

  // Read-path pairing: two simultaneous joiners can each fail to claim the
  // other (lock races leave both briefly waiting). The next poll finishes
  // the pair, so a queue that is ready never stalls behind a lost race.
  if (entry?.status === "waiting") {
    const paired = await pairIfPartnerWaiting(entry.queueType as QueueType, new Date());
    if (paired) {
      entry =
        (await db.query.queueEntries.findFirst({
          where: and(
            eq(queueEntries.userId, userId),
            inArray(queueEntries.status, ["waiting", "matched"]),
          ),
        })) ?? entry;
    }
  }

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

  // Membership first: someone outside a room learns nothing about it, not
  // even whether it exists or has ended.
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room || (room.user1Id !== me.id && room.user2Id !== me.id)) {
    return { allowed: false, reason: "not_a_participant" };
  }
  if (room.status !== "active") return { allowed: false, reason: "room_ended" };

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
  // The call goes with the room: its open sessions close as "ended". (A
  // poll in an ended room also closes the poller's session, so this is
  // promptness, not correctness.)
  await closeRoomSessions(roomId, now);
  return updated.length > 0;
}

type Executor = Pick<typeof db, "execute" | "insert" | "update">;

/**
 * The pairing body: claim the two longest-waiting entries of a type with
 * FOR UPDATE SKIP LOCKED in one statement, insert their room, and mark both
 * matched. Inside a transaction (pairWaitingUsersTransactional) the claim
 * holds until commit, so concurrent pairings never take the same entry.
 * Exported for the concurrency witness, which runs it on the bare
 * connection; the app never does.
 */
export async function pairWaitingUsersWith(
  exec: Executor,
  queueType: QueueType,
  now: Date = new Date(),
): Promise<{ roomId: string; winnerId: number; loserId: number } | null> {
  const pairRows = await exec.execute<{ id: number; userId: number }>(sql`
    SELECT id, user_id AS "userId" FROM queue_entries
    WHERE queue_type = ${queueType} AND status = 'waiting'
    ORDER BY joined_at ASC, id ASC
    LIMIT 2
    FOR UPDATE SKIP LOCKED
  `);
  const winner = pairRows[0];
  const loser = pairRows[1];
  if (!winner || !loser) return null;

  const [room] = await exec
    .insert(rooms)
    .values({
      queueType,
      status: "active",
      user1Id: winner.userId,
      user2Id: loser.userId,
      createdAt: now,
    })
    .returning({ id: rooms.id });

  await exec
    .update(queueEntries)
    .set({ status: "matched", roomId: room.id })
    .where(inArray(queueEntries.id, [winner.id, loser.id]));

  return { roomId: room.id, winnerId: winner.userId, loserId: loser.userId };
}

/** The app's pairing: pairWaitingUsersWith inside one transaction. */
export async function pairWaitingUsersTransactional(
  queueType: QueueType,
  now: Date = new Date(),
): Promise<{ roomId: string; winnerId: number; loserId: number } | null> {
  return db.transaction((tx) => pairWaitingUsersWith(tx, queueType, now));
}

async function countWaitingEntries(queueType: QueueType): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queueEntries)
    .where(and(eq(queueEntries.queueType, queueType), eq(queueEntries.status, "waiting")));
  return row?.count ?? 0;
}

/**
 * Pair now if at least two entries wait; retry briefly when a concurrent
 * claim wins the lock race and leaves this attempt with nothing locked.
 */
async function pairIfPartnerWaiting(
  queueType: QueueType,
  now: Date,
): Promise<{ roomId: string; winnerId: number; loserId: number } | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await countWaitingEntries(queueType)) < 2) return null;
    const paired = await pairWaitingUsersTransactional(queueType, now);
    if (paired) return paired;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
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
