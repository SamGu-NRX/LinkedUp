// src/lib/demo/sample-media.ts
//
// The demo's inert media layer. It answers one question — "what would the
// visitor's device show here?" — with generated visuals and scripted values,
// and never touches navigator.mediaDevices, getUserMedia, or any WebRTC API.
// The boundary test (demo-boundaries.test.ts) keeps forbidden media APIs out
// of the demo tree; this module is the only place that models media state.

import { getInitials } from "@/lib/avatar-utils";
import type { SamplePersona } from "./sample-identity";

/** Outcomes the simulated device check can produce. */
export type SampleMediaCheckOutcome =
  | "ok"
  | "media-unavailable"
  | "permission-refused";

export interface SampleVideoFrame {
  readonly kind: "generated-visual";
  /** Shown on the tile so nobody mistakes it for a camera feed. */
  readonly label: string;
  readonly initials: string;
  readonly gradientSeed: string;
}

export interface SampleAudioLevel {
  readonly kind: "scripted-waveform";
  /** Deterministic 0..1 level for the given tick — no microphone is read. */
  readonly level: number;
}

export type SampleMediaCheckResult =
  | {
      readonly outcome: "ok";
      readonly visitorFrame: SampleVideoFrame;
      readonly partnerFrame: SampleVideoFrame;
    }
  | {
      readonly outcome: "media-unavailable";
      readonly reason: string;
    }
  | {
      readonly outcome: "permission-refused";
      readonly reason: string;
    };

const VISITOR_FRAME_LABEL = "Simulated preview — no camera in use";

/**
 * Resolve a sample media check. `requested` is supplied by the demo flow
 * (normally "ok"; the rehearsal controls pass the failure outcomes), so the
 * result is fully deterministic and no real device is ever queried.
 */
export function resolveSampleMediaCheck(
  requested: SampleMediaCheckOutcome,
  partner: SamplePersona,
): SampleMediaCheckResult {
  switch (requested) {
    case "ok":
      return {
        outcome: "ok",
        visitorFrame: {
          kind: "generated-visual",
          label: VISITOR_FRAME_LABEL,
          initials: "SV",
          gradientSeed: "sample-visitor",
        },
        partnerFrame: {
          kind: "generated-visual",
          label: "Sample persona tile — scripted visual, not a live feed",
          initials: getInitials(partner.name),
          gradientSeed: partner.id,
        },
      };
    case "media-unavailable":
      return {
        outcome: "media-unavailable",
        reason:
          "The sample device check found no camera. Nothing is broken — this rehearsed path shows the recovery screen a visitor would see.",
      };
    case "permission-refused":
      return {
        outcome: "permission-refused",
        reason:
          "In the sample script, device permission was refused. No permission was ever requested of a real device — this rehearsed path shows the recovery screen a visitor would see.",
      };
  }
}

/** Deterministic scripted audio level in [0, 1] for the given tick. */
export function sampleAudioLevel(tick: number): SampleAudioLevel {
  const wave = Math.sin(tick / 3) * 0.5 + 0.5;
  return { kind: "scripted-waveform", level: Number(wave.toFixed(3)) };
}

/**
 * Deterministic speaking pattern for the call stage. Production's
 * `simulateSpeaking` (types/meeting.ts) is randomized; the sample demo needs
 * repeatable behavior for tests and evidence, so this is a fixed pattern.
 */
export function sampleSpeakingPattern(tick: number): {
  you: boolean;
  partner: boolean;
} {
  return {
    you: tick % 8 < 3,
    partner: tick % 5 < 2,
  };
}
