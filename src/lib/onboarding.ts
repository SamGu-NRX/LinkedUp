import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function hasCompletedOnboarding(clerkId: string): Promise<boolean> {
  const record = await db.query.users.findFirst({
    columns: { onboardingComplete: true },
    where: eq(users.clerkId, clerkId),
  });
  // Missing rows and nullable legacy values still need onboarding.
  return record?.onboardingComplete === true;
}
