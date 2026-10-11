// src/lib/demo/sample-mode.ts
//
// Canonical copy and labelling constants for sample mode. Every demo surface
// sources its "this is simulated" wording from here so the wording stays
// consistent, testable, and impossible to dilute per-screen.
//
// Pure module: no React, no providers, no I/O.

import type { DemoStage } from "./demo-state";

/** Short badge text shown on every demo screen. */
export const SAMPLE_MODE_BADGE = "Sample mode";

/** The persistent banner line. Asserted verbatim by component tests. */
export const SAMPLE_MODE_BANNER =
  "Sample demo — everything here is simulated. No real account, camera, microphone, or network call is used.";

/** The browser tab title while anywhere in the demo. */
export const SAMPLE_MODE_PAGE_TITLE = "LinkedUp — Sample demo (simulated data)";

/** Per-stage suffix so the persistent title also reflects the current step. */
const STAGE_TITLE_SUFFIX: Record<DemoStage["kind"], string> = {
  "profile-choice": "choosing a profile",
  "connection-explanation": "how connecting works",
  "queue-waiting": "simulated queue wait",
  "match-explained": "sample persona introduced",
  joining: "simulated device check",
  "in-call": "simulated meeting",
  "call-ended": "meeting ended",
  failure: "rehearsed failure path",
};

/** The document title for a given stage — always names the demo as simulated. */
export function sampleStageTitle(stage: DemoStage): string {
  return `${SAMPLE_MODE_PAGE_TITLE} — ${STAGE_TITLE_SUFFIX[stage.kind]}`;
}

/** Screen-reader announcement for a stage change (polite live region). */
export function sampleStageAnnouncement(stage: DemoStage): string {
  return `Sample demo screen: ${STAGE_TITLE_SUFFIX[stage.kind]}. Everything here is simulated.`;
}

/** Scripted chat lines the sample persona reveals as the call progresses. */
export const SAMPLE_CHAT_SCRIPT: readonly string[] = [
  "Hi! I'm a sample persona — nothing I say here is from a real person.",
  "The real product connects two visitors for a short, timed conversation.",
  "In this demo every message is scripted and nothing is transmitted.",
];

/** Seconds of simulated call time after which the next scripted line appears. */
export const SAMPLE_CHAT_REVEAL_EVERY_SECONDS = 25;
