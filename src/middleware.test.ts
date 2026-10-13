import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Captures the handler passed to clerkMiddleware so the wrapper logic can be
// driven directly, without Clerk's own middleware machinery.
const mocks = vi.hoisted(() => ({
  capturedHandler: null as
    | ((auth: unknown, req: NextRequest) => Promise<Response>)
    | null,
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((handler: unknown) => {
    mocks.capturedHandler = handler as never;
    return handler;
  }),
  createRouteMatcher: vi.fn(
    (routes: string[]) => (req: NextRequest) =>
      routes.includes(new URL(req.url).pathname),
  ),
}));

interface AuthOverrides {
  userId: string | null;
  onboardingComplete: boolean;
}

function makeAuth({ userId, onboardingComplete }: AuthOverrides) {
  const redirectToSignIn = vi.fn((opts?: { returnBackUrl?: string }) =>
    new Response(null, {
      status: 307,
      headers: { location: opts?.returnBackUrl ?? "/sign-in" },
    }),
  );
  const authFn = async () => ({
    userId,
    sessionClaims: { metadata: { onboardingComplete } },
    redirectToSignIn,
  });
  return { authFn, redirectToSignIn };
}

function makeRequest(path: string): NextRequest {
  return {
    url: `http://localhost${path}`,
    nextUrl: new URL(`http://localhost${path}`),
  } as unknown as NextRequest;
}

describe("middleware handler", () => {
  let handler: NonNullable<typeof mocks.capturedHandler>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await import("./middleware");
    handler = mocks.capturedHandler!;
  });

  it("sends signed-out users on protected routes to sign-in with a return URL", async () => {
    const req = makeRequest("/app/dashboard");
    const { authFn, redirectToSignIn } = makeAuth({
      userId: null,
      onboardingComplete: false,
    });

    const res = await handler(authFn, req);

    expect(redirectToSignIn).toHaveBeenCalledWith({ returnBackUrl: req.url });
    // The mocked redirectToSignIn echoes the return URL it receives
    expect(res.headers.get("location")).toBe(req.url);
  });

  it("lets signed-out users view public routes without redirecting", async () => {
    const req = makeRequest("/");
    const { authFn, redirectToSignIn } = makeAuth({
      userId: null,
      onboardingComplete: false,
    });

    const res = await handler(authFn, req);

    // Returning undefined is the middleware's "continue" for this path
    expect(res).toBeUndefined();
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("redirects authenticated users without completed onboarding to /onboarding", async () => {
    const req = makeRequest("/app/dashboard");
    const { authFn } = makeAuth({ userId: "user_123", onboardingComplete: false });

    const res = await handler(authFn, req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/onboarding");
  });

  it("lets authenticated, onboarded users through protected routes", async () => {
    const req = makeRequest("/app/dashboard");
    const { authFn } = makeAuth({ userId: "user_123", onboardingComplete: true });

    const res = await handler(authFn, req);

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("never redirects users already visiting /onboarding", async () => {
    const req = makeRequest("/onboarding");
    const { authFn } = makeAuth({ userId: "user_123", onboardingComplete: false });

    const res = await handler(authFn, req);

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
