// src/app/onboarding/_actions.ts
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, interests } from "@/db/schema";
import { OnboardingFormData } from "@/schemas/onboarding";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function saveUserOnboardingData(data: OnboardingFormData) {
  const { userId } = await auth();

  if (!userId) {
    return { error: "No logged in user" };
  }

  const client = await clerkClient();

  try {
    // 1. Check if user exists in our database
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, userId),
    });

    // 2. Get user email from Clerk
    const userDetails = await client.users.getUser(userId);
    const email = userDetails.emailAddresses[0]?.emailAddress;

    if (!email) {
      return { error: "User email not found" };
    }

    // 3. If user exists, update; otherwise, create. Names come from the
    //    Clerk profile, not the wizard. Clerk's onboardingComplete
    //    metadata is written only after persistence succeeds (step 4).
    let userRecord;
    if (existingUser) {
      [userRecord] = await db
        .update(users)
        .set({
          firstName: userDetails.firstName ?? existingUser.firstName,
          lastName: userDetails.lastName ?? existingUser.lastName,
          age: data.age,
          gender: data.gender,
          field: data.field,
          jobTitle: data.jobTitle,
          company: data.company,
          linkedinUrl: data.linkedinUrl,
          bio: data.bio,
          onboardingComplete: true,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, userId))
        .returning();
    } else {
      [userRecord] = await db
        .insert(users)
        .values({
          clerkId: userId,
          email,
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          age: data.age,
          gender: data.gender,
          field: data.field,
          jobTitle: data.jobTitle,
          company: data.company,
          linkedinUrl: data.linkedinUrl,
          bio: data.bio,
          onboardingComplete: true,
        })
        .returning();
    }

    // 4. Persist success flag in Clerk metadata (after DB writes).
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
      },
    });

    // 5. Clear existing interests (if updating)
    if (existingUser) {
      await db.delete(interests).where(eq(interests.userId, existingUser.id));
    }

    // 6. Save interests
    if (data.interests.length > 0) {
      await db.insert(interests).values(
        data.interests.map((interest) => ({
          userId: userRecord.id,
          name: interest.name,
          category: interest.category,
          iconName: interest.iconName,
          customId: interest.id,
        })),
      );
    }

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    console.error("Error saving onboarding data:", error);
    return { error: "Failed to save onboarding data" };
  }
}
