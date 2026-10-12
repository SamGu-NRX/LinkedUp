// @vitest-environment node
// tests/unit/onboarding.order.db.test.ts — the onboarding action marks a
// person onboarded only after everything else it writes has landed.
//
// The database is the real stack Postgres. Clerk is a stand-in: these tests
// need Clerk to fail on demand and to report what the database looked like
// at the moment the action called it, which the keyless instance cannot do.
import "./support/use-stack-db";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { interests, users } from "@/db/schema";
import type { OnboardingFormData } from "@/schemas/onboarding";

const clerk = vi.hoisted(() => ({
  userId: "",
  updateUser: vi.fn(async (_id: string, _patch: unknown): Promise<unknown> => ({})),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerk.userId }),
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => ({
        id,
        firstName: "Order",
        lastName: "Witness",
        emailAddresses: [{ emailAddress: `${id}@witness.local` }],
      }),
      updateUser: clerk.updateUser,
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveUserOnboardingData } = await import("@/app/onboarding/_actions");

const PREFIX = "witness_onboarding_";

function form(overrides: Partial<OnboardingFormData> = {}): OnboardingFormData {
  return {
    age: 30,
    gender: "prefer-not-to-say",
    field: "Engineering",
    jobTitle: "Engineer",
    company: "Witness Co",
    linkedinUrl: undefined,
    bio: "Here to test the order of writes.",
    interests: [
      { id: "i-1", name: "Climbing", category: "sports", iconName: "Mountain" },
      { id: "i-2", name: "Jazz", category: "music", iconName: "Music" },
    ],
    ...overrides,
  };
}

async function row() {
  return db.query.users.findFirst({ where: eq(users.clerkId, clerk.userId) });
}
async function interestNames() {
  const r = await row();
  if (!r) return [];
  const rows = await db.select().from(interests).where(eq(interests.userId, r.id));
  return rows.map((i) => i.name).sort();
}

beforeEach(() => {
  clerk.userId = `${PREFIX}${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  clerk.updateUser.mockReset();
  clerk.updateUser.mockImplementation(async () => ({}));
});

afterAll(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
});

describe("onboarding marks the person complete last", () => {
  it("writes the profile and interests, then Clerk, then the database flag", async () => {
    let seenByClerk: { complete: boolean | null | undefined; interests: string[] } | null = null;
    clerk.updateUser.mockImplementation(async () => {
      seenByClerk = { complete: (await row())?.onboardingComplete, interests: await interestNames() };
      return {};
    });

    const result = await saveUserOnboardingData(form());

    expect(result).toEqual({ success: true });
    expect(clerk.updateUser).toHaveBeenCalledWith(clerk.userId, {
      publicMetadata: { onboardingComplete: true },
    });
    expect(seenByClerk, "when Clerk was told: interests saved, flag not yet set").toEqual({
      complete: false,
      interests: ["Climbing", "Jazz"],
    });
    const saved = await row();
    expect(saved?.onboardingComplete).toBe(true);
    expect(saved).toMatchObject({ age: 30, field: "Engineering", firstName: "Order" });
  });

  it("a Clerk failure leaves the person not onboarded, and a resubmit finishes", async () => {
    clerk.updateUser.mockRejectedValueOnce(new Error("clerk unavailable"));
    const failed = await saveUserOnboardingData(form());
    expect(failed).toEqual({ error: "Failed to save onboarding data" });
    expect((await row())?.onboardingComplete, "the app gate must keep them on /onboarding").toBe(false);

    const retried = await saveUserOnboardingData(form());
    expect(retried).toEqual({ success: true });
    expect((await row())?.onboardingComplete).toBe(true);
    expect(await interestNames(), "a resubmit does not duplicate interests").toEqual(["Climbing", "Jazz"]);
  });

  it("an interest the database rejects leaves the person not onboarded and Clerk untold", async () => {
    // interests.name is varchar(100): 101 characters is refused by Postgres.
    const bad = form({ interests: [{ id: "x", name: "x".repeat(101), category: "misc" }] });
    const failed = await saveUserOnboardingData(bad);
    expect(failed).toEqual({ error: "Failed to save onboarding data" });
    expect(clerk.updateUser).not.toHaveBeenCalled();
    const r = await row();
    expect(r?.onboardingComplete ?? false).toBe(false);
  });

  it("re-onboarding replaces interests and keeps the person onboarded", async () => {
    expect(await saveUserOnboardingData(form())).toEqual({ success: true });
    const again = form({ interests: [{ id: "i-3", name: "Chess", category: "games" }] });
    expect(await saveUserOnboardingData(again)).toEqual({ success: true });
    expect(await interestNames()).toEqual(["Chess"]);
    expect((await row())?.onboardingComplete).toBe(true);
  });
});
