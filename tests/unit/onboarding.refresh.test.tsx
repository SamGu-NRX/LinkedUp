import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  metadata: vi.fn(),
  signedIn: true,
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: mocks.signedIn,
    getToken: mocks.getToken,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/app/onboarding/_actions", () => ({
  refreshOnboardingMetadata: mocks.metadata,
}));
import FinishingSetup, {
  tokenHasCompletedOnboarding,
} from "@/app/onboarding/FinishingSetup";
const jwt = (payload: unknown) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.signedIn = true;
  mocks.metadata.mockResolvedValue({ success: true });
});
describe("onboarding token recovery", () => {
  it("waits for fresh claim before navigation", async () => {
    let resolve!: (token: string) => void;
    mocks.getToken.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    render(<FinishingSetup />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updating your sign-in",
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () =>
      resolve(jwt({ metadata: { onboardingComplete: true } })),
    );
    expect(mocks.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(mocks.replace).toHaveBeenCalledWith("/app");
  });
  it("stays on recovery when customization is missing, and retry can finish", async () => {
    mocks.getToken
      .mockResolvedValueOnce(jwt({ metadata: {} }))
      .mockResolvedValueOnce(jwt({ metadata: { onboardingComplete: true } }));
    render(<FinishingSetup />);
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sign-in setup is not ready yet",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Try again" })),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/app");
  });
  it("offers a retry after token refresh fails", async () => {
    mocks.getToken.mockRejectedValue(new Error("offline"));
    render(<FinishingSetup />);
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Check your connection",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("offers sign-in when the session disappears before hydration", async () => {
    mocks.signedIn = false;
    render(<FinishingSetup />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sign in again",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(mocks.metadata).not.toHaveBeenCalled();
  });
  it("rejects malformed and false claims", () => {
    expect(
      tokenHasCompletedOnboarding(
        jwt({ metadata: { onboardingComplete: true } }),
      ),
    ).toBe(true);
    for (const value of [
      null,
      "bad",
      jwt({ metadata: { onboardingComplete: "true" } }),
      jwt({ metadata: { onboardingComplete: false } }),
    ]) {
      expect(tokenHasCompletedOnboarding(value)).toBe(false);
    }
  });
});
