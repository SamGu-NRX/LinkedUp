// Middleware still sends missing-claim users to onboarding. The onboarding
// recovery tests prove the destination now renders instead of redirecting back.
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

describe("reserved middleware onboarding claim gate", () => {
  it(
    "sends missing-claim users to the stable onboarding recovery destination",
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
      expect(res.status).toBe(307);
      expect(location).toBe("http://localhost:3000/onboarding");
    },
  );
});
