// The reserved middleware blocks ICE before the room route can authorize it.
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { authStub } = vi.hoisted(() => ({
  authStub: async () => ({
    userId: "user_db_onboarding_complete",
    // Keyless sessions omit this custom claim even after database onboarding.
    sessionClaims: { metadata: {} },
    redirectToSignIn: (_opts?: { returnBackUrl?: URL | string }) =>
      NextResponse.redirect(new URL("/sign-in", "http://localhost:3000")),
  }),
}));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    // Keep the actual middleware handler and route matching.
    clerkMiddleware:
      (handler: (auth: unknown, req: NextRequest) => Promise<Response>) =>
      async (req: NextRequest) =>
        handler(authStub, req),
  };
});

import middleware from "@/middleware";

describe("ICE endpoint reserved-middleware witness", () => {
  it.fails("an onboarded participant without the onboarding claim reaches the ICE route", async () => {
    // SAFETY: the mocked Clerk wrapper above returns this one-argument handler.
    const run = middleware as unknown as (req: NextRequest) => Promise<Response>;
    const response = await run(new NextRequest("http://localhost:3202/api/call/ice?roomId=11111111-1111-4111-8111-111111111111"));
    expect(response.headers.get("location")).toBeNull();
  });
});
