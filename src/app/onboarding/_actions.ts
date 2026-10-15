// src/app/onboarding/_actions.ts
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, interests } from "@/db/schema";
import { OnboardingFormData } from "@/schemas/onboarding";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

/**
 * Save the wizard, then mark the person onboarded. Order matters because
 * two gates read "onboarded": the app's layout reads users.onboarding_complete
 * and the middleware reads Clerk's publicMetadata.onboardingComplete.
 *   1. profile and interests, in one transaction (the flag untouched);
 *   2. Clerk's metadata;
 *   3. users.onboarding_complete, last.
 * A failure at any step leaves the database flag unset, so the app keeps
 * the person on /onboarding and a resubmit repeats every step (each is
 * idempotent). Marking the database first, as before, could let someone
 * into the app with no interests saved or with Clerk never told.
 */
export async function saveUserOnboardingData(data: OnboardingFormData) {
  const { userId } = await auth();

  if (!userId) {
    return { error: "No logged in user" };
  }

  const client = await clerkClient();

  try {
    const userDetails = await client.users.getUser(userId);
    const email = userDetails.emailAddresses[0]?.emailAddress;

    if (!email) {
      return { error: "User email not found" };
    }

    // 1. Profile and interests. Names come from the Clerk profile, not the
    //    wizard. A new row starts not onboarded (the column default).
    const profile = {
      firstName: userDetails.firstName,
      lastName: userDetails.lastName,
      age: data.age,
      gender: data.gender,
      field: data.field,
      jobTitle: data.jobTitle,
      company: data.company,
      linkedinUrl: data.linkedinUrl,
      bio: data.bio,
    };
    await db.transaction(async (tx) => {
      const [userRecord] = await tx
        .insert(users)
        .values({ clerkId: userId, email, ...profile })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: {
            ...profile,
            firstName: userDetails.firstName ?? undefined,
            lastName: userDetails.lastName ?? undefined,
            updatedAt: new Date(),
          },
        })
        .returning({ id: users.id });

      await tx.delete(interests).where(eq(interests.userId, userRecord.id));
      if (data.interests.length > 0) {
        await tx.insert(interests).values(
          data.interests.map((interest) => ({
            userId: userRecord.id,
            name: interest.name,
            category: interest.category,
            iconName: interest.iconName,
            customId: interest.id,
          })),
        );
      }
    });

    // 2. Clerk's claim, read by the middleware.
    await client.users.updateUser(userId, {
      publicMetadata: {
        ...userDetails.publicMetadata,
        onboardingComplete: true,
      },
    });

    // 3. The app's own flag, last.
    await db
      .update(users)
      .set({ onboardingComplete: true, updatedAt: new Date() })
      .where(eq(users.clerkId, userId));

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    console.error("Error saving onboarding data:", error);
    return { error: "Failed to save onboarding data" };
  }
}

// Only a completed database profile may repair the middleware's Clerk claim.
export async function refreshOnboardingMetadata() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  const record = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
  if (!record?.onboardingComplete) return { success: false, error: "Profile is not complete" };
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    await client.users.updateUser(userId, {
      publicMetadata: { ...user.publicMetadata, onboardingComplete: true },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update sign-in" };
  }
}
