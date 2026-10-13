// src/app/journey-proof/proof.ts
//
// JOURNEY-PROOF TEST PATH — a labelled test route, not a product page.
//
// The reserved middleware gates every signed-in request except /onboarding
// on a Clerk session claim the keyless test instance never issues, so a
// finished user cannot reach /app (tests/unit/middleware.onboarding-loop.
// witness.test.ts). With LINKEDUP_JOURNEY_PROOF=1, next.config.mjs rewrites
// /onboarding?journey-proof=queue and ?journey-proof=call&room=<id> to these
// pages, which render the same queue and call room as /app/smart-connection
// and /app/call/[id], behind the same DB onboarding gate. Without the flag
// they 404. Delete this directory once Sam settles the middleware.
import { notFound } from "next/navigation";
import { journeyProofEnabled } from "@/lib/journey-proof-guard.mjs";

export const JOURNEY_PROOF_QUEUE = "/onboarding?journey-proof=queue";
export const JOURNEY_PROOF_CALL_PREFIX = "/onboarding?journey-proof=call&room=";
/** The signaling endpoint, reached the same way (next.config.mjs rewrites it to /api/call/signal). */
export const JOURNEY_PROOF_SIGNAL = "/onboarding?journey-proof=signal";

export function requireJourneyProof(): void {
  let enabled = false;
  try {
    enabled = journeyProofEnabled(process.env);
  } catch {
    // Refused (production, Vercel): the pages do not exist.
  }
  if (!enabled) notFound();
}
