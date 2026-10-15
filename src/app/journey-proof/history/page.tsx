// src/app/journey-proof/history/page.tsx — JOURNEY-PROOF TEST PATH (see ../../proof.ts).
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import CallHistoryScreen from "@/components/app/call-history-screen";
import { OnboardingGate } from "@/app/app/onboarding-gate";
import { db } from "@/db";
import { users } from "@/db/schema";
import { listCallSummaries } from "@/lib/call/summary";
import { JOURNEY_PROOF_QUEUE, requireJourneyProof } from "../proof";

export const dynamic = "force-dynamic";

export default async function JourneyProofHistoryPage() {
  requireJourneyProof();
  const { userId } = await auth();
  const me = userId
    ? await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
    : undefined;
  const summaries = me ? await listCallSummaries(me.id) : [];

  return (
    <OnboardingGate>
      <div data-journey-proof="history">
        <CallHistoryScreen
          summaries={summaries}
          queueHref={JOURNEY_PROOF_QUEUE}
          summaryHref={(roomId) =>
            `/onboarding?journey-proof=summary&room=${roomId}`
          }
        />
      </div>
    </OnboardingGate>
  );
}
