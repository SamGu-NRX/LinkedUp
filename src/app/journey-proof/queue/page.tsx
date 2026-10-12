// src/app/journey-proof/queue/page.tsx — JOURNEY-PROOF TEST PATH (see ../proof.ts).
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import { JOURNEY_PROOF_CALL_PREFIX, JOURNEY_PROOF_QUEUE, requireJourneyProof } from "../proof";

export const dynamic = "force-dynamic";

export default async function JourneyProofQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; left?: string }>;
}) {
  requireJourneyProof();
  const { type, left } = await searchParams;
  const queueType = type === "professional" ? "professional" : "casual";
  const queueHref = `${JOURNEY_PROOF_QUEUE}&type=${queueType}`;
  return (
    <OnboardingGate>
      {left ? (
        // Leaving normally goes to /app, which the middleware loop makes
        // unreachable here; this stands in for it without rejoining.
        <main data-journey-proof="left" className="p-8">
          <p>Journey-proof test path: you left the queue.</p>
          <a data-journey-proof-rejoin="" href={queueHref}>
            Rejoin the queue
          </a>
        </main>
      ) : (
        <div data-journey-proof="queue">
          <SmartConnectionEngine
            queueType={queueType}
            callPathPrefix={JOURNEY_PROOF_CALL_PREFIX}
            leaveHref={`${queueHref}&left=1`}
          />
        </div>
      )}
    </OnboardingGate>
  );
}
