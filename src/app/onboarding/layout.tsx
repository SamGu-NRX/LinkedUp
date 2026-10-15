// src/app/onboarding/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId && (await hasCompletedOnboarding(userId))) {
    redirect("/app");
  }

  return <>{children}</>;
}
