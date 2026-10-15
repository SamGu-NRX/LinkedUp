// src/app/journey-proof/summary/[id]/page.tsx — JOURNEY-PROOF TEST PATH (see ../../proof.ts).
import CallSummaryScreen, {
  CallSummaryRefusal,
} from "@/components/app/call-summary-screen";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import { getCallSummaryForUser } from "@/lib/call/summary";
import { auth } from "@clerk/nextjs/server";
import { requireJourneyProof } from "../../proof";

export const dynamic = "force-dynamic";

export default async function JourneyProofSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  requireJourneyProof();
  const { id } = await params;
  const { userId } = await auth();
  const access = userId
    ? await getCallSummaryForUser(userId, id)
    : ({ allowed: false, reason: "signed_out" } as const);

  if (!access.allowed) {
    return (
      <OnboardingGate>
        <div data-journey-proof="summary">
          <CallSummaryRefusal
            reason={access.reason}
            backHref="/onboarding?journey-proof=queue"
          />
        </div>
      </OnboardingGate>
    );
  }

  return (
    <OnboardingGate>
      <div data-journey-proof="summary">
        <CallSummaryScreen
          summary={access.summary}
          historyHref="/onboarding?journey-proof=history"
          backHref="/onboarding?journey-proof=queue"
        />
      </div>
    </OnboardingGate>
  );
}
