import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  save: vi.fn(),
  end: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: actions.push }),
}));
vi.mock("@/app/app/call/[id]/_actions", () => ({
  saveCallRatingAction: actions.save,
}));
vi.mock("@/app/app/smart-connection/_actions", () => ({
  endRoomAction: actions.end,
}));
vi.mock("@/components/call/VoiceCallScreen", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/components/call/VoiceCallScreen")>(),
  default: ({
    onRateCall,
    onDone,
    call,
  }: {
    onRateCall: (value: number) => void;
    onDone: () => void;
    call: { iceEndpoint: string };
  }) => (
    <div data-testid="call-network" data-ice-endpoint={call.iceEndpoint}>
      <button onClick={() => onRateCall(4)}>4 stars</button>
      <button onClick={onDone}>Done</button>
    </div>
  ),
}));
import CallScreenClient, { CompletedCallRating } from "@/app/app/call/[id]/CallScreenClient";

const access = {
  allowed: true as const,
  roomId: "b37c6746-04ee-4609-a17b-115d31b65e3c",
  queueType: "casual" as const,
  me: { id: 1, name: "You", avatarUrl: "" },
  partner: { id: 2, name: "Your match", avatarUrl: "" },
};
function screen() {
  return render(
    <CallScreenClient
      access={access}
      signalingEndpoint="/api/call/signal"
      iceEndpoint="/api/call/ice"
      exitHref="/app"
    />,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  actions.save.mockResolvedValue({ success: true });
  actions.end.mockResolvedValue({ success: true, ended: true });
});
afterEach(cleanup);

describe("finishing a call", () => {
  it("rates an ended room without mounting media or offering Rejoin", async () => {
    const view = render(<CompletedCallRating roomId={access.roomId} exitHref="/app" />);
    expect(view.getByRole("heading", { name: "This call has ended" })).toHaveFocus();
    expect(view.queryByTestId("call-network")).toBeNull();
    expect(view.queryByRole("button", { name: "Rejoin" })).toBeNull();
    fireEvent.click(view.getByRole("radio", { name: /^5 stars$/ }));
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith("/app"));
    expect(actions.save).toHaveBeenCalledWith({ roomId: access.roomId, rating: 5 });
    expect(actions.end).not.toHaveBeenCalled();
  });
  it("saves the selected rating before ending the room or navigating", async () => {
    let saved!: (value: { success: true }) => void;
    actions.save.mockReturnValue(
      new Promise((resolve) => {
        saved = resolve;
      }),
    );
    const view = screen();
    expect(view.getByTestId("call-network")).toHaveAttribute("data-ice-endpoint", "/api/call/ice");
    fireEvent.click(view.getByText("4 stars"));
    fireEvent.click(view.getByText("Done"));
    expect(view.getByRole("status")).toHaveTextContent("Saving your rating");
    expect(view.getByText("Done")).toBeDisabled();
    expect(actions.save).toHaveBeenCalledWith({
      roomId: access.roomId,
      rating: 4,
    });
    expect(actions.end).not.toHaveBeenCalled();
    expect(actions.push).not.toHaveBeenCalled();
    await act(async () => saved({ success: true }));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith("/app"));
    expect(actions.end).toHaveBeenCalledWith(access.roomId);
  });

  it("keeps the rating and offers retry when persistence fails", async () => {
    actions.save.mockResolvedValueOnce({
      success: false,
      error: "Could not save your rating. Choose Done to retry.",
    });
    const view = screen();
    fireEvent.click(view.getByText("4 stars"));
    fireEvent.click(view.getByText("Done"));
    await waitFor(() =>
      expect(view.getByRole("alert")).toHaveTextContent("Choose Done to retry"),
    );
    expect(actions.push).not.toHaveBeenCalled();
    expect(actions.end).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("Done"));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith("/app"));
    expect(actions.save).toHaveBeenLastCalledWith({
      roomId: access.roomId,
      rating: 4,
    });
  });

  it("stays on the screen if ending the room is refused, then retries", async () => {
    actions.end.mockResolvedValueOnce({
      success: false,
      error: "Not signed in",
    });
    const view = screen();
    fireEvent.click(view.getByText("Done"));
    await waitFor(() =>
      expect(view.getByRole("alert")).toHaveTextContent("Not signed in"),
    );
    expect(actions.push).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("Done"));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith("/app"));
  });

  it("shows an actionable error for a rejected request", async () => {
    actions.save.mockRejectedValueOnce(new Error("offline"));
    const view = screen();
    fireEvent.click(view.getByText("4 stars"));
    fireEvent.click(view.getByText("Done"));
    await waitFor(() =>
      expect(view.getByRole("alert")).toHaveTextContent("Choose Done to retry"),
    );
    expect(actions.push).not.toHaveBeenCalled();
    expect(view.getByText("Done")).toBeEnabled();
  });

  it("allows Done without inventing a rating", async () => {
    const view = screen();
    fireEvent.click(view.getByText("Done"));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith("/app"));
    expect(actions.save).not.toHaveBeenCalled();
    expect(actions.end).toHaveBeenCalledWith(access.roomId);
  });
});
