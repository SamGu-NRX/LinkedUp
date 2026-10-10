import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OnboardingFormData } from "@/schemas/onboarding";

// Provider mocks hoisted so vi.mock factories can reach them.
const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  getUser: vi.fn(),
  auth: vi.fn(),
  findFirst: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: vi.fn(async () => ({
    users: { updateUser: mocks.updateUser, getUser: mocks.getUser },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

// Drizzle chain stubs: every builder returns the next link; returning() ends
// the chain with rows.
function chain(rows: unknown[]) {
  const returning = vi.fn(async () => rows);
  mocks.insert.mockImplementation(() => ({ values: () => ({ returning }) }));
  mocks.update.mockImplementation(() => ({ set: () => ({ where: () => ({ returning }) }) }));
  mocks.delete.mockImplementation(() => ({ where: () => ({ where: () => ({ returning }) }) }));
  return returning;
}

vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
  },
}));

import { saveUserOnboardingData } from "@/app/onboarding/_actions";

const validData: OnboardingFormData = {
  age: 25,
  gender: "male",
  field: "software",
  jobTitle: "Engineer",
  company: "Acme",
  linkedinUrl: undefined,
  bio: "A bio long enough to pass validation.",
  interests: [
    { id: "programming", name: "Programming", category: "Tech", iconName: "Code" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_123" });
  mocks.getUser.mockResolvedValue({
    emailAddresses: [{ emailAddress: "sam@example.com" }],
  });
  mocks.findFirst.mockResolvedValue(null);
  mocks.updateUser.mockResolvedValue({});
  chain([{ id: 1 }]);
});

describe("saveUserOnboardingData", () => {
  it("returns an error and writes nothing when unauthenticated", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await saveUserOnboardingData(validData);

    expect(result.error).toBeDefined();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload with field errors and performs no writes", async () => {
    const badData = { ...validData, age: 12 } as OnboardingFormData;

    const result = await saveUserOnboardingData(badData);

    expect(result.error).toBeDefined();
    expect(result.fieldErrors?.age).toBeDefined();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("creates the user, saves interests, then sets Clerk metadata LAST", async () => {
    const result = await saveUserOnboardingData(validData);

    expect(result.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.updateUser).toHaveBeenCalledWith("user_123", {
      publicMetadata: { onboardingComplete: true },
    });
    // Metadata write happens after every database write
    const insertOrder = mocks.insert.mock.invocationCallOrder[0];
    const metadataOrder = mocks.updateUser.mock.invocationCallOrder[0];
    expect(metadataOrder).toBeGreaterThan(insertOrder);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("returns an error and never marks onboarding complete when the database write fails", async () => {
    mocks.findFirst.mockRejectedValue(new Error("connection refused"));

    const result = await saveUserOnboardingData(validData);

    expect(result.error).toBeDefined();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("on the update path clears old interests before re-inserting them", async () => {
    mocks.findFirst.mockResolvedValue({ id: 7, clerkId: "user_123" });

    const result = await saveUserOnboardingData(validData);

    expect(result.success).toBe(true);
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.delete).toHaveBeenCalled();
    const deleteOrder = mocks.delete.mock.invocationCallOrder[0];
    const insertOrder = mocks.insert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });
});
