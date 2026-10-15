import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import AppShell from "./app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  // Middleware owns sign-in redirects. Do not query Postgres without an identity.
  if (userId && !(await hasCompletedOnboarding(userId))) {
    redirect("/onboarding");
  }
  return <AppShell>{children}</AppShell>;
}
