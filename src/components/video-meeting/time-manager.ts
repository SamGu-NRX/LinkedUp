// @/components/video-meeting/time-manager.ts

/**
 * Meeting time management.
 *
 * All values are integer seconds; no method reads the wall clock, so every
 * code path is deterministic and unit-testable. The meeting page owns a
 * TimeRequestState and drives these static helpers each tick.
 *
 * Invariants (see time-manager.test.ts):
 * - Elapsed time never exceeds the current allowance; remaining never goes negative.
 * - Time requests are capped at MAX_EXTENSION_SECONDS and at the overall
 *   MAX_MEETING_SECONDS allowance — and the accepted addition is reported
 *   truthfully instead of assuming a fixed five minutes.
 * - Only one request can be pending at a time; a second begin is refused.
 * - After a request, further requests wait out REQUEST_COOLDOWN_SECONDS.
 */

export const MAX_MEETING_SECONDS = 20 * 60; // 20-minute overall allowance
export const MAX_EXTENSION_SECONDS = 5 * 60; // largest single request
export const REQUEST_COOLDOWN_SECONDS = 5 * 60; // wait between requests

export interface TimeRequestState {
  /** Id of the request awaiting a response, if any. */
  pendingRequestId: string | null;
  /** Elapsed-seconds value at which the last request was begun. */
  lastRequestElapsed: number | null;
}

export interface TimeRequestOutcome {
  /** Updated state (pending set on success, unchanged on refusal). */
  state: TimeRequestState;
  /** Id of the newly begun request, or null when refused. */
  requestId: string | null;
  /** Why the request was refused, when it was. */
  reason: "pending" | "cooldown" | null;
}

export interface TimeRequestCompletion {
  /** Updated state (pending cleared, cooldown anchored to this request). */
  state: TimeRequestState;
  /** True when the id matched the pending request and time was added. */
  accepted: boolean;
  /** Seconds actually added — always reported, never assumed. */
  secondsAdded: number;
}

const emptyState = (): TimeRequestState => ({
  pendingRequestId: null,
  lastRequestElapsed: null,
});

export const TimeManager = {
  /** A fresh TimeRequestState with nothing pending or cooling down. */
  initialState(): TimeRequestState {
    return emptyState();
  },

  /** One tick of elapsed time, clamped to the current allowance. */
  tick(elapsedSeconds: number, totalSeconds: number): number {
    return Math.min(Math.max(0, elapsedSeconds) + 1, Math.max(0, totalSeconds));
  },

  /** Seconds remaining under the current allowance. */
  calculateRemaining(elapsedSeconds: number, totalSeconds: number): number {
    return Math.max(0, totalSeconds - elapsedSeconds);
  },

  /** True when no request is pending and the cooldown has elapsed. */
  canRequestTime(state: TimeRequestState, elapsedSeconds: number): boolean {
    if (state.pendingRequestId !== null) return false;
    if (state.lastRequestElapsed === null) return true;
    return elapsedSeconds - state.lastRequestElapsed >= REQUEST_COOLDOWN_SECONDS;
  },

  /**
   * Begin a time request. Refused (requestId null) when one is already
   * pending or the cooldown has not elapsed. Cooldown anchors to the
   * elapsed time at which the request was sent.
   */
  beginTimeRequest(
    state: TimeRequestState,
    elapsedSeconds: number,
    generateId: () => string = () =>
      Math.random().toString(36).slice(2) + Date.now().toString(36),
  ): TimeRequestOutcome {
    if (state.pendingRequestId !== null) {
      return { state, requestId: null, reason: "pending" };
    }
    if (!TimeManager.canRequestTime(state, elapsedSeconds)) {
      return { state, requestId: null, reason: "cooldown" };
    }
    const requestId = generateId();
    return {
      state: {
        pendingRequestId: requestId,
        lastRequestElapsed: elapsedSeconds,
      },
      requestId,
      reason: null,
    };
  },

  /**
   * Complete a pending request. Accepted only when the id matches the
   * pending one. The addition is capped by both the per-request limit and
   * the remaining room to MAX_MEETING_SECONDS.
   */
  completeTimeRequest(
    state: TimeRequestState,
    requestId: string,
    totalSeconds: number,
  ): TimeRequestCompletion {
    if (state.pendingRequestId === null || state.pendingRequestId !== requestId) {
      return { state, accepted: false, secondsAdded: 0 };
    }
    const secondsAdded = Math.min(
      MAX_EXTENSION_SECONDS,
      Math.max(0, MAX_MEETING_SECONDS - totalSeconds),
    );
    return {
      state: {
        // Clear the pending id but KEEP the elapsed anchor from the request's
        // begin — the cooldown is measured from when the request was sent.
        pendingRequestId: null,
        lastRequestElapsed: state.lastRequestElapsed,
      },
      accepted: true,
      secondsAdded,
    };
  },

  /** Format seconds as m:ss for display. */
  formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },
};

export default TimeManager;
