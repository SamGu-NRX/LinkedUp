// src/app/onboarding/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import FinishingSetup from "./FinishingSetup";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (userId) {
    const record = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (record?.onboardingComplete) {
      if (sessionClaims?.metadata?.onboardingComplete === true) redirect("/app");
      return <FinishingSetup />;
    }
  }

  return <>{children}</>;
}
