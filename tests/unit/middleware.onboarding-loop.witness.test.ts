// tests/unit/middleware.onboarding-loop.witness.test.ts
//
// ════════════════════════════════════════════════════════════════════════
// KNOWN-FAILING WITNESS — onboarding redirect loop. Do not "fix" this test.
// ════════════════════════════════════════════════════════════════════════
//
// The claim: src/middleware.ts:23 —
//     if (userId && !sessionClaims?.metadata?.onboardingComplete) {
// with the redirect to /onboarding at src/middleware.ts:25.
//
// The loop, end to end (every file verified on this branch):
//   1. src/middleware.ts (RESERVED, restored to alpha's version) redirects
//      a signed-in user to /onboarding unless the PRESENTED SESSION TOKEN
//      carries metadata.onboardingComplete (Clerk publicMetadata).
//   2. src/app/onboarding/layout.tsx redirects that same user BACK to /app,
//      because the DB row (users.onboarding_complete) is the source of
//      truth the DB-backed gate adopted — and it says complete.
//   3. src/app/app/onboarding-gate.tsx would pass them in /app, but the
//      middleware bounces them first. Finished users ping-pong
//      /app <-> /onboarding.
//
// Why the presented token lacks the claim even for finished users: the app
// writes publicMetadata.onboardingComplete (src/app/onboarding/_actions.ts),
// but publicMetadata reaches a session token as `metadata` only when the
// Clerk instance's session token is customized to include it. That is a
// dashboard setting; Clerk's Backend API (InstanceAPI.update) cannot set it,
// and the keyless instance the stack runs on has the default token. So the
// claim is never present, not merely stale: in the live stack a finished
// persona made 686 requests for /onboarding in 10 s and never settled
// (tests/e2e/journeys.spec.ts, the witness test). A token refresh does not
// end the loop. Whether Sam's tenant has the customization is unknown here.
//
// This witness asserts the FIXED-WORLD behavior: a signed-in user whose
// DB-backed gate says onboarding is complete must NOT be redirected to
// /onboarding by the middleware. It is marked test.fails() so the suite
// records it as known-failing. IT FLIPS WHEN SAM FIXES THE MIDDLEWARE:
// once the middleware stops gating on the Clerk claim (or the claim is
// guaranteed present in every presented token), this body will pass and
// vitest will report the test as "marked as failing but passed" — delete
// or invert the witness at that point.
//
// Observed failure (verified this branch): the middleware's own handler,
// given a signed-in auth() whose token lacks the claim, returns
// 307 with Location: http://localhost:3000/onboarding — so the
// not.toContain("/onboarding") assertion below is what throws.
//
// Mock boundary: ONLY Clerk's auth plumbing is stood in. The route
// matchers, the claim read at src/middleware.ts:23, and the redirect at
// :25 are the middleware's own code, unmocked.
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { authStub } = vi.hoisted(() => ({
  authStub: async () => ({
    userId: "user_db_onboarding_complete" as string | null,
    // The finished user's CURRENT Clerk session token: metadata carries no
    // onboardingComplete (stale token — the claim write lags the DB write,
    // and nothing backfills other tokens).
    sessionClaims: { metadata: {} } as { metadata?: Record<string, unknown> },
    redirectToSignIn: (_opts?: { returnBackUrl?: URL | string }) =>
      NextResponse.redirect(new URL("/sign-in", "http://localhost:3000")),
  }),
}));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    // Harness: hand the middleware's REAL handler a controlled auth().
    clerkMiddleware:
      (handler: (auth: unknown, req: NextRequest) => Promise<Response>) =>
      async (req: NextRequest) =>
        handler(authStub, req),
  };
});

import middleware from "@/middleware";

describe("onboarding redirect loop witness (src/middleware.ts:23)", () => {
  it.fails(
    "KNOWN-FAILING WITNESS: a DB-onboarding-complete user is still bounced to /onboarding by the claim read at src/middleware.ts:23 (redirect at :25) — flips when Sam fixes the middleware",
    async () => {
      // The real clerkMiddleware's type wants a NextFetchEvent too; the
      // handler under test never touches it (verified: the middleware body
      // only reads auth() and req.nextUrl.pathname).
      const middlewareForTest = middleware as unknown as (
        req: NextRequest,
        event?: unknown,
      ) => Promise<Response>;
      const res = await middlewareForTest(
        new NextRequest("http://localhost:3000/app"),
      );
      const location = res.headers.get("location") ?? "";
      expect(location).not.toContain("/onboarding");
    },
  );
});
