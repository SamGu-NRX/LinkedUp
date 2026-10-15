import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createP2PTransport } from "@/lib/call/transports/p2p/p2p-transport";
import type { CallPhase, CallTransport } from "@/lib/call/transport";
import type { SignalingHandlers } from "@/lib/call/transports/p2p/signaling";

class Track extends EventTarget {
  id = "remote-audio";
  kind = "audio";
  muted = true;
  readyState = "live";
  receive() {
    this.muted = false;
    this.dispatchEvent(new Event("unmute"));
  }
  loseMedia() {
    this.muted = true;
    this.dispatchEvent(new Event("mute"));
  }
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}
class Stream {
  tracks: Track[] = [];
  getTracks() {
    return this.tracks;
  }
  getTrackById(id: string) {
    return this.tracks.find((track) => track.id === id);
  }
  addTrack(track: Track) {
    this.tracks.push(track);
  }
  removeTrack(track: Track) {
    this.tracks = this.tracks.filter((old) => old !== track);
  }
}
class PeerConnection {
  static instances: PeerConnection[] = [];
  connectionState = "new";
  signalingState = "stable";
  ontrack: ((event: { track: Track }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() {
    PeerConnection.instances.push(this);
  }
  restartIce() {}
  close() {
    this.connectionState = "closed";
  }
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }
  disconnect() {
    this.connectionState = "disconnected";
    this.onconnectionstatechange?.();
  }
}
let transport: CallTransport;
let handlers: SignalingHandlers;
let phases: CallPhase[];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("RTCPeerConnection", PeerConnection);
  vi.stubGlobal("MediaStream", Stream);
  PeerConnection.instances = [];
  phases = [];
  transport = createP2PTransport({
    signaling: {
      open(_session, callbacks) {
        handlers = callbacks;
        return { send() {}, publishState() {}, close() {} };
      },
    },
  });
  await transport.connect(
    {
      meetingId: "room",
      selfId: "a",
      identityToken: async () => "token",
      getLocalStream: () => null,
    },
    {
      onPhase: (phase) => phases.push(phase),
      onRemoteJoined() {},
      onRemoteLeft() {},
      onRemoteStream() {},
      onRemoteState() {},
      onError() {},
    },
  );
});
afterEach(async () => {
  await transport.leave();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("connected requires incoming media", () => {
  it("keeps an empty welcome and a late peer joining, then fails if media never arrives", () => {
    handlers.onWelcome([]);
    expect(phases.at(-1)).toBe("joining");
    handlers.onPeerJoined("b");
    PeerConnection.instances[0].connect();
    expect(phases.at(-1)).toBe("joining");
    vi.advanceTimersByTime(30_000);
    expect(phases.at(-1)).toBe("failed");
  });

  it("waits for a muted remote track to unmute before declaring connected", () => {
    handlers.onWelcome(["b"]);
    const peer = PeerConnection.instances[0];
    peer.connect();
    const track = new Track();
    peer.ontrack?.({ track });
    expect(phases.at(-1)).toBe("joining");
    track.receive();
    expect(phases.at(-1)).toBe("connected");
    handlers.onPeerLeft("b", "left");
    expect(phases.at(-1)).toBe("reconnecting");
  });

  it("accepts media already unmuted when ontrack fires, but still needs the peer connection", () => {
    handlers.onWelcome(["b"]);
    const peer = PeerConnection.instances[0];
    const track = new Track();
    track.muted = false;
    peer.ontrack?.({ track });
    expect(phases.at(-1)).toBe("joining");
    peer.connect();
    expect(phases.at(-1)).toBe("connected");
  });

  it("reports a network interruption and recovers the established peer", () => {
    handlers.onWelcome(["b"]);
    const peer = PeerConnection.instances[0];
    const track = new Track();
    peer.ontrack?.({ track });
    peer.connect();
    track.receive();
    expect(phases.at(-1)).toBe("connected");
    peer.disconnect();
    track.loseMedia();
    expect(phases.at(-1)).toBe("reconnecting");
    peer.connect();
    expect(phases.at(-1)).toBe("connected");
  });

  it("keeps an established call connected when mute controls stop remote media", () => {
    handlers.onWelcome(["b"]);
    const peer = PeerConnection.instances[0];
    const track = new Track();
    peer.connect();
    peer.ontrack?.({ track });
    track.receive();
    expect(phases.at(-1)).toBe("connected");
    track.end();
    expect(phases.at(-1)).toBe("connected");
    peer.disconnect();
    expect(phases.at(-1)).toBe("reconnecting");
  });

  it("ignores an unmute from a track replaced before it received media", () => {
    handlers.onWelcome(["b"]);
    const peer = PeerConnection.instances[0];
    peer.connect();
    const oldTrack = new Track();
    peer.ontrack?.({ track: oldTrack });
    const replacement = new Track();
    replacement.id = "replacement-audio";
    peer.ontrack?.({ track: replacement });
    oldTrack.receive();
    expect(phases.at(-1)).toBe("joining");
    replacement.receive();
    expect(phases.at(-1)).toBe("connected");
  });

  it("ignores departed tracks and waits for the returning peer's media", () => {
    handlers.onWelcome(["b"]);
    const oldPeer = PeerConnection.instances[0];
    const oldTrack = new Track();
    oldPeer.connect();
    oldPeer.ontrack?.({ track: oldTrack });
    oldTrack.receive();
    expect(phases.at(-1)).toBe("connected");
    handlers.onPeerLeft("b", "left");
    handlers.onPeerJoined("b");
    PeerConnection.instances[1].connect();
    oldTrack.receive();
    expect(phases.at(-1)).toBe("reconnecting");
    const newTrack = new Track();
    PeerConnection.instances[1].ontrack?.({ track: newTrack });
    newTrack.receive();
    expect(phases.at(-1)).toBe("connected");
  });
});
