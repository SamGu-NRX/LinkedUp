// src/app/onboarding/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Onboarding exit gate. Completion lives in Postgres
 * (users.onboarding_complete), not Clerk metadata, so a user who has
 * already finished onboarding is sent straight to /app instead of seeing
 * the wizard again.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) {
    const record = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (record?.onboardingComplete) {
      redirect("/app");
    }
  }

  return <>{children}</>;
}
