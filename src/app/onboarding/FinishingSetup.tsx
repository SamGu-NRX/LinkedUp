"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { refreshOnboardingMetadata } from "./_actions";

const completionClaim = z.object({
  metadata: z.object({ onboardingComplete: z.literal(true) }),
});

export function tokenHasCompletedOnboarding(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    return completionClaim.safeParse(
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))),
    ).success;
  } catch {
    return false;
  }
}

export default function FinishingSetup() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<
    "refreshing" | "missing-claim" | "error"
  >("refreshing");
  const started = useRef(false);
  const signedOut = isLoaded && !isSignedIn;
  const refresh = useCallback(async () => {
    setStatus("refreshing");
    try {
      const result = await refreshOnboardingMetadata();
      if (!result.success) throw new Error(result.error);
      // Middleware reads this claim. Navigating with an old or uncustomized
      // token would send this person straight back to onboarding.
      const token = await getToken({ skipCache: true });
      if (!tokenHasCompletedOnboarding(token)) {
        setStatus("missing-claim");
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }, [getToken, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) return;
    started.current = true;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  return (
    <main className="bg-background grid min-h-dvh place-items-center px-6 py-12">
      <section
        aria-labelledby="finishing-heading"
        className="w-full max-w-md space-y-5 text-center"
      >
        <h1
          id="finishing-heading"
          className="text-3xl font-semibold tracking-tight"
        >
          Finishing setup
        </h1>
        <p role="status" aria-live="polite" className="text-muted-foreground">
          {signedOut
            ? "Your profile is saved. Sign in again to finish setup."
            : status === "refreshing"
              ? "Your profile is saved. Updating your sign-in…"
              : status === "missing-claim"
                ? "Your profile is saved. Sign-in setup is not ready yet. Please contact support or try again shortly."
                : "Your profile is saved, but we could not update your sign-in. Check your connection and try again."}
        </p>
        {signedOut ? (
          <Button asChild className="min-h-11">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        ) : (
          status !== "refreshing" && (
            <Button className="min-h-11" onClick={() => void refresh()}>
              Try again
            </Button>
          )
        )}
      </section>
    </main>
  );
}
