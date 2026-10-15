// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const deps = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), issue: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: deps.auth }));
vi.mock("@/lib/matching", () => ({ getRoomForUser: deps.access }));
vi.mock("@/server/call/ice-provider", () => ({ iceProvider: () => ({ issue: deps.issue }) }));
const { GET } = await import("@/app/api/call/ice/route");
const request = () => new NextRequest("http://localhost:3202/api/call/ice?roomId=11111111-1111-4111-8111-111111111111");
beforeEach(() => vi.resetAllMocks());
describe("room ICE authorization", () => {
  it("refuses signed-out users", async () => {
    deps.auth.mockResolvedValue({ userId: null });
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Sign in to join this call." });
  });
  it("refuses outsiders and ended rooms before issuing credentials", async () => {
    deps.auth.mockResolvedValue({ userId: "outsider" });
    deps.access.mockResolvedValue({ allowed: false, reason: "not_a_participant" });
    let res = await GET(request());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "You do not have access to this call." });
    expect(deps.issue).not.toHaveBeenCalled();
    deps.access.mockResolvedValue({ allowed: false, reason: "room_ended" });
    res = await GET(request());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "You do not have access to this call." });
    expect(deps.issue).not.toHaveBeenCalled();
    deps.access.mockResolvedValue({ allowed: true, me: { id: 7 } });
    deps.issue.mockResolvedValue({ iceServers: [{ urls: ["turn:relay.example"] }], expiresAt: 3_601_000 });
    res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ iceServers: [{ urls: ["turn:relay.example"] }], expiresAt: 3_601_000 });
    expect(deps.issue).toHaveBeenCalledWith("7");
  });
  it("rejects malformed room identifiers before accessing a room", async () => {
    deps.auth.mockResolvedValue({ userId: "member" });
    const res = await GET(new NextRequest("http://localhost:3202/api/call/ice?roomId=not-a-room"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Invalid call room." });
    expect(deps.access).not.toHaveBeenCalled();
  });
  it("returns a generic error when the credential provider fails", async () => {
    deps.auth.mockResolvedValue({ userId: "member" });
    deps.access.mockResolvedValue({ allowed: true, me: { id: 7 } });
    deps.issue.mockRejectedValue(new Error("private provider details"));
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ message: "The call service could not prepare network access." });
  });
});
