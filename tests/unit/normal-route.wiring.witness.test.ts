// tests/unit/normal-route.wiring.witness.test.ts
//
// The normal-route wiring the two-browser proof (tests/e2e/normal-route.spec.ts)
// depends on the day the middleware's session claim reaches the instance:
//
//   - the NORMAL queue route (/app/smart-connection) mounts the DB-backed
//     SmartConnectionEngine — not the /app/match-queue mock;
//   - the NORMAL call room (/app/call/[id] via CallRoom's defaults) signals
//     over the app's own /api/call/signal and /api/call/ice endpoints, and
//     Done ends the room and returns to the app.
//
// These hold TODAY. They are witnesses for the contract: if someone rewires
// the normal pages away from the real engine or the app's own endpoints, the
// proof's "route: normal" mode would silently test something else.
//
// Mock boundary: @/lib/matching is mocked at the seam (the real db layer is
// unwitnessed here — see call-room.access.db.test.ts), as are the client
// components; everything asserted below is the PAGES' own wiring. The pages
// are async server components: awaiting them yields the React element whose
// type and props ARE the wiring (the pattern call-page.access.test.tsx uses).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomAccess } from "@/lib/matching";

const { authMock, getRoomForUserMock, callScreenClientMock, engineMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getRoomForUserMock: vi.fn<(clerkUserId: string, roomId: string) => Promise<unknown>>(),
  callScreenClientMock: vi.fn<(props: Record<string, unknown>) => null>(() => null),
  engineMock: vi.fn<(props: Record<string, unknown>) => null>(() => null),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/matching", () => ({ getRoomForUser: getRoomForUserMock }));
vi.mock("@/app/app/call/[id]/CallScreenClient", () => ({ default: callScreenClientMock }));
vi.mock("@/components/queue/SmartConnectionEngine", () => ({ default: engineMock }));
vi.mock("next/link", () => ({ default: vi.fn(() => null) }));

const { default: CallRoom } = await import("@/app/app/call/[id]/CallRoom");
const { default: SmartConnectionPage } = await import("@/app/app/smart-connection/page");

function allowedAccess(): Extract<RoomAccess, { allowed: true }> {
  return {
    allowed: true,
    roomId: "room-1",
    queueType: "casual",
    me: { id: 1, name: "Me", avatarUrl: "" },
    partner: { id: 2, name: "Partner", avatarUrl: "" },
  };
}

describe("normal-route wiring (the contract the two-browser proof runs on)", () => {
  beforeEach(() => {
    authMock.mockReset();
    getRoomForUserMock.mockReset();
  });

  it("the normal call room defaults to the app's own signaling, ICE, and exit wiring", async () => {
    authMock.mockResolvedValue({ userId: "user_2abc" });
    getRoomForUserMock.mockResolvedValue(allowedAccess());
    const el = (await CallRoom({ id: "room-1" })) as { type: unknown; props: Record<string, unknown> };
    expect(el.type, "the allowed branch renders the call screen").toBe(callScreenClientMock);
    expect(el.props.signalingEndpoint, "signaling over the app's own API route").toBe("/api/call/signal");
    expect(el.props.iceEndpoint, "ICE from the app's own API route").toBe("/api/call/ice");
    expect(el.props.exitHref, "Done returns to the app").toBe("/app");
  });

  it("the normal queue route renders the DB-backed engine with the requested queue type", async () => {
    const el = (await SmartConnectionPage({
      searchParams: Promise.resolve({ type: "professional" }),
    })) as { type: unknown; props: Record<string, unknown> };
    expect(el.type, "the normal queue route mounts the DB-backed engine").toBe(engineMock);
    expect(el.props).toEqual({ queueType: "professional" });
  });

  it("the normal queue route defaults to casual when the type param is absent", async () => {
    const el = (await SmartConnectionPage({
      searchParams: Promise.resolve({}),
    })) as { props: Record<string, unknown> };
    expect(el.props).toEqual({ queueType: "casual" });
  });
});
