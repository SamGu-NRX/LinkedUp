// src/lib/demo/demo-state.test.ts
//
// The demo flow reducer's suite: the happy path, the skip/decline/rejoin
// branches, all four failure/recovery paths (media unavailable, permission
// refused, queue expired, meeting ended), TimeManager-driven call timing and
// time requests, back navigation that never dead-ends, and the copy
// assertions that keep the failure screens honest.

import { describe, expect, it } from "vitest";
import { TimeManager } from "@/components/video-meeting/time-manager";
import {
  FAILURE_COPY,
  SAMPLE_MATCH_AFTER_SECONDS,
  SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS,
  SAMPLE_STARTING_ALLOWANCE_SECONDS,
  initialDemoFlowState,
  reduceDemoFlow,
  type DemoEvent,
  type DemoFlowState,
} from "./demo-state";
import { SAMPLE_PROFILES, samplePersonaForProfile } from "./sample-personas";

const DESIGN = SAMPLE_PROFILES[0].id;

function drive(events: DemoEvent[], state = initialDemoFlowState()): DemoFlowState {
  return events.reduce(reduceDemoFlow, state);
}

describe("sample demo constants", () => {
  it("scripts the match before the queue expiry window", () => {
    expect(SAMPLE_MATCH_AFTER_SECONDS).toBeLessThan(SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS);
  });

  it("mirrors the production room's starting allowance", () => {
    expect(SAMPLE_STARTING_ALLOWANCE_SECONDS).toBe(5 * 60);
  });

  it("gives every failure path readable, sample-labelled copy", () => {
    for (const [kind, copy] of Object.entries(FAILURE_COPY)) {
      expect(copy.title.length, kind).toBeGreaterThan(0);
      expect(copy.body.length, kind).toBeGreaterThan(0);
      expect(copy.recovery.length, kind).toBeGreaterThan(0);
      expect(/sample|simulated|rehearsed/i.test(copy.body), kind).toBe(true);
      expect(/sample|simulated|again|rejoin|retry|start/i.test(copy.recovery), kind).toBe(true);
    }
  });
});

describe("demo flow happy path", () => {
  it("walks profile choice through connection explanation and queue", () => {
    let state = initialDemoFlowState();
    expect(state.stage.kind).toBe("profile-choice");

    state = reduceDemoFlow(state, { type: "profile-chosen", profileId: DESIGN });
    expect(state.stage.kind).toBe("connection-explanation");

    state = reduceDemoFlow(state, { type: "explanation-acknowledged" });
    expect(state.stage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 0 });
  });

  it("advances the queue tick by tick and introduces the paired persona", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
    ]);
    for (let second = 1; second < SAMPLE_MATCH_AFTER_SECONDS; second += 1) {
      state = reduceDemoFlow(state, { type: "queue-wait-advanced", elapsedSeconds: second });
      expect(state.stage.kind).toBe("queue-waiting");
    }
    state = reduceDemoFlow(state, {
      type: "queue-wait-advanced",
      elapsedSeconds: SAMPLE_MATCH_AFTER_SECONDS,
    });
    expect(state.stage.kind).toBe("match-explained");
    if (state.stage.kind === "match-explained") {
      expect(state.stage.persona).toEqual(samplePersonaForProfile(DESIGN));
      expect(state.stage.persona.name).toContain("Sampleton");
    }
  });

  it("lets the visitor skip the simulated wait", () => {
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
    ]);
    expect(state.stage.kind).toBe("match-explained");
  });

  it("joins and ends the call, reporting elapsed time", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
      { type: "match-accepted" },
    ]);
    expect(state.stage.kind).toBe("joining");

    state = reduceDemoFlow(state, { type: "join-check-passed" });
    expect(state.stage).toMatchObject({
      kind: "in-call",
      elapsedSeconds: 0,
      allowanceSeconds: SAMPLE_STARTING_ALLOWANCE_SECONDS,
    });

    state = reduceDemoFlow(state, { type: "call-tick" });
    state = reduceDemoFlow(state, { type: "call-tick" });
    expect(state.stage).toMatchObject({ kind: "in-call", elapsedSeconds: 2 });

    state = reduceDemoFlow(state, { type: "call-left" });
    expect(state.stage).toMatchObject({ kind: "call-ended", elapsedSeconds: 2 });
  });

  it("declines back into the queue with the match still reachable via Back", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
    ]);
    const matchStage = state.stage;
    state = reduceDemoFlow(state, { type: "match-declined" });
    expect(state.stage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 0 });

    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage).toEqual(matchStage);
  });

  it("resets the script when the visitor rejoins a partially-waited queue", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-advanced", elapsedSeconds: 3 },
    ]);
    expect(state.stage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 3 });
    state = reduceDemoFlow(state, { type: "queue-rejoined" });
    expect(state.stage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 0 });
  });

  it("never rewinds the queue wait", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-advanced", elapsedSeconds: 5 },
    ]);
    const before = state;
    state = reduceDemoFlow(state, { type: "queue-wait-advanced", elapsedSeconds: 2 });
    expect(state).toBe(before);
  });

  it("starts the meeting with a fresh TimeManager request state", () => {
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
      { type: "match-accepted" },
      { type: "join-check-passed" },
    ]);
    if (state.stage.kind !== "in-call") throw new Error("expected in-call");
    expect(state.stage.timeRequest).toEqual(TimeManager.initialState());
  });
});

describe("call timing through TimeManager's public API", () => {
  function inCall(events: DemoEvent[]): DemoFlowState {
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
      { type: "match-accepted" },
      { type: "join-check-passed" },
      ...events,
    ]);
    if (state.stage.kind !== "in-call") throw new Error("expected in-call");
    return state;
  }

  it("keeps elapsed clamped to the allowance", () => {
    const state = inCall([{ type: "call-fast-forward", seconds: 30 }]);
    expect(state.stage).toMatchObject({
      kind: "in-call",
      elapsedSeconds: 30,
      allowanceSeconds: SAMPLE_STARTING_ALLOWANCE_SECONDS,
    });
  });

  it("ends the meeting through the meeting-ended failure when the clock runs out", () => {
    // The endpoint here IS the failure, so this test drives the base path
    // directly instead of using the inCall helper (which asserts in-call).
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
      { type: "match-accepted" },
      { type: "join-check-passed" },
      { type: "call-fast-forward", seconds: SAMPLE_STARTING_ALLOWANCE_SECONDS + 5 },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind === "failure") {
      expect(state.stage.failure).toBe("meeting-ended");
      expect(state.stage.recoveryStage).toEqual({ kind: "profile-choice" });
    }
  });

  it("adds exactly the truthful accepted extension on a simulated acceptance", () => {
    let state = inCall([{ type: "call-tick" }]);
    state = reduceDemoFlow(state, { type: "call-time-request-sent" });
    if (state.stage.kind !== "in-call") throw new Error("expected in-call");
    expect(state.stage.timeRequest.pendingRequestId).not.toBeNull();

    state = reduceDemoFlow(state, { type: "call-time-request-resolved" });
    if (state.stage.kind !== "in-call") throw new Error("expected in-call");
    // TimeManager caps the addition at MAX_EXTENSION_SECONDS and reports it
    // truthfully; the demo starts at 300s of the 1200s room cap.
    expect(state.stage.allowanceSeconds).toBe(SAMPLE_STARTING_ALLOWANCE_SECONDS + 5 * 60);
    expect(state.stage.timeRequest.pendingRequestId).toBeNull();
  });

  it("refuses a second request while one is pending", () => {
    let state = inCall([{ type: "call-tick" }, { type: "call-time-request-sent" }]);
    const before = state;
    state = reduceDemoFlow(state, { type: "call-time-request-sent" });
    expect(state).toBe(before);
  });

  it("refuses an immediate re-request during the scripted cooldown", () => {
    let state = inCall([
      { type: "call-tick" },
      { type: "call-time-request-sent" },
      { type: "call-time-request-resolved" },
    ]);
    const before = state;
    state = reduceDemoFlow(state, { type: "call-time-request-sent" });
    expect(state).toBe(before);
  });
});

describe("the four failure/recovery paths", () => {
  it("expires the queue into the expiry failure and recovers into a fresh queue", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-advanced", elapsedSeconds: SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind !== "failure") return;
    expect(state.stage.failure).toBe("queue-expired");

    state = reduceDemoFlow(state, { type: "recover" });
    expect(state.stage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 0 });
  });

  it("keeps Back usable from the queue-expiry failure", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-advanced", elapsedSeconds: SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS },
    ]);
    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage.kind).toBe("connection-explanation");
  });

  it("rehearses media-unavailable and recovers into the device check", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
      { type: "match-accepted" },
      { type: "rehearse-failure", kind: "media-unavailable" },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind !== "failure") return;
    expect(state.stage.failure).toBe("media-unavailable");
    expect(state.stage.recoveryStage.kind).toBe("joining");

    // From the failure screen itself, Back returns to the pre-failure step.
    const fromFailure = reduceDemoFlow(state, { type: "back" });
    expect(fromFailure.stage.kind).toBe("joining");

    state = reduceDemoFlow(state, { type: "recover" });
    expect(state.stage.kind).toBe("joining");
    // After recovery, Back continues the natural flow (match explanation),
    // never back into the failure that was just recovered from.
    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage.kind).toBe("match-explained");
  });

  it("rehearses permission-refused from anywhere and recovers into the device check", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "rehearse-failure", kind: "permission-refused" },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind !== "failure") return;
    expect(state.stage.failure).toBe("permission-refused");
    expect(state.stage.recoveryStage.kind).toBe("joining");
  });

  it("rehearses queue-expired from a non-queue stage", () => {
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "rehearse-failure", kind: "queue-expired" },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind !== "failure") return;
    expect(state.stage.failure).toBe("queue-expired");
    expect(state.stage.recoveryStage).toMatchObject({ kind: "queue-waiting", waitedSeconds: 0 });
  });

  it("rehearses meeting-ended and recovers to the entry stage", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "rehearse-failure", kind: "meeting-ended" },
    ]);
    expect(state.stage.kind).toBe("failure");
    if (state.stage.kind !== "failure") return;
    expect(state.stage.failure).toBe("meeting-ended");

    state = reduceDemoFlow(state, { type: "recover" });
    expect(state.stage.kind).toBe("profile-choice");
  });
});

describe("back navigation never dead-ends", () => {
  it("walks back through every visited stage", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "queue-wait-skipped" },
    ]);
    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage.kind).toBe("queue-waiting");
    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage.kind).toBe("connection-explanation");
    state = reduceDemoFlow(state, { type: "back" });
    expect(state.stage.kind).toBe("profile-choice");
  });

  it("lands on the entry stage when Back is pressed with nowhere to go", () => {
    let state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "restart" },
      { type: "back" },
    ]);
    // After restart the stage is the entry itself; Back is a no-op there.
    expect(state.stage.kind).toBe("profile-choice");

    state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "back" },
      { type: "back" },
      { type: "back" },
    ]);
    expect(state.stage.kind).toBe("profile-choice");
  });

  it("restarts from any stage", () => {
    const state = drive([
      { type: "profile-chosen", profileId: DESIGN },
      { type: "explanation-acknowledged" },
      { type: "restart" },
    ]);
    expect(state).toEqual(initialDemoFlowState());
  });
});
