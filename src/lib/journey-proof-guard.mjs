// src/lib/journey-proof-guard.mjs — whether the journey-proof test path may
// exist in this process. Plain ESM so next.config.mjs can import it too.
//
// The path (next.config.mjs rewrites, src/app/journey-proof/) skips the
// reserved middleware's onboarding-claim check, so it is for local test
// stacks only. It is off unless LINKEDUP_JOURNEY_PROOF=1, and asking for it
// in a production build or server, or on any Vercel deployment, throws: a
// misconfigured deploy fails loudly instead of shipping the bypass.

export const PHASE_PRODUCTION_BUILD = "phase-production-build";
export const PHASE_PRODUCTION_SERVER = "phase-production-server";

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ phase?: string }} [context] Next's config phase, when known
 * @returns {boolean}
 */
export function journeyProofEnabled(env = process.env, { phase } = {}) {
  if (env.LINKEDUP_JOURNEY_PROOF !== "1") return false;
  if (env.VERCEL) {
    throw new Error("LINKEDUP_JOURNEY_PROOF=1 is refused on Vercel deployments: the journey-proof path is for local test stacks.");
  }
  if (env.NODE_ENV === "production" || phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    throw new Error("LINKEDUP_JOURNEY_PROOF=1 is refused in production builds and servers: the journey-proof path is for local test stacks.");
  }
  return true;
}
