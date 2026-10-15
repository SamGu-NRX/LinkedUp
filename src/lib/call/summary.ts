// src/lib/call/summary.ts — the after-call summary (LS2).
//
// When a participant presses Done, the room's own records are turned into one
// summary row per person and persisted (call_summaries). The rows hold only
// what the call produced — who you were with, how long you were actually
// connected, which queue it came from, and the star rating given in the call
// screen — so a summary or history view loads from the database in any later
// session, and an outsider can read neither a room's call nor its recap.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { callSummaries, callSessions, rooms, users } from "@/db/schema";

/** One person's summary as the summary and history screens render it. */
export type CallSummary = {
  roomId: string;
  userId: number;
  peerId: number;
  peerName: string;
  queueType: string;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  rating: number | null;
};

export type SummaryAccess =
  | { allowed: true; summary: CallSummary }
  | {
      allowed: false;
      reason: "signed_out" | "not_a_participant" | "summary_missing";
    };

export function formatCallDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs}s`;
}

/**
 * Persist both participants' summary rows for a room, once each.
 *
 * Duration is the time the two people were ACTUALLY connected: from the later
 * of the two first joins (each person's earliest call session in the room) to
 * the room's end. Queue waiting time before either joined is not call time. A
 * room that ended with a session on only one side measures from that side's
 * join; a room with no sessions at all (declined, nobody connected) gets 0.
 *
 * Idempotent: Done on both sides (or a retry) inserts nothing twice, and the
 * first star rating a person gives sticks — a later call never overwrites it.
 */
export async function persistCallSummaries(
  roomId: string,
  options: { now?: Date; ratingFor?: number; rating?: number } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return false;
  const endedAt = room.endedAt ?? now;

  // Each person's first join in this room: their earliest session.
  const firstJoins = await db
    .select({
      userId: callSessions.userId,
      firstJoin: sql<Date>`min(${callSessions.createdAt})`,
    })
    .from(callSessions)
    .where(eq(callSessions.roomId, roomId))
    .groupBy(callSessions.userId);
  const joinByUser = new Map(
    firstJoins.map((row) => [row.userId, row.firstJoin]),
  );

  const firstJoinA = joinByUser.get(room.user1Id);
  const firstJoinB = joinByUser.get(room.user2Id);
  // Connected when both were in: the later of the two first joins. One side
  // missing = the call started when the side that showed up did.
  const joinTimes = [firstJoinA, firstJoinB].filter((t): t is Date =>
    Boolean(t),
  );
  const startedAt =
    joinTimes.length > 0
      ? new Date(Math.max(...joinTimes.map((t) => new Date(t).getTime())))
      : endedAt;
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );

  const rows = [
    { userId: room.user1Id, peerId: room.user2Id },
    { userId: room.user2Id, peerId: room.user1Id },
  ].map((pair) => ({
    roomId,
    userId: pair.userId,
    peerId: pair.peerId,
    queueType: room.queueType,
    durationSeconds,
    startedAt,
    endedAt,
    rating:
      options.ratingFor !== undefined &&
      options.rating !== undefined &&
      options.ratingFor === pair.userId
        ? options.rating
        : null,
  }));

  await db.insert(callSummaries).values(rows).onConflictDoNothing();

  if (options.ratingFor !== undefined && options.rating !== undefined) {
    // First rating wins: a participant may press Done again after the room
    // already ended (their screen shows the problem panel), and re-rating on
    // that pass must not erase the rating they gave on the real one.
    await db
      .update(callSummaries)
      .set({ rating: options.rating })
      .where(
        and(
          eq(callSummaries.roomId, roomId),
          eq(callSummaries.userId, options.ratingFor),
          sql`${callSummaries.rating} IS NULL`,
        ),
      );
  }
  return true;
}

function partnerName(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return email.split("@")[0];
}

/**
 * One person's summary for a room, with the call-room gate's semantics: a
 * signed-in outsider gets not_a_participant whether the room exists or not —
 * nobody learns anything about a room that is not theirs — and a participant
 * whose room produced no summary (a declined match, nobody connected) gets
 * summary_missing rather than an invented recap.
 */
export async function getCallSummaryForUser(
  clerkUserId: string,
  roomId: string,
): Promise<SummaryAccess> {
  const me = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });
  if (!me) return { allowed: false, reason: "not_a_participant" };

  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room || (room.user1Id !== me.id && room.user2Id !== me.id)) {
    return { allowed: false, reason: "not_a_participant" };
  }

  const [row] = await db
    .select()
    .from(callSummaries)
    .where(
      and(eq(callSummaries.roomId, roomId), eq(callSummaries.userId, me.id)),
    );
  if (!row) return { allowed: false, reason: "summary_missing" };

  const peer = await db.query.users.findFirst({
    where: eq(users.id, row.peerId),
  });
  return {
    allowed: true,
    summary: {
      roomId: row.roomId,
      userId: row.userId,
      peerId: row.peerId,
      peerName: peer
        ? partnerName(peer.firstName, peer.lastName, peer.email)
        : "Your match",
      queueType: row.queueType,
      durationSeconds: row.durationSeconds,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      rating: row.rating,
    },
  };
}

/** A person's call history, most recent first. Only their own rows, ever. */
export async function listCallSummaries(
  userId: number,
): Promise<CallSummary[]> {
  const rows = await db
    .select()
    .from(callSummaries)
    .where(eq(callSummaries.userId, userId))
    .orderBy(desc(callSummaries.endedAt));

  const peers = rows.length
    ? await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
    : [];
  const peerById = new Map(peers.map((p) => [p.id, p]));

  return rows.map((row) => {
    const peer = peerById.get(row.peerId);
    return {
      roomId: row.roomId,
      userId: row.userId,
      peerId: row.peerId,
      peerName: peer
        ? partnerName(peer.firstName, peer.lastName, peer.email)
        : "Your match",
      queueType: row.queueType,
      durationSeconds: row.durationSeconds,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      rating: row.rating,
    };
  });
}
