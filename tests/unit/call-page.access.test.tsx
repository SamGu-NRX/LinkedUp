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
import type { RoomAccess } from "@/lib/matching";

const { authMock, getRoomForUserMock, callScreenClientMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getRoomForUserMock: vi.fn<(clerkUserId: string, roomId: string) => Promise<unknown>>(),
  callScreenClientMock: vi.fn<(props: { access: unknown }) => null>(() => null),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

// Mock the whole module: the page uses only getRoomForUser, and spreading
// importOriginal would execute the real db layer (DATABASE_URL unset at
// collection time).
vi.mock("@/lib/matching", () => ({ getRoomForUser: getRoomForUserMock }));

// The page renders ./CallScreenClient (a route-dir wrapper around
// VoiceCallScreen); mock THAT specifier so the DOM stays isolated.
vi.mock("@/app/app/call/[id]/CallScreenClient", () => ({
  default: callScreenClientMock,
}));

const { default: CallPage } = await import("@/app/app/call/[id]/page");
const { default: CallRoom } = await import("@/app/app/call/[id]/CallRoom");

// The route hands its id to CallRoom (shared with the journey-proof path);
// CallRoom is an async server component, so it is awaited, then rendered.
async function renderCallPage(id = "room-1") {
  const routed = await CallPage({ params: Promise.resolve({ id }) });
  expect(routed.type).toBe(CallRoom);
  expect(routed.props).toEqual({ id });
  return render(await CallRoom({ id }));
}

// The real allowed-branch shape from src/lib/matching.ts — the page hands
// this record to the call screen verbatim.
function allowedAccess(): Extract<RoomAccess, { allowed: true }> {
  return {
    allowed: true,
    roomId: "room-1",
    queueType: "casual",
    me: { id: 1, name: "Me", avatarUrl: "" },
    partner: { id: 2, name: "Partner", avatarUrl: "" },
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
    // The route signals through /api/call/signal and exits to /app.
    expect(callScreenClientMock.mock.calls[0][0]).toEqual({ access, signalingEndpoint: "/api/call/signal", iceEndpoint: "/api/call/ice", exitHref: "/app" });
  });
  it("passes the proof ICE tunnel through the room", async () => {
    authMock.mockResolvedValue({ userId: "clerk_me" });
    const access = allowedAccess();
    getRoomForUserMock.mockResolvedValue(access);
    render(await CallRoom({ id: "room-1", iceEndpoint: "/onboarding?journey-proof=ice" }));
    expect(callScreenClientMock.mock.calls[0][0]).toEqual({ access, signalingEndpoint: "/api/call/signal", iceEndpoint: "/onboarding?journey-proof=ice", exitHref: "/app" });
    expect(getRoomForUserMock).toHaveBeenCalledWith("clerk_me", "room-1");
  });
});
