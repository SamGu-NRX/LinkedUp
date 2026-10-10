// src/lib/demo/demo-state.ts
//
// The sample demo's flow state machine. Pure and deterministic: every
// transition is a function of (state, event); nothing here reads the wall
// clock, the network, or a provider. The React shell drives it with events
// from user actions and interval ticks, and passes the in-call clock through
// TimeManager's public API (never by reimplementing its rules).
//
// The four failure/recovery paths — media unavailable, permission refused,
// queue expired, meeting ended — are explicit states with readable copy, a
// recovery action, and back navigation, so no path dead-ends.

import { TimeManager, type TimeRequestState } from "@/components/video-meeting/time-manager";
import { sampleProfileId, type SamplePersona, type SampleProfileId } from "./sample-identity";
import { samplePersonaForProfile } from "./sample-personas";

export type SampleFailureKind =
  | "media-unavailable"
  | "permission-refused"
  | "queue-expired"
  | "meeting-ended";

/** Seconds of simulated queue wait before the sample match appears. */
export const SAMPLE_MATCH_AFTER_SECONDS = 8;
/** Seconds the sample queue waits before expiring into the expiry path. */
export const SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS = 30;
/** Seconds the sample call starts with (mirrors the production room). */
export const SAMPLE_STARTING_ALLOWANCE_SECONDS = 5 * 60;

export type DemoStage =
  | { readonly kind: "profile-choice" }
  | {
      readonly kind: "connection-explanation";
      readonly profileId: SampleProfileId;
    }
  | {
      readonly kind: "queue-waiting";
      readonly profileId: SampleProfileId;
      readonly waitedSeconds: number;
    }
  | {
      readonly kind: "match-explained";
      readonly profileId: SampleProfileId;
      readonly persona: SamplePersona;
    }
  | {
      readonly kind: "joining";
      readonly profileId: SampleProfileId;
      readonly persona: SamplePersona;
    }
  | {
      readonly kind: "in-call";
      readonly profileId: SampleProfileId;
      readonly persona: SamplePersona;
      readonly elapsedSeconds: number;
      readonly allowanceSeconds: number;
      readonly timeRequest: TimeRequestState;
    }
  | {
      readonly kind: "call-ended";
      readonly profileId: SampleProfileId;
      readonly persona: SamplePersona;
      readonly elapsedSeconds: number;
    }
  | {
      readonly kind: "failure";
      readonly failure: SampleFailureKind;
      /** The stage a recovery action re-enters. */
      readonly recoveryStage: DemoStage;
      readonly profileId: SampleProfileId | null;
    };

export interface DemoFlowState {
  readonly stage: DemoStage;
  /** Where "Back" returns to. Falls back to the entry stage — never dead-ends. */
  readonly backStack: readonly DemoStage[];
}

export type DemoEvent =
  | { type: "profile-chosen"; profileId: SampleProfileId }
  | { type: "explanation-acknowledged" }
  | { type: "queue-wait-advanced"; elapsedSeconds: number }
  | { type: "queue-wait-skipped" }
  | { type: "match-accepted" }
  | { type: "match-declined" }
  | { type: "queue-rejoined" }
  | { type: "join-check-passed" }
  | { type: "call-tick" }
  | { type: "call-fast-forward"; seconds: number }
  | { type: "call-time-request-sent" }
  | { type: "call-time-request-resolved" }
  | { type: "call-left" }
  | { type: "recover" }
  | { type: "restart" }
  | { type: "back" }
  | { type: "rehearse-failure"; kind: SampleFailureKind };

/**
 * Readable copy for each failure path. Every entry says what is simulated,
 * what a real visitor would see in the product, and what recovery does.
 */
export const FAILURE_COPY: Record<
  SampleFailureKind,
  { title: string; body: string; recovery: string }
> = {
  "media-unavailable": {
    title: "Sample device check: no camera found",
    body: "This is a rehearsed sample path — no real camera or microphone was touched. In the real product, this screen would offer to continue without video or let the visitor retry their devices.",
    recovery: "Retry the sample device check",
  },
  "permission-refused": {
    title: "Sample device check: permission refused",
    body: "This is a rehearsed sample path — the demo never asked any real device for permission. In the real product, this screen would explain how to grant access in the browser and let the visitor try again.",
    recovery: "Try the sample device check again",
  },
  "queue-expired": {
    title: "Sample queue: the simulated wait expired",
    body: "The sample queue only waits for a fixed script window before it expires — no real matching is happening. In the real product, this screen would offer to rejoin the queue or step out of it.",
    recovery: "Rejoin the sample queue",
  },
  "meeting-ended": {
    title: "Sample meeting ended",
    body: "The simulated meeting reached its scripted end — the clock ran on the same TimeManager the production room uses. Nothing real was connected at any point; the other participant was a sample persona.",
    recovery: "Start the sample flow again",
  },
};

function pushBack(backStack: readonly DemoStage[], stage: DemoStage): readonly DemoStage[] {
  return [...backStack, stage];
}

/** Advance the in-call clock through TimeManager's public API. */
function tickCall(stage: Extract<DemoStage, { kind: "in-call" }>): DemoStage {
  const nextElapsed = TimeManager.tick(stage.elapsedSeconds, stage.allowanceSeconds);
  const remaining = TimeManager.calculateRemaining(nextElapsed, stage.allowanceSeconds);
  if (remaining <= 0) {
    return {
      kind: "failure",
      failure: "meeting-ended",
      recoveryStage: { kind: "profile-choice" },
      profileId: stage.profileId,
    };
  }
  return { ...stage, elapsedSeconds: nextElapsed };
}

export function initialDemoFlowState(): DemoFlowState {
  return {
    stage: { kind: "profile-choice" },
    backStack: [],
  };
}

/** The failure stage narrowed for views that render one. */
export type FailureStage = Extract<DemoStage, { kind: "failure" }>;

export function reduceDemoFlow(state: DemoFlowState, event: DemoEvent): DemoFlowState {
  const { stage } = state;

  switch (event.type) {
    case "profile-chosen": {
      return {
        backStack: pushBack(state.backStack, stage),
        stage: { kind: "connection-explanation", profileId: event.profileId },
      };
    }

    case "explanation-acknowledged": {
      if (stage.kind !== "connection-explanation") return state;
      return {
        backStack: pushBack(state.backStack, stage),
        stage: { kind: "queue-waiting", profileId: stage.profileId, waitedSeconds: 0 },
      };
    }

    case "queue-wait-advanced": {
      if (stage.kind !== "queue-waiting") return state;
      if (event.elapsedSeconds >= SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS) {
        return {
          backStack: state.backStack,
          stage: {
            kind: "failure",
            failure: "queue-expired",
            recoveryStage: { kind: "queue-waiting", profileId: stage.profileId, waitedSeconds: 0 },
            profileId: stage.profileId,
          },
        };
      }
      if (event.elapsedSeconds < stage.waitedSeconds) return state; // no rewinds
      if (event.elapsedSeconds >= SAMPLE_MATCH_AFTER_SECONDS) {
        const persona = samplePersonaForProfile(stage.profileId);
        return {
          backStack: pushBack(state.backStack, stage),
          stage: { kind: "match-explained", profileId: stage.profileId, persona },
        };
      }
      return {
        ...state,
        stage: { ...stage, waitedSeconds: event.elapsedSeconds },
      };
    }

    case "queue-wait-skipped": {
      if (stage.kind !== "queue-waiting") return state;
      const persona = samplePersonaForProfile(stage.profileId);
      return {
        backStack: pushBack(state.backStack, stage),
        stage: { kind: "match-explained", profileId: stage.profileId, persona },
      };
    }

    case "match-accepted": {
      if (stage.kind !== "match-explained") return state;
      return {
        backStack: pushBack(state.backStack, stage),
        stage: { kind: "joining", profileId: stage.profileId, persona: stage.persona },
      };
    }

    case "match-declined": {
      if (stage.kind !== "match-explained") return state;
      // Mirrors the production lobby: declining returns to the queue with a
      // fresh simulated wait. Back still reaches the match explanation.
      return {
        backStack: pushBack(state.backStack, stage),
        stage: { kind: "queue-waiting", profileId: stage.profileId, waitedSeconds: 0 },
      };
    }

    case "queue-rejoined": {
      if (stage.kind !== "queue-waiting" || stage.waitedSeconds === 0) return state;
      return { ...state, stage: { ...stage, waitedSeconds: 0 } };
    }

    case "join-check-passed": {
      if (stage.kind !== "joining") return state;
      return {
        backStack: pushBack(state.backStack, stage),
        stage: {
          kind: "in-call",
          profileId: stage.profileId,
          persona: stage.persona,
          elapsedSeconds: 0,
          allowanceSeconds: SAMPLE_STARTING_ALLOWANCE_SECONDS,
          timeRequest: TimeManager.initialState(),
        },
      };
    }

    case "call-tick": {
      if (stage.kind !== "in-call") return state;
      return { ...state, stage: tickCall(stage) };
    }

    case "call-fast-forward": {
      if (stage.kind !== "in-call") return state;
      // Fast-forwarding still walks TimeManager tick-by-tick so every clamp
      // and the allowance end behave exactly like real time would.
      let current = stage;
      for (let i = 0; i < event.seconds; i += 1) {
        const next = tickCall(current);
        if (next.kind !== "in-call") return { ...state, stage: next };
        current = next;
      }
      return { ...state, stage: current };
    }

    case "call-time-request-sent": {
      if (stage.kind !== "in-call") return state;
      const begin = TimeManager.beginTimeRequest(stage.timeRequest, stage.elapsedSeconds);
      if (!begin.requestId) return state; // pending or cooldown — nothing changes
      return { ...state, stage: { ...stage, timeRequest: begin.state } };
    }

    case "call-time-request-resolved": {
      if (stage.kind !== "in-call") return state;
      if (stage.timeRequest.pendingRequestId === null) return state;
      const completion = TimeManager.completeTimeRequest(
        stage.timeRequest,
        stage.timeRequest.pendingRequestId,
        stage.allowanceSeconds,
      );
      if (!completion.accepted) return state;
      return {
        ...state,
        stage: {
          ...stage,
          allowanceSeconds: stage.allowanceSeconds + completion.secondsAdded,
          timeRequest: completion.state,
        },
      };
    }

    case "call-left": {
      if (stage.kind !== "in-call") return state;
      return {
        backStack: state.backStack,
        stage: {
          kind: "call-ended",
          profileId: stage.profileId,
          persona: stage.persona,
          elapsedSeconds: stage.elapsedSeconds,
        },
      };
    }

    case "recover": {
      if (stage.kind !== "failure") return state;
      // Recovery re-enters the natural recovery point:
      // - Restarting the flow (meeting ended) clears the stack entirely.
      // - Otherwise, if the pre-failure stage is already the recovery point
      //   (rehearsed device-check failures), pop it so Back cannot loop
      //   failure -> recovery -> failure.
      // - Natural expiry keeps its stack, so Back from the fresh queue
      //   returns to the connection explanation.
      const target = stage.recoveryStage;
      if (target.kind === "profile-choice") return initialDemoFlowState();
      const top = state.backStack[state.backStack.length - 1];
      const topIsTarget =
        top !== undefined &&
        top.kind === target.kind &&
        ("profileId" in top && "profileId" in target
          ? top.profileId === target.profileId
          : true);
      return {
        backStack: topIsTarget
          ? state.backStack.slice(0, -1)
          : state.backStack,
        stage: target,
      };
    }

    case "restart": {
      return initialDemoFlowState();
    }

    case "back": {
      if (state.backStack.length === 0) {
        // The entry stage is always a safe landing — never dead-end.
        return state.stage.kind === "profile-choice"
          ? state
          : initialDemoFlowState();
      }
      const previous = state.backStack[state.backStack.length - 1];
      return {
        backStack: state.backStack.slice(0, -1),
        stage: previous,
      };
    }

    case "rehearse-failure": {
      // Rehearsal jumps to the named failure screen from wherever the demo
      // currently is. The recovery stage is where that failure would
      // naturally be recovered from in the flow.
      switch (event.kind) {
        case "media-unavailable":
        case "permission-refused": {
          const context = personaContextOf(state);
          return {
            backStack: pushBack(state.backStack, stage),
            stage: {
              kind: "failure",
              failure: event.kind,
              recoveryStage: {
                kind: "joining",
                profileId: context.profileId,
                persona: context.persona,
              },
              profileId: context.profileId,
            },
          };
        }
        case "queue-expired": {
          const context = personaContextOf(state);
          return {
            backStack: pushBack(state.backStack, stage),
            stage: {
              kind: "failure",
              failure: "queue-expired",
              recoveryStage: {
                kind: "queue-waiting",
                profileId: context.profileId,
                waitedSeconds: 0,
              },
              profileId: context.profileId,
            },
          };
        }
        case "meeting-ended":
          return {
            backStack: pushBack(state.backStack, stage),
            stage: {
              kind: "failure",
              failure: "meeting-ended",
              recoveryStage: { kind: "profile-choice" },
              profileId: "profileId" in stage ? stage.profileId : null,
            },
          };
      }
    }
  }
}

/**
 * The persona context for a failure reached before a profile was chosen. The
 * pairing rule is the demo's fixed script, so the fallback is deterministic.
 */
function personaContextOf(state: DemoFlowState): {
  profileId: SampleProfileId;
  persona: SamplePersona;
} {
  const stage = state.stage;
  if ("profileId" in stage && stage.profileId !== null) {
    return {
      profileId: stage.profileId,
      persona: samplePersonaForProfile(stage.profileId),
    };
  }
  const fallbackProfileId = sampleProfileId("design-systems");
  return {
    profileId: fallbackProfileId,
    persona: samplePersonaForProfile(fallbackProfileId),
  };
}
