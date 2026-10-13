// src/app/onboarding/_actions.ts
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, interests } from "@/db/schema";
import { onboardingSchema, type OnboardingFormData } from "@/schemas/onboarding";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

interface SaveResult {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Persist onboarding data.
 *
 * Ordering matters: the database is written FIRST and the Clerk
 * `onboardingComplete` metadata is written LAST, so the middleware never
 * treats onboarding as complete unless every write succeeded. If the Clerk
 * metadata write fails after the DB rows landed, a retry of this action
 * takes the update path and is self-healing.
 *
 * Returns { success: true }, or { error } / { error, fieldErrors } on
 * failure — never throws to the client.
 */
export async function saveUserOnboardingData(
  data: OnboardingFormData,
): Promise<SaveResult> {
  const { userId } = await auth();

  if (!userId) {
    return { error: "No logged in user" };
  }

  // Validate before touching any store — the form uses react-hook-form
  // with the same schema, but server actions are an open network boundary.
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { error: "Please review the highlighted fields", fieldErrors };
  }

  const formData = parsed.data;

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

    // 3. If user exists, update; otherwise, create (metadata not yet set —
    //    the user stays in onboarding until every write below succeeds)
    let userRecord;
    if (existingUser) {
      [userRecord] = await db
        .update(users)
        .set({
          age: formData.age,
          gender: formData.gender,
          field: formData.field,
          jobTitle: formData.jobTitle,
          company: formData.company,
          linkedinUrl: formData.linkedinUrl,
          bio: formData.bio,
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
          age: formData.age,
          gender: formData.gender,
          field: formData.field,
          jobTitle: formData.jobTitle,
          company: formData.company,
          linkedinUrl: formData.linkedinUrl,
          bio: formData.bio,
          onboardingComplete: true,
        })
        .returning();
    }

    // 4. Clear existing interests (if updating)
    if (existingUser) {
      await db.delete(interests).where(eq(interests.userId, existingUser.id));
    }

    // 5. Save interests
    if (formData.interests.length > 0) {
      await db.insert(interests).values(
        formData.interests.map((interest) => ({
          userId: userRecord.id,
          name: interest.name,
          category: interest.category,
          iconName: interest.iconName,
          customId: interest.id,
        })),
      );
    }

    // 6. Mark onboarding complete in Clerk — LAST, so a failure above
    //    leaves the middleware sending the user back to onboarding and a
    //    retry can repair the partial state.
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
      },
    });

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    console.error("Error saving onboarding data:", error);
    return {
      error:
        "We couldn't save your profile. Nothing was marked complete — please try again.",
    };
  }
}
