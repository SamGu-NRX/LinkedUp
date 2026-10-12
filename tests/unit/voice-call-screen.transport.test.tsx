// tests/unit/voice-call-screen.transport.test.tsx
//
// How the call screen uses the transport hook: when it asks to join, what
// phase it shows for each transport phase, what a remote tile says, and
// what a transport failure offers. The hook is replaced by a controllable
// stand-in; capture uses the same fake browser idea as the honesty suite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { CallPhase, TransportError } from "@/lib/call/transport";
import type { RemoteState } from "@/components/call/useCallTransport";

const hook = vi.hoisted(() => ({
  calls: [] as Array<{ active: boolean; micOn: boolean; cameraOn: boolean; stream: unknown }>,
  phase: "idle" as CallPhase,
  error: null as TransportError | null,
  remotes: new Map<string, RemoteState>(),
  retry: vi.fn(),
}));
vi.mock("@/components/call/useCallTransport", () => ({
  useCallTransport: (args: { active: boolean; micOn: boolean; cameraOn: boolean; stream: unknown }) => {
    hook.calls.push(args);
    return { phase: hook.phase, error: hook.error, remotes: hook.remotes, retry: hook.retry };
  },
}));

const { default: VoiceCallScreen } = await import("@/components/call/VoiceCallScreen");

class FakeTrack {
  readyState: "live" | "ended" = "live";
  constructor(readonly kind: "audio" | "video") {}
  stop() {
    this.readyState = "ended";
  }
  getSettings() {
    return { deviceId: `${this.kind}-1` };
  }
}
class FakeMediaStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
}

const participants = [
  { id: "1", name: "You", avatarUrl: "" },
  { id: "2", name: "Ada", avatarUrl: "" },
] as [{ id: string; name: string; avatarUrl: string }, { id: string; name: string; avatarUrl: string }];
const call = { roomId: "room-1", selfId: "1", signalingEndpoint: "/api/call/signal" };

function renderScreen() {
  return render(
    <VoiceCallScreen
      callType="casual"
      participants={participants}
      initialDuration={300}
      call={call}
      onDone={vi.fn()}
      onEndCall={vi.fn()}
      onExtendCall={vi.fn()}
      onToggleMute={vi.fn()}
      onRateCall={vi.fn()}
    />,
  );
}
const root = (c: HTMLElement) => c.querySelector("[data-call-root]")!;

beforeEach(() => {
  hook.calls = [];
  hook.phase = "idle";
  hook.error = null;
  hook.remotes = new Map();
  hook.retry.mockClear();
  const getUserMedia = vi.fn(async (c: MediaStreamConstraints) => {
    const tracks: FakeTrack[] = [];
    if (c.audio) tracks.push(new FakeTrack("audio"));
    if (c.video) tracks.push(new FakeTrack("video"));
    return new FakeMediaStream(tracks) as unknown as MediaStream;
  });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia, enumerateDevices: async () => [] },
    configurable: true,
  });
  vi.stubGlobal("MediaStream", FakeMediaStream);
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("joining follows capture and leaving", () => {
  it("asks to join only once capture is ready, and stops asking after Leave", async () => {
    const { container, getByTestId } = renderScreen();
    expect(hook.calls[0].active).toBe(false);
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(hook.calls.at(-1)!.active).toBe(true);
    fireEvent.click(getByTestId("leave-call"));
    expect(hook.calls.at(-1)!.active).toBe(false);
  });

  it("forwards the mic state the person chose", async () => {
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    fireEvent.click(getByTestId("toggle-mic"));
    expect(hook.calls.at(-1)!.micOn).toBe(false);
  });
});

describe("the phase is the transport's", () => {
  it.each([
    ["idle", "joining"],
    ["joining", "joining"],
    ["connected", "connected"],
    ["reconnecting", "reconnecting"],
  ] as Array<[CallPhase, string]>)("transport %s shows %s", async (transportPhase, shown) => {
    hook.phase = transportPhase;
    const { container } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(root(container)).toHaveAttribute("data-call-phase", shown);
  });

  it("a failed transport shows its message and offers to reconnect when retryable", async () => {
    hook.phase = "failed";
    hook.error = { kind: "network", message: "Could not connect to the other people in this call.", retryable: true };
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(root(container)).toHaveAttribute("data-call-phase", "failed");
    expect(getByTestId("call-error")).toHaveTextContent("Could not connect");
    fireEvent.click(getByTestId("retry-call"));
    expect(hook.retry).toHaveBeenCalledTimes(1);
  });

  it("a refusal (the room ended) offers no reconnect", async () => {
    hook.phase = "failed";
    hook.error = { kind: "auth", message: "This call has ended.", retryable: false };
    const { container, queryByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(queryByTestId("call-error")).toHaveTextContent("This call has ended.");
    expect(queryByTestId("retry-call")).not.toBeInTheDocument();
  });

  it("after Leave the phase is left whatever the transport last said", async () => {
    hook.phase = "connected";
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    fireEvent.click(getByTestId("leave-call"));
    expect(root(container)).toHaveAttribute("data-call-phase", "left");
    expect(getByTestId("join-call")).toBeInTheDocument();
  });
});

describe("remote tiles", () => {
  it("one tile per remote person, carrying their id, mute and camera state and their stream", async () => {
    hook.phase = "connected";
    const remote = new FakeMediaStream([new FakeTrack("audio"), new FakeTrack("video")]) as unknown as MediaStream;
    hook.remotes = new Map([["2", { stream: remote, version: 1, micOn: false, cameraOn: true }]]);
    const { container } = renderScreen();
    await act(async () => {});
    const tiles = container.querySelectorAll('[data-testid="remote-media"]');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toHaveAttribute("data-participant-id", "2");
    expect(tiles[0]).toHaveAttribute("data-audio-muted", "true");
    expect(tiles[0]).toHaveAttribute("data-video-off", "false");
    expect(tiles[0]).toHaveTextContent("Ada");
    expect((tiles[0].querySelector("video") as HTMLVideoElement).srcObject).toBe(remote);
  });

  it("no tile for anyone the transport has not reported", async () => {
    hook.phase = "connected";
    const { container } = renderScreen();
    await act(async () => {});
    expect(container.querySelectorAll('[data-testid="remote-media"]')).toHaveLength(0);
    expect(container.querySelector("[data-call-partner-waiting]")).toHaveTextContent("hasn't joined yet");
  });
});
