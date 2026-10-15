"use server";

import { auth } from "@clerk/nextjs/server";
import { saveCallRating, type RatingResult } from "@/lib/call/ratings";

export async function saveCallRatingAction(
  input: unknown,
): Promise<RatingResult> {
  const { userId } = await auth();
  if (!userId)
    return {
      success: false,
      error: "Sign in again to save your rating, then choose Done.",
    };
  try {
    return await saveCallRating(userId, input);
  } catch {
    return {
      success: false,
      error: "Could not save your rating. Choose Done to retry.",
    };
  }
}
