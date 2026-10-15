# Handoff — LinkedUp landing rewrite on the maintenance base

This branch (`obv/products-l2-linkedup-public-site-20261010`, draft PR
SamGu-NRX/LinkedUp#6) carries the public landing rewrite on top of the
predecessor-maintenance work (`obv/products-linkedup-maintenance-20261009`,
draft PR SamGu-NRX/LinkedUp#5). The branch merged the advanced maintenance
base (`3be70b2`) after that branch gained the onboarding failure-path tests
and the Handoff re-verification; the two workstreams' handoffs are kept
verbatim below.

## Part 1 — Predecessor maintenance (from the base branch, PR #5)

Draft PR: [#5](https://github.com/SamGu-NRX/LinkedUp/pull/5) — `obv/products-linkedup-maintenance-20261009` → `main`.
Scope: predecessor-maintenance only (restore a buildable, honest demo). Not a new matching design, no product expansion.

### What this branch does

- Restores `pnpm build`, `tsc --noEmit`, and `pnpm lint` to clean (baseline failures reproduced on `main` at `da3ebbf` first — see the verification table in the PR description).
- Removes the broken `/app/call/[id]` route (imported a nonexistent `VoiceCallScreen`), empty `/api/messages` stub, empty Prisma module, duplicate users schema, and unused GSAP/Lenis/FadeInWhenVisible utilities.
- Moves Clerk sign-in/sign-up catch-alls to top-level routes matching the middleware config.
- Onboarding action: server-side zod validation; Clerk `onboardingComplete` metadata written LAST; failure paths return structured errors and a retry self-heals through the update path. Unit tests register these failure/retry paths.
- Rewrites `TimeManager` with elapsed-time state, single-flight extension requests, capped additions, and cooldown retained after completion.
- Adds Vitest with 27 unit tests (TimeManager, onboarding action, middleware).
- Rewrites the README to describe the actual single Next.js app.

### Local runtime checks — exact commands

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

The publishable key must be structurally valid, not just non-empty: Clerk
base64-decodes it into a frontend-API URL, so a bare string fails the build with
"publishableKey ... is invalid". The exported key above works; an equivalent form
(verified 2026-10-11) is
`pk_test_$(printf 'https://linkedup-build-placeholder.clerk.accounts.dev$' | base64 -w0)`.

### Verification record

Independently re-verified 2026-10-11 on the pushed `d3b9951` tree: vitest 27/27,
`tsc --noEmit` exit 0, `pnpm lint` exit 0 (same 3 img warnings), build with the
placeholder keys above exit 0 with 16/16 routes prerendered.

| Gate | `main` @ `da3ebbf` | This branch @ `08dff14` | This branch + handoff/tests commit |
|---|---|---|---|
| `pnpm build` | ❌ webpack module-not-found (`VoiceCallScreen`) | ✅ 16/16 routes | ✅ exit 0, 16/16 routes |
| `tsc --noEmit` | ❌ 33 errors | ✅ exit 0 | ✅ exit 0 |
| `pnpm lint` | ❌ 3 `react-hooks/rules-of-hooks` errors | ✅ exit 0 (3 img warnings) | ✅ exit 0 (3 img warnings) |
| `vitest run` | n/a (no tests existed) | ✅ 23/23 | ✅ 27/27 |

### Remaining integration limits (read before wiring real services)

- **No real Stream-backed call room.** The videocall page is a mock-based demo with a deterministic timer. The reusable `StreamClientProvider` is retained but unused by routes; a real room needs a new route wired to Stream credentials and the existing components.
- **No live Clerk / database / Stream credentials were exercised.** All checks run with placeholder keys and mocked providers; middleware redirects, onboarding persistence, and Clerk metadata behavior are unit-tested, not integration-tested.
- **The onboarding save action does not wrap steps 3–5 in a transaction.** A failure
  between the users-row write and the interests insert leaves a users row with missing
  interests until the next retry repairs it. Local mocks cannot surface this; only a
  live-database run can.
- **Onboarding expects a reachable Postgres** (Drizzle) and Clerk user emails; first sign-up inserts the user row, later runs take the update path and clear/re-insert interests.
- **No ML matching service.** Match queues are demo-populated; nothing in this branch adds a matching design.
- **The `/app/professional/*` and `/app/smart-connection` pages** read `useSearchParams` inside Suspense boundaries; their queues are demo data.
- **Three `<img>` lint warnings** remain (landing page, one-on-one meeting) — cosmetic, untouched to keep scope.
- **Tracked evidence for the public landing** lives on the separate public-site branch (PR #6), not here; nothing under `evidence/` was deleted or modified in this PR.

## Part 2 — Public landing rewrite (this branch, PR #6)

Branch `obv/products-l2-linkedup-public-site-20261010` →
`obv/products-linkedup-maintenance-20261009` as draft PR
SamGu-NRX/LinkedUp#6 (retargeted from `main`, so the PR diff carries only the
landing work: maintenance changes stay in PR #5 and the portfolio entry stays
in PR #3 — this branch no longer carries `.portfolio/project.md`). Authored by
Sam Gu <127461594+SamGu-NRX@users.noreply.github.com> on every commit, with
`Co-authored-by: obvious-autobuild[bot]` on every commit created after the
retarget. **Not merged, not deployed.** Base: maintenance branch tip
(`3be70b2`, merged into this branch after it advanced past `08dff14`).

Commit history on this branch (rebased onto the maintenance head, then
merged with the base's advance):

- `c01ed4a` — file:line claim and link ledger for the PR5 landing (amended to
  drop the portfolio file and add the bot co-author trailer)
- `dac97c7` — Playwright evidence rig and PR5 baseline captures
- `74dfba1` — landing rewrite grounded in the README and portfolio
- `8efa718` — final landing validation and recaptured captures
- `f661788` — retarget follow-up: honest Connvo successor note, updated
  ledger and captures, handoff
- `6458e51` — evidence toolchain isolated in `evidence/linkedup-site`;
  root `package.json`/`pnpm-lock.yaml` restored to the base

### What is complete

1. **Claim/link audit** (`evidence/linkedup-site/claims-ledger.md`): the PR5
   landing had 20 inventoried claims — 16 fabricated, misleading, or puffery
   (invented retention chart, 50K+/92%/4.8/5/120+ stats, BS-Detection /
   Trust-Score cards, three testimonials, "join thousands") — plus a broken
   `#how-it-works` anchor and misleading pricing/testimonials nav items.
2. **Landing rewrite** (`74dfba1`, `src/app/page.tsx`): every remaining claim
   traces to the README or `.portfolio/project.md`. The page now carries an
   honest where-it-stands ledger (real / simulated / dormant), the real
   hackathon history, and links only to real routes and the public GitHub
   repos. Final counts: 18 claims, 0 fabricated, 9 link actions, 0 broken
   (`evidence/linkedup-site/claims-ledger-final.md`).
3. **Honest Connvo successor note** (`f661788`, owner-directed): the history
   paragraph names and links the successor project, Connvo
   (github.com/SamGu-NRX/Connvo, public), states it is in development in its
   own repository, and explicitly claims nothing about its features,
   timeline, or availability. The relationship is grounded at the
   repository-ownership level; Connvo's README itself makes no LinkedUp
   claim, and no maintenance-owner file was rewritten.
4. **Runtime fixes found by the checks**: visible `focus-visible` keyboard
   rings on every control (the shared `globals.css` outline rule computes to
   `none` because `--ring` is HSL parts inside `rgba()` — left untouched,
   fixed in the page), WCAG contrast on primary CTAs (emerald-800), always
   underlined footer source link, reduced-motion support
   (`MotionConfig reducedMotion="user"` + instant scroll fallback), and
   play-once in-view animations.
5. **Final evidence** (`8efa718` + `f661788`): Playwright suite against the
   production build on :3210 — **16 passed, 0 failed** across
   desktop-1440x900 and mobile-390x844: screenshots (recaptured after the
   Connvo note), keyboard operation (which caught and rejected the Connvo
   link's first version — it shipped without a visible focus ring), reduced-
   motion stability, axe serious/critical on load and full scroll (zero
   violations), link check, repeated-load layout shift (zero).
   `tsc --noEmit` pass; eslint 0 errors (1 pre-existing `<img>` warning);
   `pnpm build` pass, 16/16 pages.
6. **Evidence toolchain isolated** (`6458e51`): the three Playwright
   devDependencies (`playwright`, `@playwright/test`, `@axe-core/playwright`)
   and their lockfile moved out of the repo root into
   `evidence/linkedup-site/package.json` + `evidence/linkedup-site/pnpm-lock.yaml`
   (with a local `.gitignore` for `node_modules/`). Root `package.json` and
   `pnpm-lock.yaml` are restored byte-for-byte to the base, so the PR's diff
   touches no root file. Evidence tests, findings, results, and screenshots
   are untouched and the full suite re-passed 16/16 run from the owned
   directory.
7. **Base reconciliation** (merge commit): the only conflict against the
   advanced base was HANDOFF.md (add/add); this combined file is the
   resolution. Re-validation on the merged tree: vitest 27/27, `tsc
   --noEmit` clean, production build green, Playwright suite 16/16 from
   `evidence/linkedup-site/`.

### What remains

- Review and approval of the draft PR (the deliverable; nothing is merged).
  Merge order matters: PR #5 (maintenance) and PR #3 (portfolio) are its
  siblings on `main`; this PR now stacks on the maintenance branch.
- Optional follow-ups, not started: fixing the invalid `rgba(var(--ring))`
  rule in the shared `globals.css` (the page works around it), swapping the
  `<img>` for `next/image`, and landing-copy iterations after review feedback.

### How to resume

```
cd /home/user/work/LinkedUp-landing
# root app: build and serve the production landing on :3210
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucGxhY2Vob2xkZXIubG9jYWwk \
CLERK_SECRET_KEY=sk_test_dummyplaceholderforlocalruns PORT=3210 pnpm start
# evidence toolchain: deps live in evidence/linkedup-site, not the repo root
cd evidence/linkedup-site && pnpm install && pnpm test
```

The Clerk key is a synthetic local-run placeholder (`clerk.placeholder.local$`
base64) — no real Clerk tenant was touched. For real auth you need the
project's own keys. Re-run `pnpm build` first if `.next` is missing (it is
gitignored); do not run `next dev` and `next build` on the same `.next`
simultaneously — the mixed turbopack output breaks `next start`.

## Guardrails honored

No merge, no deploy, no default-branch push, no workflow or settings edits,
no paid-service or live-model steps, no rewriting of the maintenance owner's
files (README and portfolio are referenced read-only). Local evidence only.
