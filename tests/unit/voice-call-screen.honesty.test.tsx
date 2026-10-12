// tests/unit/voice-call-screen.honesty.test.tsx
//
// The LS0 call surface, observed through real track state. The fake media
// layer behaves like a browser: every getUserMedia call creates NEW tracks,
// stop() ends a track (readyState "ended"), and every track ever created is
// kept, so "nothing is left capturing" is checked by counting live tracks,
// not by checking that stop() was called.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import VoiceCallScreen, { formatElapsed } from "@/components/call/VoiceCallScreen";
import type { Participant } from "@/types/call";

class FakeTrack {
  readyState: "live" | "ended" = "live";
  constructor(readonly kind: "audio" | "video") {}
  stop() {
    this.readyState = "ended";
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

/** Every track the fake browser ever handed out. */
let created: FakeTrack[] = [];
const live = (kind?: "audio" | "video") =>
  created.filter((t) => t.readyState === "live" && (!kind || t.kind === kind));

type Pending = { resolve: () => void; reject: (e: unknown) => void };
/** When set, getUserMedia waits for the test to resolve it (an open prompt). */
let holdNext = false;
let pending: Pending[] = [];

const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
  const make = () => {
    const tracks: FakeTrack[] = [];
    if (constraints.audio) tracks.push(new FakeTrack("audio"));
    if (constraints.video) tracks.push(new FakeTrack("video"));
    created.push(...tracks);
    return new FakeMediaStream(tracks) as unknown as MediaStream;
  };
  if (!holdNext) return make();
  holdNext = false;
  return new Promise<MediaStream>((resolve, reject) => {
    pending.push({ resolve: () => resolve(make()), reject });
  });
});

const denied = () => Object.assign(new Error("denied"), { name: "NotAllowedError" });

const participants: [Participant, Participant] = [
  { id: "me", name: "You", avatarUrl: "" },
  { id: "them", name: "Ada", avatarUrl: "" },
];

function renderScreen() {
  return render(
    <VoiceCallScreen
      callType="casual"
      participants={participants}
      initialDuration={300}
      onEndCall={vi.fn()}
      onExtendCall={vi.fn()}
      onToggleMute={vi.fn()}
      onRateCall={vi.fn()}
    />,
  );
}

const root = (c: HTMLElement) => c.querySelector("[data-call-root]")!;

beforeEach(() => {
  created = [];
  pending = [];
  holdNext = false;
  getUserMedia.mockClear();
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  vi.stubGlobal("MediaStream", FakeMediaStream);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("formatElapsed", () => {
  it("formats minutes and seconds with zero padding", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(600)).toBe("10:00");
  });
});

describe("call phase is about the call, not this device", () => {
  it("stays joining with live local capture: there is no transport yet", async () => {
    const { container } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(root(container)).toHaveAttribute("data-call-phase", "joining");
    expect(container.querySelector("[data-call-timer]")).toHaveTextContent("00:00");
    const remote = container.querySelector('[data-testid="remote-media"]')!;
    expect(remote).toHaveAttribute("data-audio-muted", "true");
    expect(remote).toHaveTextContent("waiting for media transport");
  });

  it("fails when the browser refuses access, and retry returns to joining", async () => {
    getUserMedia.mockRejectedValueOnce(denied());
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-phase", "failed"));
    expect(container.querySelector('[data-call-capture-error="permission"]')).toBeInTheDocument();
    fireEvent.click(getByTestId("retry-media"));
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-local-media", "ready"));
    expect(root(container)).toHaveAttribute("data-call-phase", "joining");
    expect(live()).toHaveLength(2);
  });

  it("reports a missing device without calling the call failed", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("none"), { name: "NotFoundError" }));
    const { container } = renderScreen();
    await waitFor(() =>
      expect(container.querySelector('[data-call-capture-error="no-device"]')).toBeInTheDocument(),
    );
    expect(root(container)).toHaveAttribute("data-call-phase", "joining");
  });
});

describe("toggles really stop and re-acquire tracks", () => {
  it("mute ends the audio track; unmute captures a new one", async () => {
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(live("audio")).toHaveLength(1));
    fireEvent.click(getByTestId("toggle-mic"));
    await waitFor(() => expect(live("audio")).toHaveLength(0));
    expect(container.querySelector("[data-call-mic-state]")).toHaveAttribute("data-call-mic-state", "muted");
    fireEvent.click(getByTestId("toggle-mic"));
    await waitFor(() => expect(live("audio")).toHaveLength(1));
    expect(created.filter((t) => t.kind === "audio")).toHaveLength(2);
  });

  it("camera off ends the video track and drops the preview", async () => {
    const { container } = renderScreen();
    await waitFor(() => expect(container.querySelector("[data-call-local-preview]")).toBeInTheDocument());
    fireEvent.click(container.querySelector("[data-call-camera]")!);
    await waitFor(() => expect(live("video")).toHaveLength(0));
    expect(container.querySelector("[data-call-local-preview]")).not.toBeInTheDocument();
  });
});

describe("nothing outlives the room", () => {
  it("leaving after capture leaves zero live tracks and shows the rating", async () => {
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(live()).toHaveLength(2));
    fireEvent.click(getByTestId("leave-call"));
    expect(live()).toHaveLength(0);
    expect(root(container)).toHaveAttribute("data-call-phase", "left");
    expect(container.querySelector("[data-call-rating]")).toBeInTheDocument();
  });

  it("unmounting after capture leaves zero live tracks", async () => {
    const { unmount } = renderScreen();
    await waitFor(() => expect(live()).toHaveLength(2));
    unmount();
    expect(live()).toHaveLength(0);
  });

  it("leaving while the first capture is pending: the late stream is stopped and the phase stays left", async () => {
    holdNext = true;
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(getByTestId("leave-call"));
    await act(async () => pending[0].resolve());
    expect(live()).toHaveLength(0);
    expect(root(container)).toHaveAttribute("data-call-phase", "left");
    expect(root(container)).toHaveAttribute("data-call-local-media", "pending");
  });

  it("unmounting while a RETRY is pending: the late stream is stopped", async () => {
    getUserMedia.mockRejectedValueOnce(denied());
    const { container, getByTestId, unmount } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-phase", "failed"));
    holdNext = true;
    fireEvent.click(getByTestId("retry-media"));
    await waitFor(() => expect(pending).toHaveLength(1));
    unmount();
    await act(async () => pending[0].resolve());
    expect(created.length).toBeGreaterThan(0);
    expect(live()).toHaveLength(0);
  });

  it("leaving while a RETRY is pending: the late stream is stopped", async () => {
    getUserMedia.mockRejectedValueOnce(denied());
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-phase", "failed"));
    holdNext = true;
    fireEvent.click(getByTestId("retry-media"));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(getByTestId("leave-call"));
    await act(async () => pending[0].resolve());
    expect(live()).toHaveLength(0);
    expect(root(container)).toHaveAttribute("data-call-phase", "left");
  });

  it("a mic muted while the capture is pending never goes live", async () => {
    holdNext = true;
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(getByTestId("toggle-mic"));
    await act(async () => pending[0].resolve());
    expect(live("audio")).toHaveLength(0);
    expect(live("video")).toHaveLength(1);
  });

  it("a retry after muting the mic asks for video only", async () => {
    getUserMedia.mockRejectedValueOnce(denied());
    const { container, getByTestId } = renderScreen();
    await waitFor(() => expect(root(container)).toHaveAttribute("data-call-phase", "failed"));
    fireEvent.click(getByTestId("toggle-mic"));
    fireEvent.click(getByTestId("retry-media"));
    await waitFor(() => expect(live("video")).toHaveLength(1));
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    expect(live("audio")).toHaveLength(0);
  });
});
