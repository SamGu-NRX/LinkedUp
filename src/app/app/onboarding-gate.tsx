// src/app/app/onboarding-gate.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * DB-backed onboarding gate for the whole /app tree.
 *
 * Onboarding completion lives in Postgres (users.onboarding_complete), not
 * in Clerk metadata, so the check happens here — a server component with
 * direct DB access — instead of in middleware.
 *
 * Rules:
 * - signed in but no user row (or onboarding not complete) → /onboarding
 * - everyone else passes through
 */
export async function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) {
    const record = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!record || !record.onboardingComplete) {
      redirect("/onboarding");
    }
  }

  return <>{children}</>;
}
