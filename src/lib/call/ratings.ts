import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { callRatings, rooms, users } from "@/db/schema";

const ratingInput = z
  .object({
    roomId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
  })
  .strict();

export type RatingResult =
  | { success: true }
  | { success: false; error: string };

/** Membership survives room closure so both people can finish and retry Done. */
export async function getCallParticipantId(
  clerkUserId: string,
  roomId: string,
): Promise<number | null> {
  if (!z.string().uuid().safeParse(roomId).success) return null;
  const [participant] = await db
    .select({ id: users.id })
    .from(rooms)
    .innerJoin(
      users,
      or(eq(rooms.user1Id, users.id), eq(rooms.user2Id, users.id)),
    )
    .where(and(eq(rooms.id, roomId), eq(users.clerkId, clerkUserId)));
  return participant?.id ?? null;
}

export async function saveCallRating(
  clerkUserId: string,
  input: unknown,
): Promise<RatingResult> {
  const parsed = ratingInput.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Choose a rating from 1 to 5 for this call.",
    };
  const { roomId, rating } = parsed.data;
  const userId = await getCallParticipantId(clerkUserId, roomId);
  if (userId === null)
    return { success: false, error: "Only participants can rate this call." };

  // A retried Done updates the person's row instead of duplicating feedback.
  await db
    .insert(callRatings)
    .values({ roomId, userId, rating })
    .onConflictDoUpdate({
      target: [callRatings.roomId, callRatings.userId],
      set: { rating, updatedAt: new Date() },
    });
  return { success: true };
}
