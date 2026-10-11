# Handoff — LinkedUp predecessor maintenance

Draft PR: [#5](https://github.com/SamGu-NRX/LinkedUp/pull/5) — `obv/products-linkedup-maintenance-20261009` → `main`.
Scope: predecessor-maintenance only (restore a buildable, honest demo). Not a new matching design, no product expansion.

## What this branch does

- Restores `pnpm build`, `tsc --noEmit`, and `pnpm lint` to clean (baseline failures reproduced on `main` at `da3ebbf` first — see the verification table in the PR description).
- Removes the broken `/app/call/[id]` route (imported a nonexistent `VoiceCallScreen`), empty `/api/messages` stub, empty Prisma module, duplicate users schema, and unused GSAP/Lenis/FadeInWhenVisible utilities.
- Moves Clerk sign-in/sign-up catch-alls to top-level routes matching the middleware config.
- Onboarding action: server-side zod validation; Clerk `onboardingComplete` metadata written LAST; failure paths return structured errors and a retry self-heals through the update path. Unit tests register these failure/retry paths.
- Rewrites `TimeManager` with elapsed-time state, single-flight extension requests, capped additions, and cooldown retained after completion.
- Adds Vitest with 27 unit tests (TimeManager, onboarding action, middleware).
- Rewrites the README to describe the actual single Next.js app.

## Local runtime checks — exact commands

Run from the repo root. Checks were executed with pnpm 10.34.6 on Node (sandbox) against `08dff14` + this handoff commit, and previously against `08dff14` alone and baseline `da3ebbf`.

```bash
# 1. Install (frozen lockfile)
pnpm install --frozen-lockfile

# 2. Placeholder Clerk config — syntactically valid keys; no live backend is contacted.
#    Needed by any command that imports Clerk server code or builds.
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bGlua2VkdXAtZGVtby0wMDEuc2FtcGd1LmNvbSQ
export CLERK_SECRET_KEY=sk_test_bGlua2VkdXAtZGVtby0wMDE

# 3. Unit tests (Vitest)
pnpm exec vitest run            # 27/27 passing

# 4. Typecheck
pnpm exec tsc --noEmit          # exit 0
#    If you see TS2307 errors under .next/types referencing deleted routes,
#    clear the stale build cache first: rm -rf .next

# 5. Lint
pnpm lint                       # exit 0; 3 pre-existing @next/next/no-img-element warnings remain

# 6. Production build
pnpm build                      # exit 0; 16/16 routes
```

A root-owned `node_modules` from a previous sandbox image required `sudo rm -rf node_modules` before the first frozen install; if `pnpm install` fails with EACCES under `.pnpm`, that is why.

## Verification record

| Gate | `main` @ `da3ebbf` | This branch @ `08dff14` | This branch + handoff/tests commit |
|---|---|---|---|
| `pnpm build` | ❌ webpack module-not-found (`VoiceCallScreen`) | ✅ 16/16 routes | ✅ exit 0, 16/16 routes |
| `tsc --noEmit` | ❌ 33 errors | ✅ exit 0 | ✅ exit 0 |
| `pnpm lint` | ❌ 3 `react-hooks/rules-of-hooks` errors | ✅ exit 0 (3 img warnings) | ✅ exit 0 (3 img warnings) |
| `vitest run` | n/a (no tests existed) | ✅ 23/23 | ✅ 27/27 |

## Remaining integration limits (read before wiring real services)

- **No real Stream-backed call room.** The videocall page is a mock-based demo with a deterministic timer. The reusable `StreamClientProvider` is retained but unused by routes; a real room needs a new route wired to Stream credentials and the existing components.
- **No live Clerk / database / Stream credentials were exercised.** All checks run with placeholder keys and mocked providers; middleware redirects, onboarding persistence, and Clerk metadata behavior are unit-tested, not integration-tested.
- **Onboarding expects a reachable Postgres** (Drizzle) and Clerk user emails; first sign-up inserts the user row, later runs take the update path and clear/re-insert interests.
- **No ML matching service.** Match queues are demo-populated; nothing in this branch adds a matching design.
- **The `/app/professional/*` and `/app/smart-connection` pages** read `useSearchParams` inside Suspense boundaries; their queues are demo data.
- **Three `<img>` lint warnings** remain (landing page, one-on-one meeting) — cosmetic, untouched to keep scope.
- **Tracked evidence for the public landing** lives on the separate public-site branch (PR #6), not here; nothing under `evidence/` was deleted or modified in this PR.
