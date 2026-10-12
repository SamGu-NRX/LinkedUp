# LinkedUp journey foundation (LS0) handoff

Branch `obv/linkedup-journey-foundation-f1`, PR #10, based on `alpha`. Plan: `docs/plan/CALL-PLAN.md`, step LS0. Earlier writers' round logs are in this file's git history (up to `4d7b673`).

## State

Two people can sign up, onboard, queue, get paired by the server and land in the same call room. Every J case passes at 10 seeds (results below). The call itself is not real yet: each side captures its own camera and microphone, and the phase stays `joining` because no transport exists until LS1.

The finished-onboarding journey does not reach `/app` on this stack. `src/middleware.ts` (reserved, byte-identical to `alpha`) sends every signed-in request except `/onboarding` back to `/onboarding` unless the session token carries `metadata.onboardingComplete`. The keyless Clerk instance's tokens never carry it: that claim needs a dashboard session-token setting, which Clerk's Backend API cannot make. The journeys therefore run through a labelled test path, below. Sam decides the middleware.

## What changed in this round

- **Call capture** (`src/components/call/VoiceCallScreen.tsx`). Every capture request, including retries, is cancelled by leave, unmount or a newer request, and a late stream is stopped. The phase stays `joining` until a transport connects; local readiness has its own attribute, `data-call-local-media`. A refused permission sets `failed`.
- **Matching** (`src/lib/matching.ts`, migration `drizzle/0001_queue_last_seen.sql`). Leaving an offered match ends the room and returns the other person to the queue. Liveness is `last_seen_at`, refreshed by each poll; an entry expires 30 s after the last poll. The 30 s is a judgment with no measurement behind it. Raw SQL no longer passes a `Date` to postgres-js, which threw on every join and poll.
- **Professional queues** (`src/app/app/professional/*`) use the real queue; the simulated `ProfessionalQueue` and its made-up match are gone.
- **Onboarding** (`src/app/onboarding/_actions.ts`) writes profile and interests, then Clerk's metadata, then `users.onboarding_complete` last.
- **dev-up** (`scripts/dev-up.mjs`, `scripts/stack-paths.cjs`) runs on macOS (Homebrew Postgres 14-17, `lsof`, `ps`), never touches processes it did not start or the system Postgres, refuses env files that would undo isolation, and has `pnpm dev:down`.
- **Tests write only to the stack database** (`tests/stack-db.ts`). An inherited `DATABASE_URL` that is not the stack's is refused, and the server must serve this checkout's `.local/pg`.
- **Journey-proof path** (`next.config.mjs`, `src/app/journey-proof/`). With `LINKEDUP_JOURNEY_PROOF=1`, `/onboarding?journey-proof=queue` and `?journey-proof=call&room=<id>` serve the real queue and call room behind the same DB onboarding gate. Rewrites run after the middleware, so sign-in is still required. Without the flag they do not exist. Delete it when the middleware is settled.
- **J suite** (`tests/e2e/journeys.spec.ts`). Sign-up types Clerk's test code 424242. Global setup loads the keyless keys into the test process only, and every test deletes its personas from Clerk and Postgres.

## Proof (at `19ecb51`)

| Check | Command | Result |
|---|---|---|
| Types | `pnpm exec tsc --noEmit -p .` | exit 0 |
| Lint | `pnpm exec next lint` | exit 0, 3 inherited `<img>` warnings |
| Unit and DB tests | `pnpm exec vitest run` (stack up) | 76 passed, 9 files |
| Build | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA pnpm build` | exit 0, every route compiles, including `/journey-proof/*` |
| J suite | `pnpm exec playwright test tests/e2e/journeys.spec.ts --project=desktop` (10 seeds) | 70 of 70 cases passed, plus the expected failure of the loop witness (19.7 min) |

Witnesses that fail against the code they replace: capture 6 of 13 (`tests/unit/voice-call-screen.honesty.test.tsx`), matching 4 of 13 (`tests/unit/matching.witness.test.ts`), onboarding order 3 of 4 (`tests/unit/onboarding.order.db.test.ts`). The pairing witness runs the production pairing body with its transaction removed and forms two rooms for one pair; inside the transaction it forms one, 10 of 10 rounds.

J results per case, seeds 0-9: `docs/plan/evidence/linkedup-j-19ecb51.jsonl`.

| Case | Passed | Median |
|---|---|---|
| J1 both queue at once | 10/10 | 10.6 s |
| J2 one queues first (waits 3-8 s alone) | 10/10 | 17.9 s |
| J3 one cancels (while waiting, then declining an offered match) | 10/10 | 21.2 s |
| J4 three users queue at once | 10/10 | 18.0 s |
| J5 reload while queued | 10/10 | 15.7 s |
| J6 Back from the call | 10/10 | 10.7 s |
| J7 signed-out access to the call | 10/10 | 12.1 s |

Each case signs up and onboards fresh people and checks their `users` and `interests` rows, the queue entries and the room in Postgres. No test intercepts the app's documents or APIs; the only route handler is `@clerk/testing`'s, on Clerk's Frontend API. The run covers desktop Chromium on one Mac only.

## Open decisions for Sam

1. The middleware: keep gating on the Clerk claim (and add `"metadata": "{{user.public_metadata}}"` to the session token in the Clerk dashboard), or read the DB-backed gate. Witnesses: `tests/unit/middleware.onboarding-loop.witness.test.ts` and the expected-to-fail test at the top of `tests/e2e/journeys.spec.ts` (686 requests for `/onboarding` in 10 s after finishing).
2. Clerk's own redirect after sign-up stalls on `/sign-up/verify-email-address`: its server action posts there and the middleware redirects it. The same decision fixes it.

## Observed, not fixed

- In the J run, a signed-out visitor to `/app/call/<id>` was let through by the middleware 10 of 10 times, and the call room's server check rendered the `signed_out` refusal; on the proof path the middleware redirected to Clerk's hosted sign-in. One earlier run redirected `/app/call/<id>` as well. After the refusal renders, a keyless-mode Clerk server action fails in the browser and Next shows its client error screen. J7 checks the served document either way.
- `src/db/index.ts` connects at import and logs `Database connection failed` during `pnpm build` when the stack database is down; the build still exits 0.
- `src/app/app/layout.tsx` renders its own `<html>` inside the root layout's, which logs a hydration mismatch on every `/app` page.

## How to continue

```sh
pnpm install --frozen-lockfile
LINKEDUP_JOURNEY_PROOF=1 pnpm dev:up        # Postgres on :54329, keyless next dev on :3000
pnpm exec vitest run
pnpm exec playwright test tests/e2e/journeys.spec.ts --project=desktop   # J_SEEDS=1 for a quick pass
pnpm dev:down
```

Next is LS1: port Connvo's p2p transport with a Postgres-backed signaling route behind Clerk, then H-01..H-14 at 3 seeds.
