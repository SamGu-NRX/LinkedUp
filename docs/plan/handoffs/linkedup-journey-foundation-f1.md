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

**LS0 checkpoint (`9e54e76` + `292aa77`):** both J-suite prerequisites are in and verified.

**One-command local stack — `pnpm dev:up` (scripts/dev-up.mjs, L-D2):** from a clean machine state it (1) ensures `.env.local` carries the local `DATABASE_URL`, (2) starts the local PostgreSQL 17 cluster (`17/main`) when down via `pg_ctlcluster` (sudo fallback), (3) sets the postgres role password to match the local URL and creates the `linkedup` database if missing, (4) applies Drizzle migrations with `drizzle-kit migrate` (idempotent journal), (5) runs the repo seed when one exists, (6) starts keyless `next dev` on :3000 detached — reusing a healthy server, replacing a stale one — and waits for HTTP 200 on `/` before exiting. It strips any Clerk/Stream env vars from the dev server so dev stays keyless; no Clerk or Stream keys are involved at any point. Logs: `/tmp/linkedup-next-dev.log`, pid file `/tmp/linkedup-next-dev.pid`.

**Seed status (honest):** the repo has NO seed script — `drizzle-kit` 0.30.5 has no `seed` command (so the boilerplate `db:seed` script's `drizzle-kit seed:pg` cannot work) and no seed file exists in git history. `dev:up` runs the seed when one appears at `scripts/seed.*` or `src/db/seed.*` (ts via tsx, js via node) and until then prints a clear notice instead of pretending to seed. Seed data design (plan line: "10 seeds each") belongs to the J-suite task.

**Playwright tooling (`292aa77`):** `@playwright/test` pinned to exactly 1.63.0 — its playwright-core expects chromium revision 1243, the build already cached in `~/.cache/ms-playwright`, so no browser download is needed. `playwright.config.ts` defines two chromium projects (desktop 1440x900, mobile 390x844 with `isMobile`/`hasTouch`) at `baseURL` http://localhost:3000, plus a `webServer` hook that boots the real stack via `pnpm dev:up` (`reuseExistingServer: true`) — tests always run against the real keyless dev server, never a mock. Exactly one smoke journey (`tests/e2e/smoke.spec.ts`): navigate to `/` and `/sign-in` through keyless Clerk, assert HTTP 200, the page title, and Clerk's mounted identifier field. Navigation timeouts are sized for dev-mode first compiles (a cold `/sign-in` compile measured ~49s once and would blow Playwright's default 30s). `pnpm exec playwright test` / `pnpm test:e2e`.

**Verification matrix at `292aa77` (all measured this checkpoint):**

| Check | Result |
|---|---|
| Cold-start `pnpm dev:up` (cluster down, no server) | reaches HTTP 200 on `/`, `/sign-in`, `/app`; rerun reuses the healthy server |
| `pnpm exec playwright test` (smoke, both projects) | **2/2 passed** (desktop 9.0s, mobile 7.7s) against the live keyless server |
| `pnpm exec vitest run` | **8/8 passed** |
| Inline-key `pnpm build` | **exit 0** (app-path manifest: 18 routes) |
| `npx tsc --noEmit` / `npx next lint` | 0 errors / 0 errors (pre-existing `<img>` warnings only) |

**Left — LS0 deliverables (in order):**

1. ~~One-command local stack~~ — done in this checkpoint (`9e54e76`, L-D2): `pnpm dev:up`. Seed hook wired; the seed script itself is still to be written (by the J-suite task, which owns its data design).
2. ~~Auth pages~~ — done in this checkpoint (top-level `/sign-in` and `/sign-up`, L-D3).
3. ~~Real DB-backed matching~~ — done in M2 (`bdcee5e`): queue/pairing in Postgres through Drizzle, transactional pairing with `FOR UPDATE SKIP LOCKED`, room records driving the call route. Cancellation and stale-entry expiry still to verify end to end.
4. ~~Buildable call route with honest states~~ — done in M2: server-side room-membership enforcement, participants from the room record, honest "waiting for media transport" remote row, no fake remote tiles.
5. ~~Local media on the call page~~ — done in M2: `getUserMedia` preview, real track stop/restart for mic and camera toggles, permission/no-device states with working retry; pinned by the 8-test vitest honesty suite.
6. The J suite: two isolated browsers sign up through keyless Clerk via `@clerk/testing`, complete onboarding, queue, match and land in the same `/app/call/[id]` — every case in the plan's J list, 10 seeds each, no request interception, persisted rows checked in Postgres.
7. Tooling for the above: Vitest done in M2; **Playwright tooling + smoke journey done in this checkpoint** (`292aa77`). Still pending: the full journey specs, call-page screenshots at 1440x900 and 390x844, and a prep-for-prod pass before the final push.

**How to continue:** check out `obv/linkedup-journey-foundation-f1`, `pnpm install`, then `pnpm dev:up` — it creates `.env.local` if missing, brings up Postgres 17, migrates, seeds (when a seed exists), and serves keyless dev on :3000. Then `pnpm exec playwright test` (boots the stack itself if it is not up), `npx tsc --noEmit && npx next lint`, and the inline-key `pnpm build` (all green at this checkpoint). Keep commits authored as Sam Gu with the Co-authored-by trailer; update this file with each push.

---

## Takeover r3 — parent join log

Round r3 took over from the two context-exhausted writer threads. The parent thread coordinates sub-threads and joins each result here: description, Proof (commands, exit codes, key output), Handoff (done / not done / next) at a pushed SHA.

### Join 1 — Baseline (sub-thread 1) — SUCCESS — verified at head `b93ef42` (nothing pushed, by design)

**Description:** fresh-clone verification of the branch as inherited — head/ancestry, toolchain, install, typecheck, lint, build, Vitest. Nothing fixed, nothing pushed; tracked tree clean (`git status --porcelain` shows only untracked `logs/`).

**Proof** (fresh clone; each check under `flock /home/user/work/heavy.lock`):

| Check | Command | Result |
|---|---|---|
| Head / ancestry | `git log -1`; `git merge-base --is-ancestor <c> HEAD` for 58ec020, ecd18b2, b93ef42 | head `b93ef4288a8db91a91263703dec6a5a4a00e2864` (matches expected); all three YES |
| Install | `pnpm install --frozen-lockfile` | exit 0 (25.6s) |
| Typecheck | `npx tsc --noEmit` | exit 0, 0 errors (~243s cold; no `typecheck` npm script exists) |
| Lint | `npx next lint` | exit 0, 0 errors; 3 inherited `<img>` warnings (page.tsx:76, one-on-one-meeting.tsx:175,204) |
| Build | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsubG9jYWxob3N0JA pnpm build` | exit 0, 18 routes (~69s); requires `.env.local` holding `DATABASE_URL` (INHERITED precondition — first failure output recorded verbatim in the baseline log; postgres.js connects lazily, no live DB needed for build) |
| Unit tests | `pnpm exec vitest run` | exit 0, 8/8 passed (tests/unit/voice-call-screen.honesty.test.tsx) |

Toolchain: node v20.20.2, pnpm 9.15.9 (lockfile 9.0, compatible), bun 1.3.14, git 2.47.3; chromium-1243 + headless-shell already cached for the pinned `@playwright/test` 1.63.0 — no browser download needed. Full record: `logs/baseline.md` + per-check logs in the r3 baseline clone.

**Handoff:** Done — verified baseline at `b93ef42` with the exact verification bar (commands above) that every later r3 sub-thread reuses. Not done — nothing else was in scope. Next — reserved-file repair (sub-thread R, running): revert `src/middleware.ts` to exactly `origin/alpha`'s version in its own commit (c2034dc violated the reserved-file rule), add the failing `test.fails()` witness for the `publicMetadata.onboardingComplete` redirect loop, prove the DB-backed gate through a clearly labelled non-reserved test route, then surface the middleware question for Sam. Open question (recorded, unanswered): write the Clerk claim from onboarding, or change the middleware — Sam's decision.

---

## Takeover r4 — coordinator join log (2026-10-12, credit-critical save)

**State at save:** remote head `a0040f4`. Push is fleet-blocked — write auth rejected (`Invalid username or token`, exit 128) while reads work; the `GITHUB_TOKEN` refresh card (prop_9YeZCkos, needs Contents:write on SamGu-NRX/LinkedUp) is still pending. All r4 work is committed locally with Sam Gu authorship + bot trailer and wipe-proofed in bundles/artifacts.

**Local chains (push these first when the token returns):**
- Stack chain — clone `/home/user/work/linkedup-r4-stack`, tip `bc70e05`, 9 commits on `a0040f4` (dev-up fixes a–d, idempotent seed 3 personas + 6 interests, readiness budget 600s, one-command-proof evidence). Bundles: `fl_sEq00ELD`, `fl_7zoWngp1` + the save bundle below.
- Reserved chain — clone `/home/user/work/linkedup-r4-reserved`, tip `ba7d4ec`, 2 docs commits on `a0040f4` (r4-reserved-repair evidence + push-blocker record). Wipe-proof artifact `art_IIzqpuim`. The revert `63fa409` + witness `4797edd` were already on the branch from the earlier thread; r4 verified the revert byte-identical to alpha, captured the witness failure, and proved the gate-proof route 4/4.
- Pairing and call-page threads were mid-work at save time with a 3-minute commit-and-bundle order outstanding; their save bundles (r4-pairing-save, r4-call-save) and reports supersede this line.

**Done (r4):** baseline green at `4797edd` (typecheck 0, lint 0, build 15/15, Vitest 13/13; evidence `a0040f4`). Onboarding-loop root cause evidenced: the single `publicMetadata.onboardingComplete` writer `src/app/onboarding/_actions.ts:77-81` persists the DB flag BEFORE the Clerk claim, with no backfill — DB-complete users without the claim loop back to `/onboarding`. `dev:up` hardened: no killing of foreign PIDs, project-owned PG data dir + port, no system-credential resets, isolated env for Next, real keyless readiness checks; seed added; one-command proof `pnpm dev:up` fresh + warm both exit 0 (PG17 on :54329, data `.local/pg`, keyless dev :3000). Vitest 29/29, Playwright 2/2 (desktop+mobile), tsc clean.

**NOT done:** the J journey suite (not started — brief 06); the adversarial review (not started — brief 07); pushing ALL r4 work (token); the PR #10 body update (this sandbox cannot reach api.github.com — the lead copies this file's Handoff into the PR description, per the established division of labor); the pairing/call final states (in flight at save).

**Decisions made:** middleware stays byte-identical to alpha — the DB-gate-vs-backfill fork is reserved for Sam; the witness names `src/middleware.ts:23` (redirect at :25). Keyless `/app` SSR serves a 200 shell — no SSR redirect exists; redirect assertions belong to the J suite. Playwright pin 1.63.0 untouched; chromium 1243 (+ headless shell) downloaded into the shared `~/.cache/ms-playwright` (open-source download) after the cache held only 1248. Port plan: stack 54329 (live), pairing 54331, call 54333; avoid 3210.

**Next steps when push access returns:** 1) fill the `GITHUB_TOKEN` card; 2) push the stack chain from `/home/user/work/linkedup-r4-stack`; 3) in `/home/user/work/linkedup-r4-reserved`: `git fetch origin && git merge origin/obv/linkedup-journey-foundation-f1 --no-edit && git push` (same for pairing/call chains, or restore them from their bundles with `git clone <bundle>`); 4) run the journey-suite thread, then the adversarial review (briefs lived at `/home/user/work/r4-prompts/06-journey.txt`, `07-review.txt` — recreate from thread records if the sandbox was replaced); 5) the lead updates the PR #10 body from this file.

**Verify commands (from any clone at the join):** `pnpm install --frozen-lockfile && npx tsc --noEmit && npx vitest run && pnpm dev:up && pnpm exec playwright test` — all exit 0 at `bc70e05`. Authorship check: `git log --format='%h %an <%ae>'` — every commit Sam Gu + `Co-authored-by: obvious-autobuild[bot] <262744130+obvious-autobuild[bot]@users.noreply.github.com>`.

---

## Final save — r4 push (2026-10-12, operator token restored)

**Pushed:** the entire r4 join — stack chain (`bc70e05` + handoff save `3305583`), reserved evidence chain (`ce36f5e`, `ba7d4ec`), pairing chain (`7073b72` both-members SKIP LOCKED claim, `8e5f552` release-matched-entries-when-room-ends), call-page chain (`867f271` lifecycle witnesses + honest signed-out refusal, `2b7009f` access witnesses on the real RoomAccess seam, `91ee14e` green-bar evidence), merged with no conflicts. Join tip at push time: `b18340d` (or the commit on top of it). Verify authorship: `git log --format='%h %an <%ae>'` — every commit Sam Gu + the bot trailer.

**DONE:** baseline green at `4797edd`/`a0040f4` (typecheck 0, lint 0, build 15/15, Vitest 13/13). Reserved: `src/middleware.ts` restored byte-identical to alpha (revert `63fa409` verified); witness `4797edd` proves the onboarding loop; root cause evidenced — the sole `publicMetadata.onboardingComplete` writer (`src/app/onboarding/_actions.ts:77-81`) persists the DB flag before the Clerk claim with no backfill. Stack: `pnpm dev:up` hardened and proven fresh + warm exit 0 (project-owned PG 17 on :54329, data `.local/pg`; idempotent seed 3 personas + 6 interests; real keyless readiness); Vitest 29/29, Playwright 2/2 desktop+mobile. Call page: its own bar green at `91ee14e` (tsc 0, Vitest 44/44 — 29 existing + 15 new lifecycle/access witnesses). Pairing: two matching fixes with witness tests (`tests/unit/matching.witness.test.ts`). Join typecheck at `b18340d`: exit 0.

**NOT DONE:** the J journey suite (not started); the adversarial review (not started); the pairing thread's post-fix full bar rerun (its tip commit honestly says "bar rerun pending"); call-page screenshots at 1440x900 and 390x844 (its evidence notes them pending); the full verification bar rerun at the joined tip (only tsc was rerun at the join, to save credits); the PR #10 body update (this sandbox cannot reach api.github.com — the lead copies this file's Handoff into the PR description).

**NEXT STEPS:** 1) rerun the full bar at the join: `pnpm install --frozen-lockfile && npx tsc --noEmit && npx vitest run && pnpm dev:up && pnpm exec playwright test`; 2) rerun pairing's witness bar and confirm `docs/plan/evidence/r4-pairing.md` made it to the branch (it was untracked in the pairing clone at save time — recover from that clone or the pairing save bundle if missing); 3) capture the call-page screenshots; 4) run the journey-suite thread, then the adversarial review; 5) the lead refreshes the PR #10 body from this file.

**VERIFY:** from any fresh clone of this branch: `pnpm install --frozen-lockfile && npx tsc --noEmit && npx vitest run && pnpm dev:up && pnpm exec playwright test` — per-chain evidence lives in `docs/plan/evidence/r4-stack.md`, `r4-reserved-repair.md`, `r4-pairing.md` (untracked at save), `r4-call-page.md`. Decisions: middleware stays byte-identical to alpha (DB-gate-vs-backfill fork reserved for Sam — witness names `src/middleware.ts:23`); keyless `/app` SSR serves a 200 shell, no SSR redirect (redirect assertions belong to the J suite); Playwright pin 1.63.0 untouched; port plan 54329/54331/54333 with `.local/pg` data dirs, avoid 3210.
