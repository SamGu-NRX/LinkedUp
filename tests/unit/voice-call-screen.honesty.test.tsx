// tests/unit/voice-call-screen.honesty.test.tsx
//
// Honesty unit suite for the LS0 voice-call surface. It pins the DOM
// contract the journey suite drives (phase machine, participant rows,
// stable testids) and the honest-capture behaviors: no simulated remote
// media, real track stop/restart, permission/no-device recovery.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import VoiceCallScreen, { formatElapsed } from "@/components/call/VoiceCallScreen";
import type { Participant } from "@/types/call";

const SOURCE_PATH = path.resolve(__dirname, "../../src/components/call/VoiceCallScreen.tsx");

type FakeTrack = {
  kind: "audio" | "video";
  readyState: "live" | "ended";
  stop: ReturnType<typeof vi.fn>;
};

function makeTrack(kind: "audio" | "video"): FakeTrack {
  return { kind, readyState: "live", stop: vi.fn() };
}

// Minimal MediaStream stand-in: the component rebuilds streams with
// new MediaStream(tracks) and reads getAudioTracks/getVideoTracks.
class FakeMediaStream {
  private readonly tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = tracks;
  }
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === "video");
  }
}

let audioTrack: FakeTrack;
let videoTrack: FakeTrack;
const getUserMedia = vi.fn<() => Promise<MediaStream>>();

function streamOf(tracks: FakeTrack[]): MediaStream {
  return new FakeMediaStream(tracks) as unknown as MediaStream;
}

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

function stubMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
}

beforeEach(() => {
  audioTrack = makeTrack("audio");
  videoTrack = makeTrack("video");
  // Shared track instances: the component's stream holds exactly the
  // objects the tests spy on (stop assertions work across re-acquires).
  getUserMedia.mockImplementation(async (constraints?: MediaStreamConstraints) => {
    const tracks: FakeTrack[] = [];
    if (constraints?.audio) tracks.push(audioTrack);
    if (constraints?.video) tracks.push(videoTrack);
    return streamOf(tracks);
  });
  stubMediaDevices();
  vi.stubGlobal("MediaStream", FakeMediaStream);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("formatElapsed", () => {
  it("formats minutes and seconds with zero padding", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(600)).toBe("10:00");
  });
});

describe("source honesty", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");

  it("starts the phase machine at joining and never simulates remote audio", () => {
    expect(source).toContain('useState<CallPhase>("joining")');
    expect(source).not.toContain("data-remote-audio");
    expect(source).toContain("waiting for media transport");
    // The elapsed timer only runs in the connected phase.
    expect(source).toContain('if (phase !== "connected") return;');
  });
});

describe("capture lifecycle", () => {
  it("shows a permission error and recovers through the retry button", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const { container } = renderScreen();

    await waitFor(() => {
      expect(
        container.querySelector('[data-call-capture-error="permission"]'),
      ).toBeInTheDocument();
    });
    expect(container.querySelector("[data-call-root]")).toHaveAttribute(
      "data-call-phase",
      "joining",
    );

    // Retry succeeds: the phase only advances when capture is live.
    fireEvent.click(container.querySelector('[data-testid="retry-media"]') as HTMLElement);
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });
  });

  it("reports a missing device distinctly", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("none"), { name: "NotFoundError" }),
    );
    const { container } = renderScreen();
    await waitFor(() => {
      expect(
        container.querySelector('[data-call-capture-error="no-device"]'),
      ).toBeInTheDocument();
    });
  });

  it("reaches connected with live local state and an honest remote row", async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });

    // Local row: real capture means the mic is genuinely live.
    const localRow = container.querySelector('[data-participant-id="me"]') as HTMLElement;
    expect(localRow.querySelector("[data-call-mic-state]")).toHaveAttribute(
      "data-call-mic-state",
      "live",
    );

    // Remote row: reports exactly what exists — nothing connected.
    const remoteWrapper = container.querySelector('[data-testid="remote-media"]') as HTMLElement;
    expect(remoteWrapper).toHaveAttribute("data-audio-muted", "true");
    expect(remoteWrapper).toHaveAttribute("data-video-off", "true");
    expect(
      container.querySelector("[data-call-transport-note]"),
    ).toHaveTextContent("waiting for media transport");
  });
});

describe("real track stop/restart", () => {
  it("stops the audio track on mute and re-acquires on unmute", async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });
    const localRow = container.querySelector('[data-participant-id="me"]') as HTMLElement;
    const micToggle = container.querySelector('[data-testid="toggle-mic"]') as HTMLElement;
    const callsBefore = getUserMedia.mock.calls.length;

    fireEvent.click(micToggle);
    await waitFor(() => {
      expect(localRow.querySelector("[data-call-mic-state]")).toHaveAttribute(
        "data-call-mic-state",
        "muted",
      );
    });
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(getUserMedia.mock.calls.length).toBe(callsBefore);

    fireEvent.click(micToggle);
    await waitFor(() => {
      expect(localRow.querySelector("[data-call-mic-state]")).toHaveAttribute(
        "data-call-mic-state",
        "live",
      );
    });
    expect(getUserMedia.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("stops the video track when the camera turns off and drops the preview", async () => {
    const { container } = renderScreen();
    await waitFor(() => {
      expect(
        container.querySelector("[data-call-local-preview]"),
      ).toBeInTheDocument();
    });
    const cameraToggle = container.querySelector("[data-call-camera]") as HTMLElement;

    fireEvent.click(cameraToggle);
    await waitFor(() => {
      expect(videoTrack.stop).toHaveBeenCalled();
    });
    expect(
      container.querySelector("[data-call-local-preview]"),
    ).not.toBeInTheDocument();

    fireEvent.click(cameraToggle);
    await waitFor(() => {
      expect(
        container.querySelector("[data-call-local-preview]"),
      ).toBeInTheDocument();
    });
  });
});

describe("leaving", () => {
  it("stops all tracks, reports left, and shows the rating section", async () => {
    const onEndCall = vi.fn();
    const { container } = render(
      <VoiceCallScreen
        callType="casual"
        participants={participants}
        initialDuration={300}
        onEndCall={onEndCall}
        onExtendCall={vi.fn()}
        onToggleMute={vi.fn()}
        onRateCall={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });

    fireEvent.click(container.querySelector('[data-testid="leave-call"]') as HTMLElement);
    expect(onEndCall).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-call-root]")).toHaveAttribute(
      "data-call-phase",
      "left",
    );
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(videoTrack.stop).toHaveBeenCalled();
    expect(container.querySelector("[data-call-rating]")).toBeInTheDocument();
  });
});

describe("leaving the room releases the camera (witnesses)", () => {
  it("unmount after a live capture leaves zero live tracks", async () => {
    const { container, unmount } = renderScreen();
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });

    // Leaving via unmount (Back, route change) must release the devices.
    unmount();
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(videoTrack.stop).toHaveBeenCalled();
  });

  it("unmount while the capture is still pending releases the late stream (uncancelled-capture-await witness)", async () => {
    const lateAudio = makeTrack("audio");
    const lateVideo = makeTrack("video");
    let resolveCapture!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    const { unmount } = renderScreen();
    await waitFor(() => expect(resolveCapture).toBeDefined());
    // The screen leaves while the browser permission prompt is open.
    unmount();

    // The late capture resolves anyway; every track it granted must be
    // stopped instead of attaching behind the component's back.
    resolveCapture(streamOf([lateAudio, lateVideo]));
    await waitFor(() => expect(lateAudio.stop).toHaveBeenCalled());
    expect(lateVideo.stop).toHaveBeenCalled();
  });

  it("a toggle flipped during a pending capture is honored — the muted mic never goes live", async () => {
    let resolveCapture!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    const { container } = renderScreen();
    fireEvent.click(container.querySelector('[data-testid="toggle-mic"]') as HTMLElement);
    resolveCapture(streamOf([audioTrack, videoTrack]));
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });

    // The in-flight capture's audio track was dropped, not attached live
    // behind a control that says "muted".
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(container.querySelector("[data-call-mic-state]")).toHaveAttribute(
      "data-call-mic-state",
      "muted",
    );
  });

  it("retry after muting the mic does not re-open the microphone (retry-muted-mic witness)", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));

    const { container } = renderScreen();
    await waitFor(() =>
      expect(container.querySelector('[data-testid="retry-media"]')).toBeInTheDocument(),
    );
    fireEvent.click(container.querySelector('[data-testid="toggle-mic"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="retry-media"]') as HTMLElement);
    await waitFor(() => {
      expect(container.querySelector("[data-call-root]")).toHaveAttribute(
        "data-call-phase",
        "connected",
      );
    });

    // The retry asked only for video: the muted mic was NOT re-opened.
    const constraints = getUserMedia.mock.calls[1]?.[0] as MediaStreamConstraints;
    expect(constraints.audio).toBe(false);
    expect(constraints.video).toBe(true);
    expect(container.querySelector("[data-call-mic-state]")).toHaveAttribute(
      "data-call-mic-state",
      "muted",
    );
  });
});
