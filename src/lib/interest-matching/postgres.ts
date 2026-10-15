import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { roomMatchIntros } from "@/db/schema";
import type { QueueType } from "@/lib/matching";
import { decideMatch } from "./server";
import { proposePair } from "./selection";
import type { MatchIntro, WaitingProfile } from "./types";

export async function preparePair(queueType: QueueType, now: Date, staleAfterMs: number, joiningUserId?: number) {
  // Snapshot reads never lock waiters while the remote judge is running.
  // Read all live waiters so an arbitrary scan limit cannot hide a good fit.
  // Raw execute bypasses Drizzle's timestamp column mapper; postgres-js
  // returns timestamp text here, so convert it at this database boundary.
  const profiles = await db.execute<Omit<WaitingProfile, "joinedAt"> & { joinedAt: string }>(sql`
    SELECT q.id AS "entryId", q.user_id AS "userId", q.joined_at AS "joinedAt",
      COALESCE(array_agg(i.name ORDER BY i.name) FILTER (WHERE i.name IS NOT NULL), '{}') AS interests
    FROM queue_entries q LEFT JOIN interests i ON i.user_id = q.user_id
    WHERE q.queue_type = ${queueType} AND q.status = 'waiting'
      AND q.last_seen_at >= ${new Date(now.getTime() - staleAfterMs).toISOString()}::timestamptz
    GROUP BY q.id ORDER BY q.joined_at, q.id
  `);
  return proposePair(profiles.map((profile) => ({ ...profile, joinedAt: new Date(profile.joinedAt) })), now, decideMatch, joiningUserId);
}

/** Called only after the existing queue/room membership check. */
export async function getMatchIntro(roomId: string): Promise<MatchIntro | null> {
  const [row] = await db.select({
    reason: roomMatchIntros.reason, question: roomMatchIntros.question,
    sharedInterests: roomMatchIntros.sharedInterests,
  }).from(roomMatchIntros).where(eq(roomMatchIntros.roomId, roomId));
  return row ?? null;
}
