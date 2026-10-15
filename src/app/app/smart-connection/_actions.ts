// src/app/app/smart-connection/_actions.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  endRoom,
  getRoomForUser,
  queueCancel,
  queueJoin,
  queueStateForUser,
  type QueueStateForUser,
  type QueueType,
} from "@/lib/matching";
import { persistCallSummaries } from "@/lib/call/summary";

export type ActionError = { success: false; error: string };

async function currentUserDbId(): Promise<number | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const record = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  return record?.id ?? null;
}

export async function queueJoinAction(options: {
  queueType: QueueType;
}): Promise<{ success: true; result: { status: "waiting" } | { status: "matched"; roomId: string } } | ActionError> {
  const dbId = await currentUserDbId();
  if (!dbId) return { success: false, error: "Not signed in or profile missing" };
  const result = await queueJoin({ userId: dbId, queueType: options.queueType });
  return { success: true, result };
}

export async function queueLeaveAction(): Promise<{ success: true } | ActionError> {
  const dbId = await currentUserDbId();
  if (!dbId) return { success: false, error: "Not signed in or profile missing" };
  await queueCancel(dbId);
  return { success: true };
}

export async function queueStateAction(): Promise<{ success: true; state: QueueStateForUser } | ActionError> {
  const dbId = await currentUserDbId();
  if (!dbId) return { success: false, error: "Not signed in or profile missing" };
  const state = await queueStateForUser(dbId);
  return { success: true, state };
}

export async function endRoomAction(
  roomId: string,
  options: { rating?: number } = {},
): Promise<{ success: true; ended: boolean } | ActionError> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  const access = await getRoomForUser(userId, roomId);
  if (!access.allowed) return { success: false, error: access.reason };
  const dbId = await currentUserDbId();
  if (!dbId) return { success: false, error: "Not signed in or profile missing" };
  const ended = await endRoom(roomId);
  // The recap: both participants' summary rows from the real room, once each.
  // The caller's star rating (the call screen's rating control) rides along;
  // 1..5 is enforced at the control, and out-of-range values store as no
  // rating rather than a made-up one.
  const rating = options.rating && options.rating >= 1 && options.rating <= 5 ? options.rating : undefined;
  await persistCallSummaries(roomId, { ratingFor: dbId, rating });
  return { success: true, ended };
}
