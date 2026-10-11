// src/lib/demo/demo-identity.type-test.ts
//
// Type-only boundary test. This file is NOT executed by vitest (its name is
// not *.test.ts); it is checked by `tsc --noEmit`, which is a milestone
// gate. Every `@ts-expect-error` below asserts a compile-time rejection — if
// the sample identity types ever weaken so that one of these assignments
// becomes legal, the expect-error itself fails the typecheck and the
// milestone gate fails.
//
// What this establishes offline: the sample identity is structurally unable
// to pass as a Clerk identity in either direction, and no plain string can
// act as a sample id. What it does NOT establish: the Clerk runtime's own
// behavior — that requires real Clerk infrastructure and is documented as
// unexercised in docs/demo-fixture/NO-REMOTE-EFFECT.md.

import type { SamplePersonaId, SampleProfileId } from "@/lib/demo/sample-identity";
import { samplePersonaId, sampleProfileId } from "@/lib/demo/sample-identity";

// The branded types are only obtainable through their constructors:
const personaId: SamplePersonaId = samplePersonaId("type-check");
const profileId: SampleProfileId = sampleProfileId("type-check");

// A Clerk-shaped id string must not be assignable to a sample persona id:
// @ts-expect-error Clerk user ids are not sample persona ids
const fromClerk: SamplePersonaId = "user_2attemptedCollision";

// A plain string must not be accepted as a sample id (the brand is required):
// @ts-expect-error plain strings lack the sample persona brand
const plain: SamplePersonaId = "sample-persona:forged";

// The two sample brands are distinct from each other:
// @ts-expect-error a sample profile id is not a sample persona id
const crossBrand: SamplePersonaId = profileId;

// And a sample id must not satisfy the Clerk user-id template either:
type ClerkUserId = `user_${string}`;
// @ts-expect-error sample persona ids are not Clerk user ids
const asClerk: ClerkUserId = personaId;

// Keep the valid constructions referenced so the file has no unused locals.
export const IDENTITY_TYPE_CHECK = { personaId, profileId, fromClerk, plain, crossBrand, asClerk };
