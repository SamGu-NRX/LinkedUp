import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createP2PTransport } from "@/lib/call/transports/p2p/p2p-transport";
import { IceAccessError } from "@/lib/call/ice-config";
import type { TransportEvents } from "@/lib/call/transport";
import type { P2PSignal, SignalingHandlers } from "@/lib/call/transports/p2p/signaling";

class PeerConnection {
  static instances: PeerConnection[] = [];
  connectionState = "new";
  iceConnectionState = "new";
  signalingState = "stable";
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  config: RTCConfiguration;
  restarts = 0;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription = { toJSON: () => ({ type: "answer" as const, sdp: "answer" }) };
  configAtAnswer: RTCConfiguration | null = null;
  async setRemoteDescription(description: RTCSessionDescriptionInit) { this.remoteDescription = description; }
  async setLocalDescription() { this.configAtAnswer = this.config; }
  constructor(config: RTCConfiguration) { this.config = config; PeerConnection.instances.push(this); }
  getConfiguration() { return this.config; }
  setConfiguration(config: RTCConfiguration) { this.config = config; }
  restartIce() { this.restarts++; }
  close() { this.connectionState = "closed"; }
  getStats() { return Promise.resolve(new Map()); }
}

const context = { meetingId: "room", selfId: "z", identityToken: async () => "", getLocalStream: () => null };
function setup(getRtcConfig: () => Promise<RTCConfiguration>) {
  let handlers: SignalingHandlers;
  const events: TransportEvents = { onPhase: vi.fn(), onError: vi.fn(), onRemoteJoined: vi.fn(), onRemoteLeft: vi.fn(), onRemoteStream: vi.fn(), onRemoteState: vi.fn() };
  const transport = createP2PTransport({ getRtcConfig, signaling: { open: (_session, next) => {
    handlers = next;
    return { send: vi.fn(), publishState: vi.fn(), close: vi.fn() };
  } } });
  return { transport, events, welcome: (peers: string[]) => handlers.onWelcome(peers), join: (id: string) => handlers.onPeerJoined(id), signal: (id: string, signal: P2PSignal) => handlers.onSignal(id, signal) };
}
beforeEach(() => {
  vi.useFakeTimers();
  PeerConnection.instances = [];
  vi.stubGlobal("RTCPeerConnection", PeerConnection);
  vi.stubGlobal("MediaStream", class { getTracks() { return []; } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ICE lifecycle", () => {
  it("does not offer retry after the endpoint refuses access", async () => {
    const app = setup(async () => { throw new IceAccessError("You no longer have access to this call."); });
    await app.transport.connect(context, app.events);
    expect(app.events.onPhase).toHaveBeenLastCalledWith("failed");
    expect(app.events.onError).toHaveBeenCalledWith({ kind: "auth", retryable: false, message: "You no longer have access to this call." });
    await app.transport.leave();
  });
  it("uses fetched configuration before opening a peer and refreshes on restart", async () => {
    const config = vi.fn().mockResolvedValueOnce({ iceServers: [{ urls: "turn:first" }] }).mockResolvedValue({ iceServers: [{ urls: "turn:renewed" }] });
    const app = setup(config);
    await app.transport.connect(context, app.events);
    app.welcome(["a"]);
    const peer = PeerConnection.instances[0];
    expect(peer.config.iceServers).toEqual([{ urls: "turn:first" }]);
    peer.iceConnectionState = "failed";
    peer.oniceconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(peer.config.iceServers).toEqual([{ urls: "turn:renewed" }]);
    expect(peer.restarts).toBe(1);
    await app.transport.leave();
  });
  it("refreshes credentials before answering a remote ICE restart offer", async () => {
    const config = vi.fn().mockResolvedValueOnce({ iceServers: [{ urls: "turn:first" }] }).mockResolvedValue({ iceServers: [{ urls: "turn:renewed" }] });
    const app = setup(config);
    await app.transport.connect(context, app.events);
    app.welcome(["a"]);
    const peer = PeerConnection.instances[0];
    app.signal("a", { description: { type: "offer", sdp: "restart" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(peer.remoteDescription).toEqual({ type: "offer", sdp: "restart" });
    expect(peer.configAtAnswer?.iceServers).toEqual([{ urls: "turn:renewed" }]);
    await app.transport.leave();
  });
  it("fails a newly arrived unreachable peer after restarts even when signaling was connected", async () => {
    const app = setup(async () => ({ iceServers: [{ urls: "stun:example" }] }));
    await app.transport.connect(context, app.events);
    app.welcome([]);
    app.join("a");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(app.events.onPhase).toHaveBeenLastCalledWith("failed");
    expect(app.events.onError).toHaveBeenCalledWith({ kind: "network", retryable: true, message: "Can't reach the other person. A network may be blocking calls. Try again or switch networks." });
    expect(PeerConnection.instances[0].restarts).toBeGreaterThan(0);
    expect(PeerConnection.instances[0].connectionState).toBe("closed");
    await app.transport.leave();
  });
  it("does not revive a call left while credentials were loading", async () => {
    let finish: (config: RTCConfiguration) => void = () => {};
    const app = setup(() => new Promise((resolve) => { finish = resolve; }));
    const pending = app.transport.connect(context, app.events);
    await app.transport.leave();
    finish({ iceServers: [{ urls: "turn:late" }] });
    await pending;
    expect(app.events.onPhase).toHaveBeenLastCalledWith("left");
    expect(PeerConnection.instances).toHaveLength(0);
  });
  it("turns endpoint failure into a retryable failure", async () => {
    const app = setup(async () => { throw new Error("provider unavailable"); });
    await app.transport.connect(context, app.events);
    expect(app.events.onPhase).toHaveBeenLastCalledWith("failed");
    expect(app.events.onError).toHaveBeenCalledWith({ kind: "network", retryable: true, message: "The call service could not prepare network access. Try again." });
    await app.transport.leave();
  });
});
