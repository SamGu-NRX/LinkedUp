# LinkedUp — Journey Foundation F1 Handoff

Branch: `obv/linkedup-journey-foundation-f1` (based on `origin/alpha` = `58dfa67f26fb8af6906bf3913ddb3eb9da0dde03`)
Task: implement the LinkedUp call journey per `CALL-PLAN.md`, Milestone 1 (journey foundation repair).
Author: Sam Gu <127461594+SamGu-NRX@users.noreply.github.com> · Co-authored-by obvious-autobuild[bot].

## Description

Milestone 1 restores the app to a compiling, linting state and builds the foundation the call journey needs:

- **Removed dead code blocking the build**: unused GSAP/Lenis utilities (no importers) and the empty `src/app/api/messages/route.ts` (generated route types errored on it).
- **Repaired ~31 TypeScript baseline errors** across pagination, action buttons, calendar (react-day-picker v9 Chevron API), `FadeInWhenVisible` JSX types, one-on-one meeting callbacks, dashboard UserCard/ScheduleCallForm props, videocall helpers, MatchNotification, interest-badge typing (loosened for free-form interests with a neutral fallback), and connection-status typing (central union widened to cover both presence and quality values actually used at runtime).
- **Fixed the React rules-of-hooks violation** in `UserCard` (missing-user early return now sits below hook calls).
- **Created `src/components/call/VoiceCallScreen.tsx`** implementing the documented call DOM contract: participant rows, accessible controls, timer, stable test selectors. Honest state machine — the phase stays `joining` until real transport wiring lands (M3); no fabricated transport state or remote audio.
- **Restored Clerk auth routes**: top-level `/sign-in` and `/sign-up` catch-all pages matching middleware expectations; removed the misplaced `src/app/app/(auth)` group.
- **Guarded the Stream provider** so keyless development skips Stream initialization instead of throwing on the missing API key (initializes normally once `NEXT_PUBLIC_STREAM_API_KEY`/secret are configured).
- **Wrapped the six `useSearchParams` pages** (b2b, collaboration, investment, mentorship, smart-connection, call) — inner content component behind a `<Suspense>` boundary — so static prerendering succeeds (Next.js CSR bailout fix).
- **Two onboarding fixes** (per plan): invalid wizard form submission now returns early; Clerk metadata completion is only marked after database persistence succeeds.

## Proof

Commands (run in the repo root, pnpm 10.34.6 / Node 20.20.2):

| Check | Command | Baseline | Now |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 31 errors | **0 errors (exit 0)** |
| Lint | `npx next lint` | 3 errors (conditional hooks) | **0 errors (exit 0)**, warnings only (`<img>` in one-on-one meeting) |
| Build | `pnpm build` | fail (missing VoiceCallScreen module) | **exit 0 — compiles and prerenders all 16 pages** (placeholder-format Clerk pk, see env story) |
| Unit tests | `pnpm exec vitest run` | no tests in repo | **8/8 passed** (M2 honesty suite) |

**Dev-server route verification (keyless Clerk, `pnpm dev`, isolated `.next`, clean run):**

| Route | Status | Note |
|---|---|---|
| `/` | 200 | |
| `/sign-in` | 200 | Clerk catch-all renders |
| `/sign-up` | 200 | Clerk catch-all renders |
| `/onboarding` | 200 | requires `DATABASE_URL` in `.env.local` (db import at module load) |
| `/app` | 200 | Stream provider skips init in keyless mode |
| `/app/call/test123?type=casual` | 200 | VoiceCallScreen route |
| `/app/professional/b2b` | 200 | Suspense-wrapped |
| `/app/smart-connection` | 200 | Suspense-wrapped |
| `/videocall/test123` | 200 | |

Note: `/dashboard` is a 404 — no such page exists in the skeleton (the app dashboard lives at `/app`), while `.env.local.example` still references `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`; left as-is (example config only, no runtime impact in keyless mode).

**Local env story (reproduces both modes):** `.env.local` holds only `DATABASE_URL` — dev runs fully keyless (Clerk 6.12.5 keyless instances). Builds take the placeholder key inline: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA pnpm build` (a syntactically valid placeholder — passes Clerk's structure check, no real instance behind it; `.env*` is gitignored). Do not put the key in `.env.local` — with it present, dev leaves keyless mode and every route 500s with `Missing secretKey`; keep the two modes separate.

**Known issues at this checkpoint (honest):**

1. No tests exist in the repo; milestone evidence is the check matrix and route smoke tests above, plus manual UI verification pending Stream keys.
2. Call transport and real peer media are LS1, outside this task: VoiceCallScreen shows honest `joining` and the partner as "waiting for media transport". Stream is out per L-D4.

## Handoff

**Done (this checkpoint):** all Description items plus the full green matrix above: typecheck 0, lint 0, build exit 0 with all 16 pages prerendered, and keyless-dev route smoke tests passing.

**M2 checkpoint (`bdcee5e`, pushed):** local media capture + DB-backed matching + honest call route, all verified (typecheck 0, lint 0, build 15/15 pages, vitest 8/8). VoiceCallScreen now runs a real `getUserMedia` capture — phase machine advances `joining → connected` only on live local capture; mic/camera toggles really stop and re-acquire tracks; permission/no-device states with working retry; remote side honestly reports "audio not connected — waiting for media transport" (no `data-remote-audio` pretense). Call route enforces server-side room membership; participants come from the room record. Matching: transactional pairing reads `FOR UPDATE SKIP LOCKED` via postgres-js RowList indexing (fixed `.rows` type/runtime error). Tooling: Vitest 3 + Testing Library, jsdom 26 (jsdom 30 needs Node 22; this is Node 20), esbuild automatic JSX (the `@vitejs/plugin-react` build in the lockfile imports a vite subpath the resolved vite does not export — plugin removed). The repo's `node_modules` is pnpm-managed; `npm install` corrupts/cannot reify it — use `pnpm`.

**Scope note (per checkpoint review):** real peer media is LS1, a later task that ports the transport Connvo's harness picks; Stream stays out per L-D4. Nothing in this task requires a Stream API key.

**Left — LS0 deliverables (in order):**

1. One-command local stack: local open-source Postgres (L-D2), Drizzle migrate, seed, then keyless `next dev`.
2. ~~Auth pages~~ — done in this checkpoint (top-level `/sign-in` and `/sign-up`, L-D3).
3. ~~Real DB-backed matching~~ — done in M2 (`bdcee5e`): queue/pairing in Postgres through Drizzle, transactional pairing with `FOR UPDATE SKIP LOCKED`, room records driving the call route. Cancellation and stale-entry expiry still to verify end to end.
4. ~~Buildable call route with honest states~~ — done in M2: server-side room-membership enforcement, participants from the room record, honest "waiting for media transport" remote row, no fake remote tiles.
5. ~~Local media on the call page~~ — done in M2: `getUserMedia` preview, real track stop/restart for mic and camera toggles, permission/no-device states with working retry; pinned by the 8-test vitest honesty suite.
6. The J suite: two isolated browsers sign up through keyless Clerk via `@clerk/testing`, complete onboarding, queue, match and land in the same `/app/call/[id]` — every case in the plan's J list, 10 seeds each, no request interception, persisted rows checked in Postgres.
7. Tooling for the above: Vitest done in M2; Playwright (journeys, screenshots) still pending, plus call-page screenshots at 1440x900 and 390x844 and a prep-for-prod pass before the final push.

**How to continue:** check out `obv/linkedup-journey-foundation-f1`, `pnpm install`, create `.env.local` per the env story above, run the one-command local stack script (landing in the next push), then `npx tsc --noEmit && npx next lint` and the inline-key `pnpm build` (all green at this checkpoint). Keep commits authored as Sam Gu with the Co-authored-by trailer; update this file with each push.
