// tests/unit/gate-proof.route.test.tsx
//
// PASSING PROOF ROUTE TESTS — the DB-backed onboarding gate, independent of
// the reserved middleware's Clerk claim (see
// middleware.onboarding-loop.witness.test.ts for the loop itself).
//
// These exercise the REAL gate component
// (src/app/app/onboarding-gate.tsx) exactly the way the labelled
// /gate-proof route renders it: the route's element tree is resolved and
// executed, so the production composition — GateProofPage -> OnboardingGate
// -> panel — is what runs. Clerk's auth() and the Postgres layer are stood
// in for (no Clerk instance, no database); the gate's own decision logic —
// including the redirect() side effect, asserted through Next's
// NEXT_REDIRECT digest — is the code under test, unmocked.
//
// The /gate-proof route is a labelled fixture: NOT under /demo, NOT a
// reserved file.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactElement, ReactNode } from "react";

const { findFirst, authState } = vi.hoisted(() => ({
  findFirst: vi.fn<() => Promise<unknown>>(),
  authState: { userId: null as string | null },
}));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    auth: async () => ({ userId: authState.userId }),
  };
});

vi.mock("@/db", () => ({
  db: { query: { users: { findFirst } } },
}));

import GateProofPage from "@/app/gate-proof/page";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import OnboardingLayout from "@/app/onboarding/layout";

/** Execute the route's real element tree the way server rendering would:
 * resolve the page's element (whose type must be the DB-backed gate) and
 * await it with the page's own props. */
async function renderGateProof(): Promise<ReactElement> {
  const pageElement = GateProofPage() as ReactElement<{
    children: ReactNode;
  }>;
  expect(pageElement.type).toBe(OnboardingGate);
  const gate = pageElement.type as unknown as typeof OnboardingGate;
  return (await gate(pageElement.props)) as ReactElement;
}

/** Capture the redirect a Next server component raises instead of returning. */
async function caughtRedirect(
  run: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    expect(digest).toContain("NEXT_REDIRECT");
    return digest;
  }
}

describe("gate-proof route: DB-backed gate through the labelled /gate-proof fixture (not under /demo)", () => {
  it("a signed-in user whose DB row says onboardingComplete passes the gate and sees the labelled panel", async () => {
    authState.userId = "user_db_complete";
    findFirst.mockResolvedValueOnce({ id: 1, onboardingComplete: true });
    const tree = await renderGateProof();
    render(tree);
    expect(screen.getByTestId("gate-proof-passed")).toBeInTheDocument();
    expect(
      screen.getByText(/fixture for the DB-backed onboarding gate/i),
    ).toBeInTheDocument();
  });

  it("a signed-in user with NO user row is redirected to /onboarding by the DB-backed gate", async () => {
    authState.userId = "user_no_row";
    findFirst.mockResolvedValueOnce(undefined);
    const digest = await caughtRedirect(() => renderGateProof());
    expect(digest).toContain("/onboarding");
  });

  it("a signed-out visitor sees the panel without the gate touching the database", async () => {
    authState.userId = null;
    findFirst.mockClear();
    const tree = await renderGateProof();
    render(tree);
    expect(screen.getByTestId("gate-proof-panel")).toBeInTheDocument();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("the onboarding layout keeps DB-complete users on recovery until their session claim is ready", async () => {
    authState.userId = "user_db_complete";
    findFirst.mockResolvedValueOnce({ id: 1, onboardingComplete: true });
    const digest = await caughtRedirect(() =>
      OnboardingLayout({ children: null }),
    );
    expect(digest).toBeNull();
  });
});
