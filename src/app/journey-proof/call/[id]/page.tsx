// src/app/journey-proof/call/[id]/page.tsx — JOURNEY-PROOF TEST PATH (see ../../proof.ts).
import CallRoom from "@/app/app/call/[id]/CallRoom";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import { requireJourneyProof } from "../../proof";

export const dynamic = "force-dynamic";

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
        <CallRoom id={id} />
      </div>
    </OnboardingGate>
  );
}
