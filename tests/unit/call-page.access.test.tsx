/**
 * Page-level access witnesses for /app/call/[id].
 *
 * The route's access control lives in src/app/app/call/[id]/page.tsx: it
 * resolves the Clerk session itself and consults the server-side membership
 * check (getRoomForUser) before any call surface renders. The middleware is
 * RESERVED and cannot be relied on for room-level authorization, so these
 * tests pin the page's own behavior:
 *   - signed-out visitors are refused honestly (never reach the room lookup);
 *   - a signed-in non-participant is refused with a truthful reason;
 *   - an ended room is refused with a truthful reason;
 *   - only the two room participants reach the call screen, and the
 *     participants passed down are exactly the ones the access record
 *     derived from the room row (never invented client-side).
 *
 * The matching module is mocked at the seam; its real membership logic is
 * witnessed against the real database in call-room.access.db.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authMock, getRoomForUserMock, callScreenClientMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getRoomForUserMock: vi.fn(),
  callScreenClientMock: vi.fn(() => null),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

vi.mock("@/lib/matching", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRoomForUser: getRoomForUserMock,
}));

vi.mock("@/lib/call/transport", () => ({ CallScreenClient: callScreenClientMock }));

const { default: CallPage } = await import("@/app/app/call/[id]/page");

async function renderCallPage(id = "room-1") {
  const element = await CallPage({ params: Promise.resolve({ id }) });
  return render(element);
}

const me = { id: 1, clerkId: "clerk_me", email: "me@example.com", firstName: "Me" };
const partner = { id: 2, clerkId: "clerk_partner", email: "partner@example.com", firstName: "Partner" };

function allowedAccess() {
  return {
    allowed: true as const,
    room: { id: "room-1", queueType: "casual", status: "active", user1Id: 1, user2Id: 2 },
    me,
    partner,
  };
}

describe("CallPage access control (page-level witnesses)", () => {
  beforeEach(() => {
    authMock.mockReset();
    getRoomForUserMock.mockReset();
    callScreenClientMock.mockClear();
  });

  it("refuses a signed-out visitor honestly and never touches the room lookup", async () => {
    authMock.mockResolvedValue({ userId: null });

    await renderCallPage();

    expect(getRoomForUserMock).not.toHaveBeenCalled();
    const refusal = document.querySelector("[data-call-refusal]");
    expect(refusal?.getAttribute("data-refusal-reason")).toBe("signed_out");
    expect(screen.getByText("Sign in to open this call")).toBeTruthy();
    // The path back: sign in (not a silent bounce into /app).
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/sign-in");
    expect(callScreenClientMock).not.toHaveBeenCalled();
  });

  it("refuses a signed-in non-participant through the server-side membership check", async () => {
    authMock.mockResolvedValue({ userId: "clerk_neighbor" });
    getRoomForUserMock.mockResolvedValue({ allowed: false, reason: "not_a_participant" });

    await renderCallPage("room-1");

    // The page consults the real membership check with the caller's id.
    expect(getRoomForUserMock).toHaveBeenCalledTimes(1);
    expect(getRoomForUserMock).toHaveBeenCalledWith("clerk_neighbor", "room-1");
    const refusal = document.querySelector("[data-call-refusal]");
    expect(refusal?.getAttribute("data-refusal-reason")).toBe("not_a_participant");
    expect(screen.getByText("You're not in this call")).toBeTruthy();
    expect(callScreenClientMock).not.toHaveBeenCalled();
  });

  it("refuses a participant of an ended room with the truthful reason", async () => {
    authMock.mockResolvedValue({ userId: "clerk_me" });
    getRoomForUserMock.mockResolvedValue({ allowed: false, reason: "room_ended" });

    await renderCallPage("room-1");

    const refusal = document.querySelector("[data-call-refusal]");
    expect(refusal?.getAttribute("data-refusal-reason")).toBe("room_ended");
    expect(screen.getByText("This call has ended")).toBeTruthy();
    expect(callScreenClientMock).not.toHaveBeenCalled();
  });

  it("renders the call screen only for the room record's participants, passing the access record through", async () => {
    authMock.mockResolvedValue({ userId: "clerk_me" });
    const access = allowedAccess();
    getRoomForUserMock.mockResolvedValue(access);

    await renderCallPage("room-1");

    expect(callScreenClientMock).toHaveBeenCalledTimes(1);
    // Participants come from the access record (room row), verbatim.
    expect(callScreenClientMock.mock.calls[0][0]).toEqual({ access });
  });
});
