// src/app/gate-proof/page.tsx
//
// GATE-PROOF TEST ROUTE — a labelled fixture, not a product page.
//
// Purpose: exercise the DB-backed onboarding gate
// (src/app/app/onboarding-gate.tsx — the component src/app/app/template.tsx
// wraps around /app/**) outside the /app tree, so tests and manual checks
// can observe the gate's decision directly:
//
//   - signed-out visitor             -> panel renders (gate passes through)
//   - signed in, no DB row           -> redirected to /onboarding by the gate
//   - signed in, onboarding_complete -> panel renders (gate passes through)
//
// Covered by tests/unit/gate-proof.route.test.tsx. Deliberately NOT under
// /demo and touches no reserved file. Safe to delete once the middleware
// question is settled.
import { OnboardingGate } from "@/app/app/onboarding-gate";

export const dynamic = "force-dynamic";

export default function GateProofPage() {
  return (
    <OnboardingGate>
      <main data-testid="gate-proof-panel">
        <h1>Gate-proof test route</h1>
        <p>
          GATE-PROOF TEST ROUTE — fixture for the DB-backed onboarding gate,
          not a product page.
        </p>
        <p data-testid="gate-proof-passed">
          If you can read this, the DB-backed gate (onboarding-gate.tsx) let
          the current visitor through.
        </p>
      </main>
    </OnboardingGate>
  );
}
