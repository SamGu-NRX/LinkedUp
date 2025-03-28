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
    // 1. Update Clerk metadata
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
      },
    });

    // 2. Check if user exists in our database
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, userId),
    });

    // 3. Get user email from Clerk
    const userDetails = await client.users.getUser(userId);
    const email = userDetails.emailAddresses[0]?.emailAddress;

    if (!email) {
      return { error: "User email not found" };
    }

    // 4. If user exists, update; otherwise, create
    let userRecord;
    if (existingUser) {
      [userRecord] = await db
        .update(users)
        .set({
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
