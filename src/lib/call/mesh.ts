// src/lib/call/mesh.ts — call signaling over Postgres, for the P2P mesh.
//
// The design follows Connvo's convex/meetings/webrtc/mesh.ts (#41, after its
// security review), moved onto Drizzle:
//
// - Every browser tab in a call gets its own session (call_sessions), and
//   signals are addressed to a session, not a user, so a reloaded tab never
//   receives offers meant for the tab it replaced. A signal is stored only
//   when its target session is open in the same room.
// - Only the room's two members get anywhere: every function takes the
//   caller's user id from Clerk (the route handler) and checks it against
//   the room, and a session can only be used by the user who owns it.
// - Open sessions heartbeat through their polls. A session that stops (a
//   killed tab, a lost network) is closed by the next poll in its room, and
//   by the global sweep when nobody else is there.
// - Every read and write is bounded: MAX_CALL_SESSIONS open sessions per
//   room, SIGNAL_QUEUE_LIMIT unread signals per session, a send-rate window
//   per session, size caps per signal field, and sweeps and cleanup in
//   batches that report whether more is left.
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { callSessions, callSignals, rooms } from "@/db/schema";
import {
  sessionIdSchema,
  type CloseReason,
  type InboundSignal,
  type PollResult,
  type PresenceEntry,
  type WireSignal,
} from "./signal-protocol";

/** A session with no poll for this long is closed as expired. */
export const HEARTBEAT_EXPIRY_MS = 10_000;

/**
 * Open sessions one room may hold. A LinkedUp room is one pair, and joining
 * closes the joiner's own older sessions, so two is the whole call.
 */
export const MAX_CALL_SESSIONS = 2;
/** Most open sessions a lookup reads; above the cap so sessions racing a sweep are still seen and closed. */
const OPEN_SCAN = MAX_CALL_SESSIONS * 2;

/**
 * Unread signals one session may have waiting. The client acknowledges
 * signals on its next poll, so a healthy queue holds a burst of ICE
 * candidates at most; a full one means the recipient stopped reading.
 */
export const SIGNAL_QUEUE_LIMIT = 100;

/**
 * Signals allowed per session per 10 s window. Setting up a two-person call
 * takes roughly 25 signals per tab (an offer or answer plus about twenty ICE
 * candidates); 200 leaves room for several ICE restarts. Carried over from
 * Connvo's four-person estimate, which no run has measured on real networks.
 */
export const SIGNAL_RATE_LIMIT = { windowMs: 10_000, maxRequests: 200 };

/** Joins one user may make in one room per minute: a reload loop, not a call, exceeds it. */
export const JOIN_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

/**
 * Largest accepted signal fields, in characters. A Chrome audio+video SDP is
 * about 5-10 KB, a candidate line about 150 characters, and an ICE username
 * fragment at most 256 characters (RFC 8839).
 */
export const SIGNAL_SIZE_LIMITS = {
  sdp: 32_768,
  candidate: 1_024,
  sdpMid: 64,
  usernameFragment: 256,
};

/** Rows one sweep or cleanup batch touches before reporting `more`. */
export const SWEEP_BATCH = 200;
export const CLEANUP_BATCH = 500;
/** Read signals and closed sessions are kept this long, then deleted. */
export const SIGNAL_RETENTION_MS = 10 * 60_000;
export const SESSION_RETENTION_MS = 60 * 60_000;

export type MeshErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "ROOM_ENDED"
  | "CALL_FULL"
  | "RATE_LIMITED"
  | "SIGNAL_QUEUE_FULL";

const STATUS: Record<MeshErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  ROOM_ENDED: 410,
  CALL_FULL: 409,
  RATE_LIMITED: 429,
  SIGNAL_QUEUE_FULL: 429,
};

/** A refusal with a code the client maps to its behaviour, and the HTTP status for it. */
export class MeshError extends Error {
  readonly status: number;
  constructor(
    readonly code: MeshErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MeshError";
    this.status = STATUS[code];
  }
}


export function checkSignalSize(signal: WireSignal): void {
  const fields: Array<[keyof typeof SIGNAL_SIZE_LIMITS, string | undefined]> =
    signal.kind === "description"
      ? [["sdp", signal.sdp]]
      : [
          ["candidate", signal.candidate],
          ["sdpMid", signal.sdpMid],
          ["usernameFragment", signal.usernameFragment],
        ];
  for (const [field, value] of fields) {
    if (value !== undefined && value.length > SIGNAL_SIZE_LIMITS[field]) {
      throw new MeshError("VALIDATION", `${field} is longer than ${SIGNAL_SIZE_LIMITS[field]} characters`);
    }
  }
}


type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;
type SessionRow = typeof callSessions.$inferSelect;

const participantIdOf = (userId: number) => String(userId);

/**
 * The room, if the user is one of its two members; otherwise FORBIDDEN, with
 * the same answer for a room that does not exist, so outsiders learn nothing.
 */
async function memberRoom(exec: Exec, roomId: string, userId: number, lock = false) {
  const query = exec.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const [room] = lock ? await query.for("update") : await query;
  if (!room || (room.user1Id !== userId && room.user2Id !== userId)) {
    throw new MeshError("FORBIDDEN", "You're not in this call. Only the two people matched into a room can join it.");
  }
  return room;
}

async function sessionById(exec: Exec, roomId: string, sessionId: string, lock = false): Promise<SessionRow | null> {
  const query = exec
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.sessionId, sessionId)))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

/** The caller's own session, or FORBIDDEN. */
async function ownSession(exec: Exec, roomId: string, sessionId: string, userId: number, lock = false) {
  const session = await sessionById(exec, roomId, sessionId, lock);
  if (!session || session.userId !== userId) {
    throw new MeshError("FORBIDDEN", "That call session is not yours.");
  }
  return session;
}

function openSessions(exec: Exec, roomId: string) {
  return exec
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.roomId, roomId), eq(callSessions.state, "open")))
    .orderBy(asc(callSessions.id))
    .limit(OPEN_SCAN);
}

function unreadSignals(exec: Exec, roomId: string, sessionId: string) {
  return exec
    .select()
    .from(callSignals)
    .where(
      and(
        eq(callSignals.roomId, roomId),
        eq(callSignals.toSessionId, sessionId),
        eq(callSignals.processed, false),
      ),
    )
    .orderBy(asc(callSignals.id))
    .limit(SIGNAL_QUEUE_LIMIT);
}

/**
 * Close a session. Its unread signals can never be read, so they are marked
 * read; the queue is capped, so that is the whole of it. Only an open
 * session changes: closing twice keeps the first reason.
 */
async function close(exec: Exec, session: SessionRow, reason: CloseReason, now: Date): Promise<void> {
  const closed = await exec
    .update(callSessions)
    .set({ state: "closed", closedReason: reason, updatedAt: now })
    .where(and(eq(callSessions.id, session.id), eq(callSessions.state, "open")))
    .returning({ id: callSessions.id });
  if (closed.length === 0) return;
  const unread = await unreadSignals(exec, session.roomId, session.sessionId);
  if (unread.length) {
    await exec
      .update(callSignals)
      .set({ processed: true })
      .where(inArray(callSignals.id, unread.map((s) => s.id)));
  }
}

/** Close open sessions in one room whose polls stopped. */
async function sweepRoom(exec: Exec, roomId: string, now: Date): Promise<void> {
  const cutoff = now.getTime() - HEARTBEAT_EXPIRY_MS;
  for (const session of await openSessions(exec, roomId)) {
    if (session.lastHeartbeatAt.getTime() < cutoff) await close(exec, session, "expired", now);
  }
}

/** Close every open session in a room as "ended". Ending a room calls this. */
export async function closeRoomSessions(roomId: string, now: Date = new Date()): Promise<void> {
  for (const session of await openSessions(db, roomId)) {
    await close(db, session, "ended", now);
  }
}

/**
 * Join the call with a new session. The caller's other open sessions in the
 * room close as "replaced": one tab per person. The room row is locked for
 * the join, so two joins cannot both take the last place.
 */
export async function joinCall(
  userId: number,
  roomId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<{ sessionId: string; participantId: string }> {
  const sid = sessionIdSchema.parse(sessionId);
  const joined = await db.transaction(async (tx) => {
    const room = await memberRoom(tx, roomId, userId, true);
    if (room.status !== "active") throw new MeshError("ROOM_ENDED", "This call has ended.");

    const existing = await sessionById(tx, roomId, sid);
    if (existing) {
      if (existing.userId !== userId) throw new MeshError("FORBIDDEN", "That call session is not yours.");
      return { sessionId: sid, participantId: participantIdOf(userId) };
    }

    const recentJoins = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(callSessions)
      .where(
        and(
          eq(callSessions.roomId, roomId),
          eq(callSessions.userId, userId),
          sql`${callSessions.createdAt} > ${new Date(now.getTime() - JOIN_RATE_LIMIT.windowMs).toISOString()}::timestamptz`,
        ),
      );
    if ((recentJoins[0]?.n ?? 0) >= JOIN_RATE_LIMIT.maxRequests) {
      throw new MeshError("RATE_LIMITED", "Too many joins in a minute. Wait a moment, then try again.");
    }

    const mine = await tx
      .select()
      .from(callSessions)
      .where(and(eq(callSessions.roomId, roomId), eq(callSessions.userId, userId), eq(callSessions.state, "open")))
      .limit(OPEN_SCAN);
    for (const old of mine) await close(tx, old, "replaced", now);
    await sweepRoom(tx, roomId, now);
    if ((await openSessions(tx, roomId)).length >= MAX_CALL_SESSIONS) {
      throw new MeshError("CALL_FULL", `This call is full: it already has ${MAX_CALL_SESSIONS} people.`);
    }
    await tx.insert(callSessions).values({
      roomId,
      sessionId: sid,
      userId,
      state: "open",
      lastHeartbeatAt: now,
      rateWindowStart: now,
      rateCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { sessionId: sid, participantId: participantIdOf(userId) };
  });
  // Housekeeping rides on joins: one bounded batch each, the next join
  // continues if a batch came back full.
  await sweepStaleSessions(now);
  await cleanupCallData(now);
  return joined;
}

/**
 * One poll is a heartbeat, an acknowledgement of the signals the client
 * handled since its last poll, and a read of presence and unread signals.
 * A closed session answers alive:false with its reason, so the client stops
 * instead of talking into it; a session in an ended room is closed "ended".
 */
export async function pollCall(
  userId: number,
  roomId: string,
  sessionId: string,
  ack: number[] = [],
  now: Date = new Date(),
): Promise<PollResult> {
  const sid = sessionIdSchema.parse(sessionId);
  const room = await memberRoom(db, roomId, userId);
  const session = await ownSession(db, roomId, sid, userId);
  if (session.state !== "open") return { alive: false, reason: (session.closedReason as CloseReason) ?? "expired" };
  if (room.status !== "active") {
    await close(db, session, "ended", now);
    return { alive: false, reason: "ended" };
  }
  const beat = await db
    .update(callSessions)
    .set({ lastHeartbeatAt: now, updatedAt: now })
    .where(and(eq(callSessions.id, session.id), eq(callSessions.state, "open")))
    .returning({ id: callSessions.id });
  if (beat.length === 0) {
    const [after] = await db.select().from(callSessions).where(eq(callSessions.id, session.id));
    return { alive: false, reason: (after?.closedReason as CloseReason) ?? "expired" };
  }
  await sweepRoom(db, roomId, now);

  const acks = ack.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, SIGNAL_QUEUE_LIMIT);
  if (acks.length) {
    // Only signals addressed to this session in this room can be marked read.
    await db
      .update(callSignals)
      .set({ processed: true })
      .where(
        and(
          inArray(callSignals.id, acks),
          eq(callSignals.roomId, roomId),
          eq(callSignals.toSessionId, sid),
        ),
      );
  }

  const presence = (await openSessions(db, roomId))
    .filter((s) => s.sessionId !== sid)
    .map((s) => ({
      sessionId: s.sessionId,
      participantId: participantIdOf(s.userId),
      micOn: s.micOn,
      cameraOn: s.cameraOn,
    }));
  const signals = (await unreadSignals(db, roomId, sid)).map((row) => ({
    id: row.id,
    fromSessionId: row.fromSessionId,
    fromParticipantId: participantIdOf(row.fromUserId),
    signal: row.payload as WireSignal,
  }));
  return { alive: true, presence, signals };
}

/**
 * Send signals from the caller's session to other open sessions in the same
 * room. Each signal is delivered or not (the target is not open there), and
 * nothing is stored for one that is not. Refused: an ended room, oversized
 * fields, more than SIGNAL_RATE_LIMIT signals per session per window, and a
 * target whose unread queue is full (SIGNAL_QUEUE_FULL).
 */
export async function sendSignals(
  userId: number,
  roomId: string,
  fromSessionId: string,
  batch: Array<{ toSessionId: string; signal: WireSignal }>,
  now: Date = new Date(),
): Promise<{ delivered: boolean[] }> {
  const from = sessionIdSchema.parse(fromSessionId);
  for (const item of batch) {
    sessionIdSchema.parse(item.toSessionId);
    checkSignalSize(item.signal);
  }
  const room = await memberRoom(db, roomId, userId);
  if (room.status !== "active") throw new MeshError("ROOM_ENDED", "This call has ended.");

  return db.transaction(async (tx) => {
    const sender = await ownSession(tx, roomId, from, userId, true);
    if (sender.state !== "open") return { delivered: batch.map(() => false) };

    // Every attempt from an open session counts, delivered or not. The row
    // is locked above, so concurrent sends from one session count in turn.
    const windowFresh = now.getTime() - sender.rateWindowStart.getTime() < SIGNAL_RATE_LIMIT.windowMs;
    const count = (windowFresh ? sender.rateCount : 0) + batch.length;
    if (count > SIGNAL_RATE_LIMIT.maxRequests) {
      throw new MeshError(
        "RATE_LIMITED",
        `More than ${SIGNAL_RATE_LIMIT.maxRequests} signals in ${SIGNAL_RATE_LIMIT.windowMs / 1000} s from one session.`,
      );
    }
    await tx
      .update(callSessions)
      .set({ rateCount: count, rateWindowStart: windowFresh ? sender.rateWindowStart : now })
      .where(eq(callSessions.id, sender.id));

    const delivered: boolean[] = [];
    for (const { toSessionId, signal } of batch) {
      const target = await sessionById(tx, roomId, toSessionId, true);
      if (!target || target.state !== "open" || target.sessionId === from) {
        delivered.push(false);
        continue;
      }
      // The target's row lock serializes senders, so the count is exact.
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(callSignals)
        .where(
          and(
            eq(callSignals.roomId, roomId),
            eq(callSignals.toSessionId, toSessionId),
            eq(callSignals.processed, false),
          ),
        );
      if (n >= SIGNAL_QUEUE_LIMIT) {
        throw new MeshError("SIGNAL_QUEUE_FULL", `The recipient's signal queue is full (${SIGNAL_QUEUE_LIMIT} unread).`);
      }
      await tx.insert(callSignals).values({
        roomId,
        fromSessionId: from,
        fromUserId: userId,
        toSessionId,
        payload: signal,
        processed: false,
        createdAt: now,
      });
      delivered.push(true);
    }
    return { delivered };
  });
}

/** Announce this session's mic and camera state to the other person. */
export async function setMediaState(
  userId: number,
  roomId: string,
  sessionId: string,
  state: { micOn: boolean; cameraOn: boolean },
  now: Date = new Date(),
): Promise<void> {
  const sid = sessionIdSchema.parse(sessionId);
  await memberRoom(db, roomId, userId);
  const session = await ownSession(db, roomId, sid, userId);
  if (session.state !== "open") return;
  await db
    .update(callSessions)
    .set({ micOn: state.micOn, cameraOn: state.cameraOn, updatedAt: now })
    .where(and(eq(callSessions.id, session.id), eq(callSessions.state, "open")));
}

/** Leave the call: the session closes and its unread signals are dropped. */
export async function leaveCall(userId: number, roomId: string, sessionId: string, now: Date = new Date()): Promise<void> {
  const sid = sessionIdSchema.parse(sessionId);
  await memberRoom(db, roomId, userId);
  const session = await ownSession(db, roomId, sid, userId);
  await close(db, session, "left", now);
}

/**
 * Close open sessions anywhere whose polls stopped, for rooms nobody else
 * polls. Oldest heartbeat first, SWEEP_BATCH at a time; `more` says a full
 * batch came back and another run should follow.
 */
export async function sweepStaleSessions(now: Date = new Date()): Promise<{ closed: number; more: boolean }> {
  const stale = await db
    .select()
    .from(callSessions)
    .where(
      and(
        eq(callSessions.state, "open"),
        lt(callSessions.lastHeartbeatAt, new Date(now.getTime() - HEARTBEAT_EXPIRY_MS)),
      ),
    )
    .orderBy(asc(callSessions.lastHeartbeatAt))
    .limit(SWEEP_BATCH);
  for (const session of stale) await close(db, session, "expired", now);
  return { closed: stale.length, more: stale.length === SWEEP_BATCH };
}

/**
 * Delete read signals and closed sessions past their retention, CLEANUP_BATCH
 * of each per run; `more` says a batch came back full.
 */
export async function cleanupCallData(now: Date = new Date()): Promise<{ signals: number; sessions: number; more: boolean }> {
  const signalCutoff = new Date(now.getTime() - SIGNAL_RETENTION_MS).toISOString();
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_MS).toISOString();
  const signals = await db.execute<{ id: number }>(sql`
    DELETE FROM call_signals WHERE id IN (
      SELECT id FROM call_signals
      WHERE processed = true AND created_at < ${signalCutoff}::timestamptz
      ORDER BY created_at LIMIT ${CLEANUP_BATCH}
    ) RETURNING id
  `);
  const sessions = await db.execute<{ id: number }>(sql`
    DELETE FROM call_sessions WHERE id IN (
      SELECT id FROM call_sessions
      WHERE state = 'closed' AND updated_at < ${sessionCutoff}::timestamptz
      ORDER BY updated_at LIMIT ${CLEANUP_BATCH}
    ) RETURNING id
  `);
  return {
    signals: signals.length,
    sessions: sessions.length,
    more: signals.length === CLEANUP_BATCH || sessions.length === CLEANUP_BATCH,
  };
}
