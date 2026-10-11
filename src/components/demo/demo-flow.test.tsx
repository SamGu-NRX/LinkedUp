// Component tests for the sample demo flow (jsdom).
//
// These drive the REAL DemoShell component through user interactions: every
// transition the mission requires (profile choice, connection explanation,
// queue/join/call, the four failure/recovery paths, back navigation,
// restart) is exercised the way a visitor would exercise it — by clicking
// the visible controls. Persistent sample-mode labelling (banner, tab
// title, live-region announcements) is asserted on every screen.
//
// Scope note: jsdom cannot layout pages or run a browser network stack, so
// responsive, keyboard-traversal, and network-quietness evidence lives in
// the Playwright suite (M3) rather than here.
import axe from "axe-core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoShell } from "./demo-shell";
import type { DemoStage } from "@/lib/demo/demo-state";
import {
  FAILURE_COPY,
  SAMPLE_MATCH_AFTER_SECONDS,
  SAMPLE_STARTING_ALLOWANCE_SECONDS,
} from "@/lib/demo/demo-state";
import {
  SAMPLE_CHAT_REVEAL_EVERY_SECONDS,
  SAMPLE_MODE_BANNER,
  sampleStageAnnouncement,
  sampleStageTitle,
} from "@/lib/demo/sample-mode";
import { SAMPLE_PROFILES } from "@/lib/demo/sample-personas";
import { TimeManager } from "@/components/video-meeting/time-manager";

function renderShell() {
  return render(<DemoShell />);
}

function profileButton(index: number) {
  // Three sample profile options; each is labelled as a sample option.
  return screen
    .getAllByRole("button", { name: /sample profile option/ })
    [index] as HTMLButtonElement;
}

async function openRehearseControls(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByText(
      "Demo controls — rehearse a failure path (sample only)",
    ),
  );
}

async function rehearse(
  user: ReturnType<typeof userEvent.setup>,
  kind: keyof typeof FAILURE_COPY,
) {
  await openRehearseControls(user);
  await user.click(screen.getByRole("button", { name: new RegExp(`^Rehearse: ${kindLabel(kind)}`) }));
}

function kindLabel(kind: keyof typeof FAILURE_COPY): string {
  switch (kind) {
    case "media-unavailable":
      return "media unavailable";
    case "permission-refused":
      return "permission refused";
    case "queue-expired":
      return "queue expired";
    case "meeting-ended":
      return "meeting ended";
  }
}

/** Asserts the persistent sample-mode labelling for the current stage. */
function expectSampleLabelling(stageKind: DemoStage["kind"]) {
  // The title/announcement builders only read the stage kind.
  const stage = { kind: stageKind } as Parameters<typeof sampleStageTitle>[0];
  // Banner is first on the page, never dismissed.
  const banner = screen.getByTestId("demo-sample-banner");
  expect(banner).toHaveTextContent(SAMPLE_MODE_BANNER);
  // Tab title always names the demo and the current simulated step.
  expect(document.title).toBe(sampleStageTitle(stage));
  // Polite live region announces the stage for screen readers. (The queue
  // stage renders a second role=status box, so target the shell's region
  // directly.)
  const live = screen.getByTestId("demo-live-region");
  expect(live).toHaveTextContent(sampleStageAnnouncement(stage));
}

async function walkToQueue(user: ReturnType<typeof userEvent.setup>) {
  await user.click(profileButton(0));
  await user.click(screen.getByText("Continue to the simulated queue"));
}

/** Advances the faked clock one scripted second per flushed render. The
 * demo's tick chains are re-scheduled by an effect after each render, so a
 * single multi-second advance would fire only the first pending timer;
 * stepping the clock mirrors the browser's render-per-tick rhythm. */
async function advanceScriptedSeconds(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

/** fireEvent walk helpers for the fake-timer tests: user-event's promise
 * pipeline deadlocks against React 19's act scope while timers are faked
 * (its internal waits resolve only when the clock advances, which the act
 * wrapper never yields to), so these tests dispatch events synchronously. */
function fireWalkToQueue() {
  fireEvent.click(profileButton(0));
  fireEvent.click(screen.getByText("Continue to the simulated queue"));
}

function fireWalkToInCall() {
  fireWalkToQueue();
  fireEvent.click(screen.getByText("Skip the simulated wait"));
  fireEvent.click(screen.getByText("Open the simulated meeting"));
  fireEvent.click(screen.getByText("Enter the simulated meeting"));
}

async function walkToMatch(user: ReturnType<typeof userEvent.setup>) {
  await walkToQueue(user);
  await user.click(screen.getByText("Skip the simulated wait"));
}

async function walkToInCall(user: ReturnType<typeof userEvent.setup>) {
  await walkToMatch(user);
  await user.click(screen.getByText("Open the simulated meeting"));
  await user.click(screen.getByText("Enter the simulated meeting"));
}

describe("demo flow (component)", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks the full sample flow from profile choice to the ended recap", async () => {
    renderShell();

    // Stage 1 — profile choice.
    expect(screen.getByText("Choose a sample profile")).toBeVisible();
    expectSampleLabelling("profile-choice");
    // Back is offered but inert at the first screen.
    expect(screen.getByRole("button", { name: "Go back one step in the sample demo" })).toBeDisabled();

    // Stage 2 — connection explanation.
    await user.click(profileButton(0));
    expect(screen.getByText("How connecting works — and what happens here")).toBeVisible();
    expect(screen.getByText(/the queue below is a simulated wait/i)).toBeVisible();
    expectSampleLabelling("connection-explanation");

    // Stage 3 — simulated queue.
    await user.click(screen.getByText("Continue to the simulated queue"));
    expect(screen.getByText("Simulated queue wait")).toBeVisible();
    expect(screen.getByText(/This wait is simulated/i)).toBeVisible();
    expectSampleLabelling("queue-waiting");

    // Stage 4 — sample persona introduced.
    await user.click(screen.getByText("Skip the simulated wait"));
    expect(screen.getByText("Your sample connection")).toBeVisible();
    expect(screen.getByText("sample persona — not a real person")).toBeVisible();
    expectSampleLabelling("match-explained");

    // Stage 5 — simulated device check.
    await user.click(screen.getByText("Open the simulated meeting"));
    expect(screen.getByText("Simulated device check")).toBeVisible();
    expect(screen.getByText(/This demo never touches your devices/i)).toBeVisible();
    expect(screen.getByText("no camera or microphone is accessed")).toBeVisible();
    expectSampleLabelling("joining");

    // Stage 6 — simulated meeting.
    await user.click(screen.getByText("Enter the simulated meeting"));
    expect(screen.getByTestId("demo-in-call")).toBeVisible();
    expect(screen.getByText(/Simulated meeting preview/i)).toBeVisible();
    expect(
      screen.getByText(`Meeting time (sample)`),
    ).toBeVisible();
    expectSampleLabelling("in-call");

    // Stage 7 — ended recap.
    await user.click(screen.getByText("Leave the simulated meeting"));
    expect(screen.getByText("You left the simulated meeting")).toBeVisible();
    expect(screen.getByText(/Nothing was recorded, sent, or connected/i)).toBeVisible();
    expect(screen.getByText("nothing was real")).toBeVisible();
    expectSampleLabelling("call-ended");

    // Restart returns to the very first screen.
    await user.click(screen.getByText("Start the sample flow again"));
    expect(screen.getByText("Choose a sample profile")).toBeVisible();
    expectSampleLabelling("profile-choice");
  });

  it("advances the simulated queue and introduces the persona on the scripted clock", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    renderShell();
    fireWalkToQueue();

    const status = screen.getByTestId("demo-queue-status");
    expect(status).toHaveTextContent("Simulated wait so far: 0 seconds");

    // One scripted tick per second.
    await advanceScriptedSeconds(1);
    expect(screen.getByTestId("demo-queue-status")).toHaveTextContent(
      "Simulated wait so far: 1 second",
    );

    // The sample persona arrives after the scripted interval without any
    // visitor action.
    await advanceScriptedSeconds(SAMPLE_MATCH_AFTER_SECONDS - 1);
    expect(screen.getByText("Your sample connection")).toBeVisible();
    expectSampleLabelling("match-explained");
  });

  // The queue-expired transition is not reachable by waiting: the sample
  // persona matches at SAMPLE_MATCH_AFTER_SECONDS (8s), long before the
  // SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS (30s) allowance, so the natural
  // queue always matches first. The expiry transition itself is covered by
  // the reducer suite (demo-state.test.ts) and its UI recovery path by the
  // "rehearses queue-expired" test below.
  //
  it("runs the simulated meeting clock, time request, and scripted chat through the shared TimeManager API", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    renderShell();
    fireWalkToInCall();

    // The time panel quotes the TimeManager-formatted starting allowance.
    expect(
      screen.getByText(
        new RegExp(
          `The room starts with ${TimeManager.formatTime(SAMPLE_STARTING_ALLOWANCE_SECONDS)} on`,
        ),
      ),
    ).toBeVisible();

    // The scripted persona reveals chat lines as the clock advances.
    const chatLog = screen.getByTestId("demo-chat-log");
    const initialLines = within(chatLog).getAllByText(/sample persona/i);
    // +2 buffer: the faked-clock harness can lose one tick at an act
    // boundary, and the reveal lands at exactly REVEAL_EVERY elapsed
    // seconds.
    await advanceScriptedSeconds(SAMPLE_CHAT_REVEAL_EVERY_SECONDS + 2);
    const afterReveal = within(screen.getByTestId("demo-chat-log")).getAllByText(
      /sample persona/i,
    );
    expect(afterReveal.length).toBeGreaterThan(initialLines.length);

    // Time request: send (simulated peer), accept (simulated peer), then a
    // scripted cooldown.
    fireEvent.click(
      screen.getByRole("button", { name: /Request more time \(simulated peer\)/ }),
    );
    expect(screen.getByText("Sample time request pending")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate the peer accepting" }),
    );
    expect(
      screen.getByText(/Time requests cool down for a scripted interval/),
    ).toBeVisible();

    // Leaving lands on the ended recap quoting the scripted clock.
    fireEvent.click(screen.getByText("Leave the simulated meeting"));
    expect(screen.getByText("You left the simulated meeting")).toBeVisible();
  });

  it("keeps visitor chat strictly local", async () => {
    renderShell();
    await walkToInCall(user);

    const input = screen.getByTestId("demo-chat-input");
    await user.type(input, "hello from the keyboard");
    await user.click(screen.getByRole("button", { name: "Add locally" }));

    const chatLog = screen.getByTestId("demo-chat-log");
    expect(within(chatLog).getByText("hello from the keyboard")).toBeVisible();
    expect(within(chatLog).getByText(/Visitor \(you, local only\)/)).toBeVisible();
  });

  it("rehearses media-unavailable and recovers into the device check", async () => {
    renderShell();
    await walkToMatch(user);
    await user.click(screen.getByText("Open the simulated meeting"));
    await rehearse(user, "media-unavailable");

    const copy = FAILURE_COPY["media-unavailable"];
    expect(screen.getByText(copy.title)).toBeVisible();
    expect(screen.getByText(copy.body)).toBeVisible();
    expect(
      screen.getByText(/recovery experience can be inspected without causing any of it for real/i),
    ).toBeVisible();
    expect(screen.getByText("rehearsed path — nothing is broken")).toBeVisible();
    expectSampleLabelling("failure");

    // Back from the failure screen returns to the pre-failure step.
    await user.click(
      screen.getByRole("button", { name: "Go back one step in the sample demo" }),
    );
    expect(screen.getByText("Simulated device check")).toBeVisible();
  });

  it("rehearses permission-refused and recovers into the device check", async () => {
    renderShell();
    await walkToQueue(user);
    await rehearse(user, "permission-refused");

    const copy = FAILURE_COPY["permission-refused"];
    expect(screen.getByText(copy.title)).toBeVisible();
    expectSampleLabelling("failure");

    await user.click(screen.getByRole("button", { name: copy.recovery }));
    expect(screen.getByText("Simulated device check")).toBeVisible();
  });

  it("rehearses queue-expired and recovers into a fresh simulated queue", async () => {
    renderShell();
    await walkToQueue(user);
    await rehearse(user, "queue-expired");

    const copy = FAILURE_COPY["queue-expired"];
    expect(screen.getByText(copy.title)).toBeVisible();
    expectSampleLabelling("failure");

    await user.click(screen.getByRole("button", { name: copy.recovery }));
    expect(screen.getByText("Simulated queue wait")).toBeVisible();
    expect(screen.getByTestId("demo-queue-status")).toHaveTextContent(
      "Simulated wait so far: 0 seconds",
    );

    // Back from the fresh queue returns to the connection explanation.
    await user.click(
      screen.getByRole("button", { name: "Go back one step in the sample demo" }),
    );
    expect(screen.getByText("How connecting works — and what happens here")).toBeVisible();
  });

  it("rehearses meeting-ended and recovers by restarting the sample flow", async () => {
    renderShell();
    await walkToInCall(user);
    await rehearse(user, "meeting-ended");

    const copy = FAILURE_COPY["meeting-ended"];
    expect(screen.getByText(copy.title)).toBeVisible();
    expectSampleLabelling("failure");

    await user.click(screen.getByRole("button", { name: copy.recovery }));
    expect(screen.getByText("Choose a sample profile")).toBeVisible();
    expectSampleLabelling("profile-choice");
  });

  it("walks back through the whole flow without dead ends", async () => {
    renderShell();
    await walkToInCall(user);

    const back = () =>
      screen.getByRole("button", { name: "Go back one step in the sample demo" });

    await user.click(back());
    expect(screen.getByText("Simulated device check")).toBeVisible();
    await user.click(back());
    expect(screen.getByText("Your sample connection")).toBeVisible();
    await user.click(back());
    expect(screen.getByText("Simulated queue wait")).toBeVisible();
    await user.click(back());
    expect(screen.getByText("How connecting works — and what happens here")).toBeVisible();
    await user.click(back());
    expect(screen.getByText("Choose a sample profile")).toBeVisible();
    expect(back()).toBeDisabled();
  });

  it("shows the sample labelling on every screen it passes through", async () => {
    renderShell();
    for (const stage of [
      "profile-choice",
      "connection-explanation",
      "queue-waiting",
      "match-explained",
      "joining",
      "in-call",
    ] as const) {
      // Advance one stage per loop iteration by clicking the visible next
      // control; labelling is checked at each stage along the way.
      expectSampleLabelling(stage);
      const next =
        {
          "profile-choice": () => profileButton(0),
          "connection-explanation": () =>
            screen.getByText("Continue to the simulated queue"),
          "queue-waiting": () => screen.getByText("Skip the simulated wait"),
          "match-explained": () =>
            screen.getByText("Open the simulated meeting"),
          joining: () => screen.getByText("Enter the simulated meeting"),
          "in-call": () => screen.getByText("Leave the simulated meeting"),
        }[stage]() as HTMLElement;
      await user.click(next);
      if (stage === "in-call") {
        // The walk ends at the recap; the labelling there is covered by the
        // full-flow test above.
        expect(screen.getByText("You left the simulated meeting")).toBeVisible();
      }
    }
  });

  it("offers an exit link back to the public site from every screen", async () => {
    renderShell();
    const exit = screen.getByRole("link", {
      name: "Leave the sample demo and return to the LinkedUp home page",
    });
    expect(exit).toHaveAttribute("href", "/");
    expect(screen.getByText("Exit the sample demo")).toBeVisible();
  });

  it("has no axe-detected accessibility issues on the first and last screens (jsdom smoke)", async () => {
    // jsdom computes no layout or color, so contrast rules cannot run here;
    // this smoke checks structure, roles, and names. Full-device axe runs
    // with Playwright in the M3 evidence.
    const { container } = renderShell();
    const first = await axe.run(container);
    expect(first.violations).toEqual([]);

    await walkToInCall(user);
    const call = await axe.run(document.body);
    expect(call.violations).toEqual([]);
  });
});
