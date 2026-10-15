import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { CallPhase, TransportError } from "@/lib/call/transport";
import type { useCallTransport, RemoteState } from "@/components/call/useCallTransport";
import type { RoomAccess } from "@/lib/matching";

const transport = vi.hoisted(() => ({
  phase: "reconnecting" as CallPhase,
  error: null as TransportError | null,
  remotes: new Map<string, RemoteState>(),
  retry: vi.fn(),
  calls: [] as Array<Parameters<typeof useCallTransport>[0]>,
}));

vi.mock("@/components/call/useCallTransport", () => ({
  useCallTransport: (args: Parameters<typeof useCallTransport>[0]) => {
    transport.calls.push(args);
    return transport;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/app/smart-connection/_actions", () => ({ endRoomAction: vi.fn() }));

const { default: CallScreenClient } = await import("@/app/app/call/[id]/CallScreenClient");
const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

class FakeMediaStream {
  getTracks() { return []; }
  getAudioTracks() { return []; }
  getVideoTracks() { return []; }
}

const access = {
  allowed: true,
  roomId: "room-42",
  queueType: "casual",
  me: { id: 1, name: "You", avatarUrl: "" },
  partner: { id: 2, name: "Alex Rivera", avatarUrl: "" },
  intro: {
    reason: "You both enjoy hiking and photography.",
    question: "What place would you like to photograph on your next hike?",
    sharedInterests: ["Hiking", "Photography"],
  },
} satisfies Extract<RoomAccess, { allowed: true }>;

function callScreen() {
  return (
    <CallScreenClient
      access={access}
      signalingEndpoint="/api/journey/call/signal"
      iceEndpoint="/api/journey/call/ice"
      exitHref="/app/smart-connection"
    />
  );
}

function expectIntroduction() {
  const intro = within(screen.getByRole("region", { name: "Start with a question" }));
  expect(intro.getByText("What place would you like to photograph on your next hike?")).toBeVisible();
  expect(intro.getByText("You both enjoy hiking and photography.")).toBeVisible();
}

beforeEach(() => {
  transport.phase = "reconnecting";
  transport.error = null;
  transport.calls = [];
  transport.retry.mockReset();
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn(async () => new FakeMediaStream()),
      enumerateDevices: async () => [],
    },
    configurable: true,
  });
  vi.stubGlobal("MediaStream", FakeMediaStream);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("match introduction during ICE recovery", () => {
  it("survives reconnecting, exhausted ICE, and a person's retry through the real call screen", async () => {
    const { rerender } = render(callScreen());
    const call = screen.getByRole("region", { name: "Call" });
    await waitFor(() => expect(call).toHaveAttribute("data-call-local-media", "ready"));

    expect(call).toHaveAttribute("data-call-phase", "reconnecting");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reconnecting. The call continues when the connection comes back.",
    );
    expectIntroduction();
    expect(transport.calls.at(-1)).toMatchObject({
      active: true,
      connection: {
        roomId: "room-42",
        selfId: "1",
        signalingEndpoint: "/api/journey/call/signal",
        iceEndpoint: "/api/journey/call/ice",
      },
    });

    // The P2P ICE deadline reports a retryable network failure, not a distinct phase.
    transport.phase = "failed";
    transport.error = {
      kind: "network",
      message: "Can't reach the other person. A network may be blocking calls. Try again or switch networks.",
      retryable: true,
    };
    rerender(callScreen());
    expect(call).toHaveAttribute("data-call-phase", "failed");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Can't reach the other person. A network may be blocking calls. Try again or switch networks.",
    );
    expectIntroduction();

    const retry = screen.getByRole("button", { name: "Reconnect" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(transport.retry).toHaveBeenCalledTimes(1);
    expectIntroduction();

    // Deliver the new attempt's hook state without opening a peer connection.
    transport.phase = "joining";
    transport.error = null;
    rerender(callScreen());
    expect(call).toHaveAttribute("data-call-phase", "joining");
    expect(screen.getByRole("status")).toHaveTextContent("Connecting to the call…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectIntroduction();

    transport.phase = "connected";
    rerender(callScreen());
    expect(call).toHaveAttribute("data-call-phase", "connected");
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for Alex Rivera to join");
    expectIntroduction();
  });
});
