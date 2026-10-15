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
import { callSessions, queueEntries, rooms, users } from "@/db/schema";
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

/**
 * Either participant missing for two minutes retires the room. This gives
 * a reload time to rejoin after the mesh's 10-second session expiry. Two
 * minutes is a product grace period; no measured reload-gap data exists.
 */
export const ROOM_INACTIVITY_MS = 2 * 60_000;

function inactiveRoom(cutoff: Date) {
  // Drizzle drops interpolated column qualifiers in SELECT expressions.
  // Keep rooms.id explicit so these subqueries cannot bind to a queue/session id.
  return sql<boolean>`EXISTS (
    SELECT 1 FROM (VALUES (${rooms.user1Id}), (${rooms.user2Id})) AS participant(user_id)
    WHERE GREATEST(
      ${rooms.createdAt},
      (SELECT max(q.last_seen_at) FROM queue_entries q
       WHERE q.room_id = rooms.id AND q.user_id = participant.user_id AND q.status = 'matched'),
      (SELECT max(s.last_heartbeat_at) FROM call_sessions s
       WHERE s.room_id = rooms.id AND s.user_id = participant.user_id)
    ) < ${cutoff.toISOString()}::timestamptz
  )`;
}

/** Only inspect this person's matched room; queue polls do not scan all rooms. */
async function expireInactiveRoomForUser(userId: number, now: Date): Promise<void> {
  const matches = await db.select({ roomId: queueEntries.roomId }).from(queueEntries)
    .where(and(eq(queueEntries.userId, userId), eq(queueEntries.status, "matched")));
  for (const match of matches) {
    if (match.roomId) await expireInactiveRoom(match.roomId, now);
  }
}

/** Signaling reconnects without page navigation, before renewing its heartbeat. */
export async function expireInactiveRoomForParticipant(userId: number, roomId: string, now: Date = new Date()): Promise<void> {
  await expireInactiveRoom(roomId, now, userId);
}

async function expireInactiveRoom(roomId: string, now: Date, participantId?: number): Promise<boolean> {
  const cutoff = new Date(now.getTime() - ROOM_INACTIVITY_MS);
  const [candidate] = await db.select({ status: rooms.status, inactive: inactiveRoom(cutoff) }).from(rooms)
    .where(and(eq(rooms.id, roomId), participantId === undefined ? undefined : or(eq(rooms.user1Id, participantId), eq(rooms.user2Id, participantId))));
  if (!candidate || candidate.status !== "active") return true;
  if (!candidate.inactive) return false;
  if (await endRoomWhen(roomId, now, cutoff)) return true;
  // Another expiry may have ended the room while this request waited for
  // its locks. A refreshed heartbeat can also cancel expiry, so read which won.
  const [current] = await db.select({ status: rooms.status }).from(rooms).where(eq(rooms.id, roomId));
  return current?.status !== "active";
}

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

/** Queue and match-offer polls both count as this person still being here. */
async function touchQueueEntry(userId: number, now: Date = new Date()): Promise<void> {
  await db
    .update(queueEntries)
    .set({ lastSeenAt: now })
    .where(and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "matched"])));
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

  await expireInactiveRoomForUser(userId, now);
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
  const now = new Date();
  // Retire an abandoned match before this returning tab can revive its offer.
  await expireInactiveRoomForUser(userId, now);
  await touchQueueEntry(userId, now);
  await expireStaleQueueEntries(now);
  await releaseEndedRoomEntries(now);

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
  if (room.status !== "active" || await expireInactiveRoom(roomId, new Date())) {
    return { allowed: false, reason: "room_ended" };
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
  return endRoomWhen(roomId, now);
}

async function endRoomWhen(roomId: string, now: Date, inactiveBefore?: Date): Promise<boolean> {
  const ended = await db.transaction(async (tx) => {
    // Lock queue entries before the room, in the same order as cancelOnce.
    // Otherwise simultaneous decline and end can deadlock on those rows.
    await tx
      .select({ id: queueEntries.id })
      .from(queueEntries)
      .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.status, "matched")))
      .orderBy(queueEntries.id)
      .for("update");
    if (inactiveBefore) {
      // Joins lock room then sessions. Keep that order after the queue locks,
      // and recheck liveness after any in-flight heartbeat has committed.
      await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).for("update");
      await tx.select({ id: callSessions.id }).from(callSessions)
        .where(eq(callSessions.roomId, roomId)).orderBy(callSessions.id).for("update");
    }
    const updated = await tx
      .update(rooms)
      .set({ status: "ended", endedAt: now })
      .where(and(eq(rooms.id, roomId), eq(rooms.status, "active"), inactiveBefore ? inactiveRoom(inactiveBefore) : undefined))
      .returning({ id: rooms.id });
    if (inactiveBefore && updated.length === 0) return false;
    // Release both matches in the room-ending commit, without waiting for
    // a later queue poll. The predicate preserves a partner already requeued
    // by a concurrent decline.
    await tx
      .update(queueEntries)
      .set({ status: "exited", exitedAt: now })
      .where(and(eq(queueEntries.roomId, roomId), eq(queueEntries.status, "matched")));
    return updated.length > 0;
  });
  // The call goes with the room: its open sessions close as "ended". (A
  // poll in an ended room also closes the poller's session, so this is
  // promptness, not correctness.)
  if (ended || !inactiveBefore) await closeRoomSessions(roomId, now);
  return ended;
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
