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
- **Two onboarding fixes** (per plan): invalid wizard form submission now returns early; Clerk metadata completion is only marked after database persistence succeeds.

## Proof

Commands (run in the repo root, pnpm 10.34.6 / Node 20.20.2):

| Check | Command | Baseline | Now |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 31 errors | **0 errors (exit 0)** |
| Lint | `npx next lint` | 3 errors (conditional hooks) | **0 errors (exit 0)**, warnings only (`<img>` in one-on-one meeting) |
| Build | `pnpm build` | fail (missing VoiceCallScreen module) | **webpack compiles successfully**; static prerender currently fails — see Known issues |

**Known issues at this checkpoint (honest):**

1. `pnpm build` compiles all code but static prerendering fails at `/app/professional/b2b`: `useSearchParams()` needs a `<Suspense>` boundary (Next.js CSR bailout). Fix identified (wrap the page's client component in Suspense, standard Next pattern); several other pages using `useSearchParams` (e.g. `/app/app/call/[id]`) will need the same treatment. This is the immediate next step.
2. Static prerendering requires a Clerk publishable key. `pnpm dev` is truly keyless (Clerk 6.12.5 keyless instances — verified `Ready` boot). For `pnpm build`, `.env.local` needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA` (a syntactically valid placeholder, not a real key — passes Clerk's structure check, no real instance behind it). `.env*` is gitignored; the key is documented here so any contributor can reproduce the build.
3. `next dev` route checks returned HTTP 500 while `next dev` and `next build` competed for the same `.next` directory; dev-server route verification is still pending (needs a rerun without a concurrent build).

## Handoff

**Done (this checkpoint):** all of the above; ~38 files changed on the branch, uncommitted until this commit.

**Left (in plan order):**

1. Wrap `useSearchParams` consumers in `<Suspense>` (b2b page + any others), get `pnpm build` fully green, commit as milestone 2a.
2. Dev-server route verification (sign-in, dashboard, call screens) without a concurrent build; record HTTP status per route.
3. Milestone 2: onboarding polish/QA per plan (the two fixes above are in; revisit wizard edge cases).
4. Milestone 3: real transport wiring behind `src/lib/call/transport.ts` (already byte-identical to Connvo alpha, L-D5 satisfied); replace the honest `joining` placeholder in VoiceCallScreen with real snapshots.
5. Stream API key needed from the operator for live call media — not yet provided; all call UI is verified structurally until then.

**How to continue:** check out `obv/linkedup-journey-foundation-f1`, `pnpm install`, create `.env.local` per the Proof section, `npx tsc --noEmit && npx next lint && pnpm build`. Fix the Suspense issue first. Keep commits authored as Sam Gu with the Co-authored-by trailer; update this file with each push.
