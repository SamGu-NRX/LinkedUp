# LinkedUp call plan

Owner: the Connvo/LinkedUp lead (fleet). Task prompts quote this file by section ID. Integration branch: `alpha`
(cut from `main` at da3ebbf4a22b). Nothing here merges to `main`.

LinkedUp is Connvo's predecessor. The two share the call problem, so LinkedUp reuses Connvo's harness design and,
after Connvo's round 1, its winning transport. Connvo's plan is the reference for the harness:
https://github.com/SamGu-NRX/Connvo/blob/alpha/docs/plan/CALL-PLAN.md

## Goal

Two people sign up, finish onboarding, enter the match queue, get matched to each other, and land in the same real
call: each sees and hears the other, controls work on both sides, a drop or reload recovers, leaving releases the
camera, and both see a summary built from the real call. Proven with two browsers through the normal routes, not a
fixture, prerecorded HTML or a page that intercepts its own requests.

## State on main (da3ebbf)

- Auth is Clerk 6.12.5; data is Postgres through Drizzle (`src/db/`). No tests, no test runner.
- No real call. `/videocall/[id]` is a simulation with placeholders. `/app/call/[id]` imports
  `@/components/call/VoiceCallScreen`, which doesn't exist, so it can't build.
- Matching is mock data and local timers (`src/components/queue/*`).
- Clerk pages live at `/app/sign-in` and `/app/sign-up`, but the middleware only lets signed-out users reach
  `/sign-in` and `/sign-up`.
- `src/app/app/providers.tsx` mounts Stream and throws without a Stream key.
- PRs #5, #6 and #8 belong to retired writers and are read-only inputs. #5's auth-route and build fixes are worth
  reimplementing; #6 (landing) and #8 (demo) sit in Sam's reserved area and are not integrated.

## Reserved for Sam (do not edit)

`src/middleware.ts`, `src/app/layout.tsx`, `src/app/providers.tsx`, `src/app/page.tsx` (landing), and any `/demo`
route. If one of them blocks a step, commit a failing witness and ask the lead. Don't route around it with request
interception.

## Decisions already made (don't ask again)

- **L-D1. Test auth.** Use Clerk's keyless mode: with no keys set, `next dev` provisions a temporary, unclaimed
  development instance. Sign in through `@clerk/testing` with synthetic users. Never use Sam's Clerk tenant or real
  people's data. If keyless mode can't run in the sandbox, record the exact command and error, and the lead will ask
  Sam for development keys.
- **L-D2. Database.** A local open-source Postgres (system binary, embedded-postgres, or PGlite's socket server),
  migrated with Drizzle and seeded by script. Never the hosted Supabase database.
- **L-D3. Auth pages.** Moving Clerk's pages to top-level `/sign-in` and `/sign-up` (matching the middleware's public
  list, as #5 did) is allowed, since those files aren't reserved.
- **L-D4. Stream.** `src/app/app/providers.tsx` may mount Stream only when its key is set, so `/app` works without
  one. No Stream calls: they need keys we don't have.
- **L-D5. Transport seam.** Copy Connvo's `src/lib/call/transport.ts` verbatim. The call page depends only on it.
- **L-D6.** Run heavy work in the Obvious sandbox, not on Sam's Mac.

## Evals

- **J (journey), built in LS0:** two isolated browsers each sign up, complete all five onboarding steps (persisted
  rows checked in Postgres), enter the queue, get matched to each other by real server-side pairing, and land on the
  same `/app/call/[id]`. Cases: both queue at once; one queues first; one cancels; three users (exactly one pair
  forms, the third keeps waiting); reload while queued; Back from the call; signed-out access to `/app/call/[id]`.
  Pass: every case, 10 seeds each, with no request interception of app documents or APIs.
- **H and P, built in LS1:** Connvo's H-01..H-16 and P-01..P-05, ported, run on the LinkedUp call page with the same
  pass bar.

## Steps

- **LS0, journey foundation.** Local stack (L-D1, L-D2), auth pages (L-D3), Stream optional (L-D4), onboarding
  working end to end, DB-backed matching, a buildable call route that meets Connvo's DOM contract and shows honest
  connecting and failed states, plus the J suite. Task `linkedup-journey-foundation-f1`.
- **LS1, real media.** After Connvo's council picks a transport: port the harness and that transport, with LinkedUp's
  own signaling or token endpoint behind Clerk, and run H and P.
- **LS2, after the call.** A summary from the real call, call history, and polish from running `alpha`.

## Stop rule

Done locally when J, H and P pass on `alpha`. Stop a direction after two rounds that don't move those numbers.
Record the reason here.
