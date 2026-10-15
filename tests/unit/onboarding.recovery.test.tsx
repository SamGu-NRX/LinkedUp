import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ claim: false }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: "finished",
    sessionClaims: { metadata: { onboardingComplete: state.claim } },
  }),
}));
vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: async () => ({ onboardingComplete: true }) } },
  },
}));
import Layout from "@/app/onboarding/layout";
import FinishingSetup from "@/app/onboarding/FinishingSetup";
describe("finished onboarding gate", () => {
  it("renders token recovery when the database is complete but the claim is absent", async () => {
    state.claim = false;
    const result = await Layout({ children: "wizard" });
    expect(result.type).toBe(FinishingSetup);
  });
  it("redirects to app only when the presented claim is complete too", async () => {
    state.claim = true;
    await expect(Layout({ children: "wizard" })).rejects.toMatchObject({
      digest: expect.stringContaining("/app"),
    });
  });
});
