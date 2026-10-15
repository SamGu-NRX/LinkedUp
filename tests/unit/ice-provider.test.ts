// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { iceProvider, turnRestCredential } from "@/server/call/ice-provider";
import { sessionIceConfiguration, connectionPath, fetchRoomIceConfig, IceAccessError } from "@/lib/call/ice-config";

afterEach(() => vi.unstubAllGlobals());

describe("call ICE credentials", () => {
  it("keeps endpoint access refusal distinct from a provider outage", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("", { status: 403 })).mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", request);
    await expect(fetchRoomIceConfig("room")).rejects.toBeInstanceOf(IceAccessError);
    await expect(fetchRoomIceConfig("room")).rejects.toThrow("The call service could not prepare network access. Try again.");
  });
  it("matches RFC 2202 HMAC-SHA1 test case 2", async () => {
    expect(await turnRestCredential("Jefe", "what do ya want for nothing?")).toBe("7/zfauXrL6LSdBbV8YTfnCWafHk=");
  });
  it("issues participant-bound RFC TURN REST credentials for one hour", async () => {
    const issued = await iceProvider({ TURN_SHARED_SECRET: "test-secret", TURN_URLS: "turn:127.0.0.1:3478, turns:relay.example:5349" }, () => 1_700_000_000_123).issue("member-7");
    expect(issued).toEqual({
      expiresAt: 1_700_003_600_000,
      iceServers: [{ urls: ["turn:127.0.0.1:3478", "turns:relay.example:5349"], username: "1700003600:member-7", credential: "9RDi9ydTnxIHdSXfTQU0FD3hBcw=" }],
    });
  });
  it("uses STUN only when no provider is configured and refuses partial configuration", async () => {
    expect(await iceProvider({}, () => 1000).issue("member")).toEqual({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }], expiresAt: 3_601_000 });
    expect(() => iceProvider({ TURN_CLOUDFLARE_KEY_ID: "test-id" })).toThrow("must both be set");
    expect(() => iceProvider({ TURN_SHARED_SECRET: "test-secret" })).toThrow("must both be set");
  });
  it("asks Cloudflare for one hour and never exposes a failed provider body", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ iceServers: [{ urls: "turn:relay.example:3478", username: "short", credential: "temporary" }] }), { status: 201 }));
    const provider = iceProvider({ TURN_CLOUDFLARE_KEY_ID: "test-id", TURN_CLOUDFLARE_API_TOKEN: "test-token" }, () => 1000, request);
    expect(await provider.issue("member")).toEqual({ expiresAt: 3_601_000, iceServers: [{ urls: ["turn:relay.example:3478"], username: "short", credential: "temporary" }] });
    expect(request.mock.calls[0]?.[1]?.body).toBe('{"ttl":3600}');
    request.mockResolvedValueOnce(new Response("private provider details", { status: 502 }));
    await expect(provider.issue("member")).rejects.toThrow("The call connection service refused credentials. Try again.");
  });
  it("deduplicates session fetches and refreshes before expiry", async () => {
    let now = 1000;
    const load = vi.fn().mockImplementation(async () => ({ iceServers: [{ urls: [`turn:relay.example:${load.mock.calls.length}`] }], expiresAt: now + 3_600_000 }));
    const config = sessionIceConfiguration(load, () => now);
    expect(await Promise.all([config(), config()])).toEqual([{ iceServers: [{ urls: ["turn:relay.example:1"] }] }, { iceServers: [{ urls: ["turn:relay.example:1"] }] }]);
    now += 3_570_000;
    expect(await config()).toEqual({ iceServers: [{ urls: ["turn:relay.example:2"] }] });
  });
  it("rejects expired credentials and recovers on a fresh request", async () => {
    const load = vi.fn().mockResolvedValueOnce({ iceServers: [{ urls: ["stun:stun.example"] }], expiresAt: 1000 }).mockResolvedValueOnce({ iceServers: [{ urls: ["stun:stun.example"] }], expiresAt: 3_601_000 });
    const config = sessionIceConfiguration(load, () => 1000);
    await expect(config()).rejects.toThrow("expired");
    expect(await config()).toEqual({ iceServers: [{ urls: ["stun:stun.example"] }] });
  });
  it.each(["relay", "host"])("reports %s without exposing candidate addresses", async (candidateType) => {
    const stats = new Map([
      ["transport", { type: "transport", selectedCandidatePairId: "pair" }],
      ["pair", { type: "candidate-pair", localCandidateId: "local", remoteCandidateId: "remote" }],
      ["local", { type: "local-candidate", candidateType }],
      ["remote", { type: "remote-candidate", candidateType: "host" }],
    ]);
    expect(await connectionPath({ getStats: async () => stats } as unknown as RTCPeerConnection)).toBe(candidateType === "relay" ? "relay" : "direct");
  });
});
