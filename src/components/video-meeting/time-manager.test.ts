import { describe, expect, it } from "vitest";
import {
  MAX_EXTENSION_SECONDS,
  MAX_MEETING_SECONDS,
  TimeManager,
} from "@/components/video-meeting/time-manager";

// Deterministic id generator so assertions can reference exact request ids.
const idOf = (id: string) => () => id;

describe("TimeManager.tick", () => {
  it("adds one second", () => {
    expect(TimeManager.tick(0, 300)).toBe(1);
    expect(TimeManager.tick(120, 300)).toBe(121);
  });

  it("clamps at the allowance instead of running past it", () => {
    expect(TimeManager.tick(299, 300)).toBe(300);
    expect(TimeManager.tick(300, 300)).toBe(300);
    expect(TimeManager.tick(3000, 300)).toBe(300);
  });

  it("normalizes negative elapsed to the allowance floor plus one tick", () => {
    expect(TimeManager.tick(-5, 300)).toBe(1);
  });
});

describe("TimeManager.formatTime", () => {
  it("formats minutes and seconds", () => {
    expect(TimeManager.formatTime(0)).toBe("0:00");
    expect(TimeManager.formatTime(65)).toBe("1:05");
    expect(TimeManager.formatTime(600)).toBe("10:00");
    expect(TimeManager.formatTime(3600)).toBe("60:00");
  });
});

describe("TimeManager.calculateRemaining", () => {
  it("returns the unspent allowance", () => {
    expect(TimeManager.calculateRemaining(0, 300)).toBe(300);
    expect(TimeManager.calculateRemaining(120, 300)).toBe(180);
  });

  it("floors at zero once the allowance is spent", () => {
    expect(TimeManager.calculateRemaining(300, 300)).toBe(0);
    expect(TimeManager.calculateRemaining(400, 300)).toBe(0);
  });
});

describe("TimeManager request lifecycle", () => {
  it("starts with no pending request", () => {
    const state = TimeManager.initialState();
    expect(state.pendingRequestId).toBeNull();
    expect(state.lastRequestElapsed).toBeNull();
  });

  it("begins a first request and rejects duplicates while pending", () => {
    let state = TimeManager.initialState();

    const begin = TimeManager.beginTimeRequest(state, 10, idOf("req-1"));
    expect(begin.requestId).toBe("req-1");
    expect(begin.state.pendingRequestId).toBe("req-1");
    state = begin.state;

    const duplicate = TimeManager.beginTimeRequest(state, 11, idOf("req-2"));
    expect(duplicate.requestId).toBeNull();
    expect(duplicate.reason).toBe("pending");
    // Refused request leaves state untouched
    expect(duplicate.state.pendingRequestId).toBe("req-1");
  });

  it("enforces the five-minute cooldown anchored to when the request was sent", () => {
    const first = TimeManager.beginTimeRequest(
      TimeManager.initialState(),
      0,
      idOf("req-1"),
    );
    const completed = TimeManager.completeTimeRequest(first.state, "req-1", 300);
    expect(completed.accepted).toBe(true);
    // The anchor from begin (t=0) survives completion
    expect(completed.state.lastRequestElapsed).toBe(0);
    expect(completed.state.pendingRequestId).toBeNull();

    // 30 seconds later: still inside the 5-minute cooldown
    const tooSoon = TimeManager.beginTimeRequest(completed.state, 30);
    expect(tooSoon.requestId).toBeNull();
    expect(tooSoon.reason).toBe("cooldown");

    // After the cooldown has elapsed: allowed again
    const later = TimeManager.beginTimeRequest(completed.state, 300, idOf("req-2"));
    expect(later.requestId).toBe("req-2");
  });

  it("keeps the request pending when a completion arrives with the wrong id", () => {
    const begin = TimeManager.beginTimeRequest(
      TimeManager.initialState(),
      0,
      idOf("req-1"),
    );
    const refused = TimeManager.completeTimeRequest(begin.state, "nope", 300);
    expect(refused.accepted).toBe(false);
    expect(refused.secondsAdded).toBe(0);

    // Still pending, so a new request is refused as a duplicate
    const again = TimeManager.beginTimeRequest(begin.state, 1, idOf("req-2"));
    expect(again.requestId).toBeNull();
    expect(again.reason).toBe("pending");
  });
});

describe("TimeManager.completeTimeRequest", () => {
  it("adds up to the per-request maximum and reports exactly what was added", () => {
    const begin = TimeManager.beginTimeRequest(
      TimeManager.initialState(),
      0,
      idOf("req-1"),
    );
    const completion = TimeManager.completeTimeRequest(
      begin.state,
      "req-1",
      120,
    );
    expect(completion.accepted).toBe(true);
    expect(completion.secondsAdded).toBe(MAX_EXTENSION_SECONDS);
    expect(completion.state.pendingRequestId).toBeNull();
  });

  it("caps additions at the 20-minute meeting limit", () => {
    const begin = TimeManager.beginTimeRequest(
      TimeManager.initialState(),
      0,
      idOf("req-1"),
    );
    // Allowance is 30s under the cap: only 30s may be added
    const completion = TimeManager.completeTimeRequest(
      begin.state,
      "req-1",
      MAX_MEETING_SECONDS - 30,
    );
    expect(completion.accepted).toBe(true);
    expect(completion.secondsAdded).toBe(30);
  });

  it("reports zero added seconds when the meeting is already at the cap", () => {
    const begin = TimeManager.beginTimeRequest(
      TimeManager.initialState(),
      0,
      idOf("req-1"),
    );
    const completion = TimeManager.completeTimeRequest(
      begin.state,
      "req-1",
      MAX_MEETING_SECONDS,
    );
    expect(completion.accepted).toBe(true);
    expect(completion.secondsAdded).toBe(0);
  });
});
