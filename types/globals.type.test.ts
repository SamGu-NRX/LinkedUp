// Type-level + runtime checks for the Clerk session-claims augmentation in
// types/globals.d.ts. Pattern verified against Clerk's official docs:
//   https://clerk.com/docs/guides/development/add-onboarding-flow
//   https://clerk.com/docs/guides/development/override-clerk-types-interfaces
//
// The augmented interface is global — these references are intentionally
// import-free. Run with:
//   npx tsc --noEmit --strict --target es2017 --lib dom,dom.iterable,esnext \
//     --module esnext --moduleResolution bundler --esModuleInterop \
//     --skipLibCheck --types node types/globals.d.ts types/globals.type.test.ts
//   node --import tsx --test types/globals.type.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Identity check: true only when A and B are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// Compile-time assertion 1: metadata.onboardingComplete must be exactly
// `boolean | undefined` on the augmented CustomJwtSessionClaims. If the
// augmentation in types/globals.d.ts is missing or drifts, this line fails
// under tsc ("Type 'true' is not assignable to type 'false'").
const onboardingCompleteIsOptionalBoolean: Equal<
  CustomJwtSessionClaims["metadata"]["onboardingComplete"],
  boolean | undefined
> = true;

// Compile-time assertion 2: a literal of the documented metadata shape must
// be assignable to the augmented metadata type.
const metadataLiteral: CustomJwtSessionClaims["metadata"] = {
  onboardingComplete: true,
};

describe("CustomJwtSessionClaims augmentation (types/globals.d.ts)", () => {
  it("types session-claims metadata.onboardingComplete as boolean | undefined", () => {
    assert.equal(onboardingCompleteIsOptionalBoolean, true);
  });

  it("accepts a { onboardingComplete: true } literal as session-claims metadata", () => {
    assert.equal(metadataLiteral.onboardingComplete, true);
  });
});
