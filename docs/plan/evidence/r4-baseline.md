# r4 baseline — `obv/linkedup-journey-foundation-f1`

Recorded 2026-10-12 by the r4 baseline sub-thread in a **fresh clone** of
`github.com/SamGu-NRX/LinkedUp` into `/home/user/work/linkedup-r4-baseline`
(anonymous clone; no tree reused from earlier threads). Host: shared Obvious
sandbox — every heavy step ran one at a time under
`flock /home/user/work/heavy.lock`. Nothing was fixed; every number below is
the branch **as inherited at head `4797edd`**. Full per-check logs live on the
sandbox at `/home/user/work/r4-baseline-logs/` (not committed).

## Head and ancestry

- **HEAD:** `4797edd6b42b41947439010fde79ff4ccfba1ba7` (branch
  `obv/linkedup-journey-foundation-f1`, tracking `origin/` same) — matches the
  expected tip.
- Last 10 commits (`git log --oneline -10`):

```
4797edd test(onboarding): witness the middleware redirect loop; prove the DB-backed gate on a labelled route
38aaca5 merge: join parent handoff commit 9b9081a into r3 reserved-file repair
63fa409 revert(middleware): restore reserved src/middleware.ts to exactly alpha's version
9b9081a docs(handoff): join r3 baseline result (verified at b93ef42, nothing pushed)
b93ef42 test(journeys): J1–J8 journey specs, hardened persona helper, serial fake-media config
c2034dc fix(gate): DB-backed onboarding gate for /app and /onboarding
ecd18b2 docs: handoff — LS0 stack (dev:up) + Playwright smoke, verification matrix
292aa77 feat: Playwright tooling — desktop/mobile projects + keyless-Clerk smoke journey
9e54e76 feat: one-command local stack — pnpm dev:up (PG 17 + migrate + seed hook + keyless dev)
58ec020 docs: handoff — M2 checkpoint (bdcee5e) evidence and LS0 progress
```

## Toolchain

- node `v20.20.2`
- pnpm `10.34.5`
- `AGENTS.md` does not exist at the repo root; `.obvious/skills/` absent.

## Summary matrix

| # | Check | Command | Exit | Duration | Result |
|---|---|---|---|---|---|
| 1 | Install | `pnpm install --frozen-lockfile` | 0 | 46 s | clean; pnpm: "Done in 45.3s" |
| 2 | Typecheck | `npx tsc --noEmit` | 0 | 26 s | **0 errors** |
| 3 | Lint | `npx next lint` | 0 | 14 s | **0 errors**, 3 warnings (inherited) |
| 4 | Build | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA pnpm build` | 0 | 152 s | compiled successfully, static pages 15/15 |
| 5 | Vitest | `pnpm exec vitest run` | 0 | 15 s | **13/13 passed** (3 files) |
| — | Playwright e2e | `pnpm test:e2e` | **NOT RUN** | — | **BLOCKED — browser revision mismatch, see below** |

## 1. Install

- Command: `pnpm install --frozen-lockfile` — exit 0, 46 s (46,552 ms wall).
- Output tail: `+ tsx 4.19.3 + typescript 5.7.3 + vitest 3.2.7 … Done in 45.3s using pnpm v10.34.5`.
- One benign pnpm 10 notice: `Ignored build scripts: @clerk/shared@3.0.1`
  (allowlist behaviour, not a failure).
- Note: the README's "npm install" line is stale for this branch — the f1
  handoff records that the lockfile is pnpm-managed and `npm install`
  corrupts/cannot reify it. pnpm is the repo's standard install.

## 2. Typecheck

- package.json has **no `typecheck` script**; the command the handoffs use is
  `npx tsc --noEmit` (typescript 5.7.3 from devDependencies).
- Command: `npx tsc --noEmit` — **exit 0, 26 s**, output empty ⇒ 0 errors.

## 3. Lint

- Command: `npx next lint` — **exit 0, 14 s**.
- **0 errors**, 3 warnings — all three are the same inherited `<img>`
  warnings recorded at the r3 baseline (`b93ef42`), one of them in a
  reserved file (noted only, not edited):

```
./src/app/page.tsx
76:11  Warning: Using `<img>` … @next/next/no-img-element

./src/components/app/one-on-one-meeting.tsx
175:15  Warning: Using `<img>` … @next/next/no-img-element
204:15  Warning: Using `<img>` … @next/next/no-img-element
```

## 4. Build

- Preconditions (inherited, per the f1 handoff's "local env story",
  reproduced here): `.env.local` was created in the clone holding **only**
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/linkedup`
  (gitignored, not committed); the Clerk publishable key is taken **inline**
  — `pk_test_Y2xlcmsubG9jYWxob3N0JA` is a syntactically valid placeholder
  with no real instance behind it. postgres.js connects lazily, so the build
  needs no live database.
- Command: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA pnpm build`
  — **exit 0, 152 s**.
- Key output: `✓ Compiled successfully`, `✓ Generating static pages (15/15)`.
- Route table (verbatim):

```
Route (app)                                 Size  First Load JS
┌ ○ /                                     112 kB         260 kB
├ ○ /_not-found                            987 B         102 kB
├ ƒ /app                                 6.37 kB         180 kB
├ ƒ /app/call/[id]                       5.31 kB         118 kB
├ ƒ /app/dashboard                       94.9 kB         292 kB
├ ƒ /app/match-queue                     1.89 kB         191 kB
├ ƒ /app/professional                    2.68 kB         150 kB
├ ƒ /app/professional/b2b                2.92 kB         192 kB
├ ƒ /app/professional/collaboration      2.92 kB         192 kB
├ ƒ /app/professional/investment         2.92 kB         192 kB
├ ƒ /app/professional/mentorship         2.92 kB         192 kB
├ ƒ /app/profile                         3.85 kB         151 kB
├ ƒ /app/settings                        4.22 kB         152 kB
├ ƒ /app/smart-connection                3.44 kB         113 kB
├ ƒ /gate-proof                            150 B         101 kB
├ ƒ /onboarding                          48.8 kB         239 kB
├ ƒ /sign-in/[[...sign-in]]              2.14 kB         132 kB
├ ƒ /sign-up/[[...sign-up]]              2.14 kB         132 kB
└ ƒ /videocall/[id]                      10.2 kB         211 kB
```

  19 app routes, including the labelled `/gate-proof` route committed in
  `4797edd`. Middleware: 70.4 kB.

## 5. Vitest

- Command: `pnpm exec vitest run` — **exit 0, 15 s**, config
  `vitest.config.ts` (jsdom, includes `tests/unit/**/*.test.{ts,tsx}`).

```
 ✓ tests/unit/voice-call-screen.honesty.test.tsx (8 tests) 393ms
 ✓ tests/unit/middleware.onboarding-loop.witness.test.ts (1 test) 59ms
 ✓ tests/unit/gate-proof.route.test.tsx (4 tests) 63ms
 Test Files  3 passed (3)
      Tests  13 passed (13)
```

- The 1-test witness file is the deliberate `4797edd` middleware
  redirect-loop witness — its passing is the expected signal, not a
  suppressed failure.

## 6. Playwright e2e — NOT RUN (blocker)

- package.json pins `@playwright/test` **exactly 1.63.0** (pin not touched).
  Its `node_modules/.pnpm/playwright-core@1.63.0/.../browsers.json` requires
  chromium revision **1243** and chromium-headless-shell **1243**.
- This sandbox's `~/.cache/ms-playwright` holds only **chromium-1248**,
  **chromium_headless_shell-1248**, and `ffmpeg-1013` — the required 1243
  builds are **missing**. (The r3 baseline recorded 1243 cached at that
  time; the shared cache has since been replaced, likely by another stack.)
- Per task protocol the pin is **not** upgraded and no browser is
  **downloaded**, so `pnpm test:e2e` / `pnpm exec playwright test` was not
  run in this baseline. This blocks the **e2e arm only** — checks 2–5 above
  need no browser. Unblocking (operator's call): restore chromium 1243 to
  `~/.cache/ms-playwright`, or have the pin's owner run
  `pnpm exec playwright install chromium`.

## Verdict

Fresh-clone baseline at `4797edd` is **green on all four required checks**:
typecheck 0 errors, lint 0 errors (3 inherited `<img>` warnings), build
exit 0 (15/15 static pages), Vitest 13/13. One tooling blocker recorded for
the Playwright e2e arm (chromium 1243 missing from the shared cache).
Nothing fixed, no reserved files touched.
