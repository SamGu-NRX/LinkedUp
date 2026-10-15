import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine";
import MatchIntro from "@/components/matching/MatchIntro";
import VoiceCallScreen from "@/components/call/VoiceCallScreen";
import type { QueueStateForUser } from "@/lib/matching";

const actions = vi.hoisted(() => ({
  join: vi.fn(),
  state: vi.fn(),
  leave: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: actions.push }),
}));
vi.mock("@/app/app/smart-connection/_actions", () => ({
  queueJoinAction: actions.join,
  queueStateAction: actions.state,
  queueLeaveAction: actions.leave,
}));

const intro = {
  reason: "You both enjoy hiking and photography.",
  question: "What place would you like to photograph on your next hike?",
  sharedInterests: ["Hiking", "Photography"],
};
const matched = {
  status: "matched",
  roomId: "room-42",
  queueType: "casual",
  partner: { id: 2, name: "Alex Rivera", avatarUrl: "" },
  intro,
} satisfies QueueStateForUser;

beforeEach(() => {
  vi.clearAllMocks();
  actions.join.mockResolvedValue({
    success: true,
    result: { status: "waiting" },
  });
  actions.state.mockResolvedValue({ success: true, state: matched });
  actions.leave.mockResolvedValue({ success: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("match introduction", () => {
  it("clears a failed poll after recovery and retains one announcement region", async () => {
    vi.useFakeTimers();
    actions.state.mockRejectedValueOnce(new Error("offline"));
    render(<SmartConnectionEngine queueType="casual" />);
    const status = screen.getByRole("status");
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("Could not check the queue. Try again.");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole("heading", { name: "Alex Rivera" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Alex Rivera is your match.");
  });
  it("shows the supplied question and reason beside a real match and joins its room", async () => {
    render(<SmartConnectionEngine queueType="casual" />);
    expect(
      await screen.findByRole("heading", { name: "Alex Rivera" }),
    ).toBeVisible();
    expect(screen.getByText(intro.question)).toBeVisible();
    expect(screen.getByText(intro.reason)).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Shared interests" }),
    ).toHaveTextContent("HikingPhotography");
    fireEvent.click(screen.getByRole("button", { name: "Join the call" }));
    expect(actions.push).toHaveBeenLastCalledWith("/app/call/room-42");
  });

  it("keeps the offer visible when leaving fails", async () => {
    actions.leave.mockResolvedValue({
      success: false,
      error: "Could not leave this queue.",
    });
    render(<SmartConnectionEngine queueType="casual" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Leave queue instead" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not leave this queue.",
    );
    expect(screen.getByRole("button", { name: "Join the call" })).toBeEnabled();
    expect(actions.push).not.toHaveBeenCalled();
  });

  it("keeps legacy matches joinable without inventing an introduction", async () => {
    actions.state.mockResolvedValue({
      success: true,
      state: { ...matched, intro: null },
    });
    render(<SmartConnectionEngine queueType="casual" />);
    expect(
      await screen.findByRole("heading", { name: "Alex Rivera" }),
    ).toBeVisible();
    expect(screen.queryByText("Start with a question")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join the call" })).toBeEnabled();
  });

  it("renders full long content and removes the card when the intro is null", () => {
    const longInterest = "MountainPhotography".repeat(20);
    const { rerender } = render(
      <MatchIntro intro={{ ...intro, sharedInterests: [longInterest] }} />,
    );
    expect(
      screen.getByRole("list", { name: "Shared interests" }),
    ).toHaveTextContent(longInterest);
    expect(screen.getByText(intro.question)).toBeVisible();
    rerender(<MatchIntro intro={null} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByText(intro.question)).not.toBeInTheDocument();
  });

  it("retains the supplied introduction in the call until leaving", () => {
    render(
      <VoiceCallScreen
        callType="casual"
        participants={[
          { id: "1", name: "You", avatarUrl: "" },
          { id: "2", name: "Alex Rivera", avatarUrl: "" },
        ]}
        matchIntro={intro}
        initialDuration={300}
        onEndCall={() => {}}
        onExtendCall={() => {}}
        onToggleMute={() => {}}
        onRateCall={() => {}}
      />,
    );
    expect(screen.getByText(intro.question)).toBeVisible();
    fireEvent.click(screen.getByTestId("leave-call"));
    expect(
      screen.getByRole("heading", { name: "You left the call", level: 1 }),
    ).toBeVisible();
    expect(screen.queryByText(intro.question)).not.toBeInTheDocument();
  });

  it("explains the interest-first search and the wider search after twenty seconds", async () => {
    actions.state.mockResolvedValue({
      success: true,
      state: {
        status: "waiting",
        queueType: "casual",
        joinedAt: new Date().toISOString(),
      },
    });
    const { unmount } = render(<SmartConnectionEngine queueType="casual" />);
    expect(
      await screen.findByText(/Looking for shared interests first/),
    ).toBeVisible();
    unmount();
    actions.state.mockResolvedValue({
      success: true,
      state: {
        status: "waiting",
        queueType: "casual",
        joinedAt: new Date(Date.now() - 21000).toISOString(),
      },
    });
    render(<SmartConnectionEngine queueType="casual" />);
    expect(
      await screen.findByText(/search has widened beyond shared interests/),
    ).toBeVisible();
  });

  it("reports an idle queue honestly and exposes server errors as alerts", async () => {
    actions.state.mockResolvedValue({
      success: true,
      state: { status: "idle" },
    });
    const { unmount } = render(<SmartConnectionEngine queueType="casual" />);
    expect(
      await screen.findByRole("heading", { name: "You are not in the queue" }),
    ).toBeVisible();
    unmount();
    actions.join.mockResolvedValue({
      success: false,
      error: "Queue is unavailable for this account.",
    });
    render(<SmartConnectionEngine queueType="casual" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Queue is unavailable for this account.",
    );
  });
});
