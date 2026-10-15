// src/app/journey-proof/call/[id]/page.tsx — JOURNEY-PROOF TEST PATH (see ../../proof.ts).
import CallRoom from "@/app/app/call/[id]/CallRoom";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import { JOURNEY_PROOF_ICE, JOURNEY_PROOF_QUEUE, JOURNEY_PROOF_SIGNAL, requireJourneyProof } from "../../proof";

export const dynamic = "force-dynamic";

// The call fills the screen edge to edge on phones; its controls pad
// themselves by the safe-area insets, which only apply with viewport-fit=cover.
export const viewport = { viewportFit: "cover" };

export default async function JourneyProofCallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  requireJourneyProof();
  const { id } = await params;
  return (
    <OnboardingGate>
      <div data-journey-proof="call">
        <CallRoom id={id} signalingEndpoint={JOURNEY_PROOF_SIGNAL} iceEndpoint={JOURNEY_PROOF_ICE} exitHref={JOURNEY_PROOF_QUEUE} />
      </div>
    </OnboardingGate>
  );
}
