// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in", "/sign-up"]);

/**
 * Session gate only. Whether a signed-in user has finished onboarding is
 * owned by Postgres (users.onboarding_complete), not Clerk publicMetadata —
 * the app never writes that claim, so gating on it here bounced completed
 * users into an /onboarding loop. The DB-backed gate lives in
 * src/app/app/onboarding-gate.tsx (for /app/**) and the /onboarding layout.
 */
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, redirectToSignIn } = await auth();

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
