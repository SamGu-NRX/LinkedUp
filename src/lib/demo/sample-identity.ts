// src/lib/demo/sample-identity.ts
//
// The sample identity is the demo's central boundary object. It is:
// - clearly fictional (every persona is labelled a sample),
// - structurally distinct from anything Clerk could mint (see the id type),
// - never accepted by production verified-session code, because the demo
//   tree never imports or calls that code (enforced by
//   src/lib/demo/demo-boundaries.test.ts and by `tsc --noEmit`).
//
// This module is pure data and types: no provider imports, no I/O, no clock.

import type { ConnectionType, Interest } from "@/types/user";

/**
 * Identity of a sample persona.
 *
 * Deliberately shaped so it can never collide with a Clerk user id:
 * Clerk's `auth()` returns ids of the form `user_<id>`, while this is
 * branded AND prefixed `sample-persona:`. The template literal alone would
 * already reject assignment in either direction; the unique-symbol brand
 * additionally rejects any plain string.
 */
declare const samplePersonaBrand: unique symbol;

export type SamplePersonaId = string & {
  readonly [samplePersonaBrand]: "SamplePersonaId";
};

const SAMPLE_PERSONA_PREFIX = "sample-persona:";

/** Construct a sample persona id. The only way to obtain the branded type. */
export function samplePersonaId(suffix: string): SamplePersonaId {
  return `${SAMPLE_PERSONA_PREFIX}${suffix}` as SamplePersonaId;
}

/** A fictional person used only by the sample demo. Never persisted, never sent anywhere. */
export interface SamplePersona {
  readonly id: SamplePersonaId;
  readonly name: string;
  readonly tagline: string;
  readonly bio: string;
  readonly profession: string;
  readonly company: string;
  readonly experience: number;
  readonly interests: readonly Interest[];
  readonly connectionType: ConnectionType;
  /** What this persona would open the conversation with — scripted sample copy. */
  readonly conversationStarter: string;
}

/** The visitor's side of the sample demo. Not a Clerk session in any way. */
export interface SampleVisitor {
  readonly displayName: "Sample visitor";
  readonly chosenProfileId: SampleProfileId;
}

declare const sampleProfileBrand: unique symbol;

/** Id of one of the demo's selectable interest profiles. */
export type SampleProfileId = string & {
  readonly [sampleProfileBrand]: "SampleProfileId";
};

export function sampleProfileId(suffix: string): SampleProfileId {
  return `sample-profile:${suffix}` as SampleProfileId;
}

export interface SampleProfile {
  readonly id: SampleProfileId;
  readonly label: string;
  readonly description: string;
  readonly interests: readonly Interest[];
}
