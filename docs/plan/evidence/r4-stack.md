# r4 stack: one-command `pnpm dev:up` — fixes, seed, and end-to-end proof

Task: linkedup-journey-foundation-f1 (sub-thread 3 of r4). Branch
`obv/linkedup-journey-foundation-f1`, base head `a0040f4`. Work clone:
`/home/user/work/linkedup-r4-stack`; proof clone (fresh `git clone` of the
branch tip, independent directory): `/home/user/work/linkedup-r4-stack-proof`.

## Stack decisions (for every other thread)

| Decision | Value |
| --- | --- |
| Project Postgres | **PostgreSQL 17 on 127.0.0.1:54329** (localhost-only bind) |
| Project data dir | `.local/pg` inside the checkout (git-ignored via `/.local/`) |
| App database | `postgresql://postgres:postgres@127.0.0.1:54329/linkedup` |
| App port | 3000 (override `LINKEDUP_DEV_PORT`) |
| Env file | `dev:up` writes `.env.local` with only the local `DATABASE_URL` |
| Postgres binaries | discovered on PATH (system postgresql-17 server binaries present in the sandbox) |
| Playwright | pin unchanged; pinned driver's chromium + chromium-headless-shell **1243** installed into the shared `~/.cache/ms-playwright` (the sandbox only had 1248); no other revisions downloaded |

Ports 5432 (system cluster, down) and 3210 (another stack) are avoided by
design. Threads pairing, call-page, and journey work should reuse **54329 /
`.local/pg` / port 3000** so the identity checks in `dev:up` recognize your
stack.

## Commits (all authored by Sam Gu, bot co-author trailer, verified with
`git log --format='%h %an <%ae>'`)

| Commit | Defect / item | What changed |
| --- | --- | --- |
| `329afda` | (a) port-3000 killer | dev-server identity: only stop processes this script started, verified by `/proc` pid **and** cmdline **and** cwd; otherwise pick a free port or refuse |
| `26ac8df` | (b) superuser password reset | project-owned Postgres: `initdb` into `.local/pg`, distinctive port 54329, never touches any existing cluster or credential |
| `d343747` | (c) env bleed | Next runs with an isolated, verified local config; zero Clerk/Stream vars; the running server's `/proc` environ is asserted to match the migrations' database |
| `cf77b39` | (d) HTTP-200 keyless "proof" | behavioral proof: landing-page title, keyless `/sign-in` with Clerk failure markers checked, `/proc` env of the live server, and the app's own data layer reporting the project database (`scripts/verify-db-identity.mjs`) |
| `4951cfe` | missing seed | `scripts/seed.ts`: idempotent (`on conflict do nothing`), synthetic dev personas only, entry `pnpm db:seed`; `dev:up` runs it whenever present (drizzle-kit 0.30.5 has no seed command) |
| `008ab15` | readiness budget | 240s proved insufficient under a load-~40 spike (initdb 48s + landing compile >240s); raised to 600s with the measurement recorded; a timed-out wait leaves the started server intact for reuse |
| `8fba383` | (d) correction | keyless SSR cannot enforce a server-side auth redirect — `/app` serves the shell with 200; the check now asserts the served app shell + absence of Clerk error pages instead of an assumed redirect |
| *(this commit)* | evidence | this file |

Witness tests live under `tests/dev-up/` (Vitest, `.mjs`): process-identity,
postgres isolation, env isolation, and behavioral-proof helpers are exercised
without spawning real servers or databases. Vitest config keeps esbuild
`jsx: 'automatic'` (verified — the `.tsx` tests compile and pass).

## The one-command proof

Command: `pnpm dev:up` from the fresh proof clone. Final verified line:

```
[dev:up] verified: LinkedUp on :3000 · keyless Clerk sign-in · /app shell clean
         · server env isolated · data layer on
         postgresql://postgres:postgres@127.0.0.1:54329/linkedup (.local/pg)
[dev:up] done. app: http://localhost:3000 · db: postgresql://...54329/linkedup
```

Every stage does what it claims, observed in the logs:

1. `.env.local DATABASE_URL set to the local database` (or `already points
   ... — kept`).
2. Project-owned Postgres 17: `initialized project Postgres cluster in
   .../.local/pg` → `project PostgreSQL ready on 127.0.0.1:54329` (system
   cluster 17/main on 5432 untouched; its `postgres` superuser password was
   never read or written).
3. `applying Drizzle migrations (drizzle-kit migrate)` → `migrations applied
   successfully!`.
4. `seeding via scripts/seed.ts (idempotent)` → first run inserted 3 synthetic
   personas + 6 interests; rerun printed `[seed] users: already seeded — kept
   (3 dev personas present) · interests: already seeded — kept`.
5. Keyless `next dev` on :3000 with an isolated env (no Clerk/Stream vars).
6. Behavioral checks all green (title, keyless sign-in, app shell clean,
   `/proc` env of the live server matches, app data layer confirms the
   project database).

### Runs observed (all in the proof clone unless noted)

| Run | Box load | What happened | Exit |
| --- | --- | --- | --- |
| 1 | ~40 (foreign matrix run) | full cold DB path OK (initdb 48.1s, migrations, seed 3+6); readiness wait timed out at the then-240s budget while `/` compiled (503.8s under load) | 1 |
| 2 | ~20 | reuse of kept Postgres + healthy server; **caught the `/app` redirect assumption** (assertion was wrong, see below) | 1 |
| 3 | 3.6 | warm reuse; all five behavioral proofs pass | **0** |
| 4 | 3.5 | cold rerun over a damaged cluster (data dir deleted under a dying daemon): refused with the exact `psql` FATAL instead of guessing or "repairing" | 1 |
| 5 | 3.1 | cold DB path fully green (initdb 1.6s, migrations, seed) but refused to start the server: port 3000 held by an orphaned `next-server` from run 1 — `dev:up never kills processes it did not start` | 1 |
| 6 | 3.1 | fresh DB kept, fresh server started (pid 94910), all proofs green | **0** |

Timings (quiet box): cold DB+seed ≈ 7s (`devup5` 6.9s); fresh server compile +
proofs ≈ 44s (`devup6` 44.3s); warm reuse ≈ 1–2s. Proof-clone dependency
install: 5m 23.5s (pnpm, cold store).

### Incidents, honestly recorded

- **Load spike**: a foreign self-proof matrix run saturated the 2-core box
  (load ~40) during runs 1–2. It slowed initdb 8× and the landing-page compile
  to 8.4 minutes and killed processes mid-run (OOM). No r4 process or data was
  harmed; the readiness budget now covers it and `dev:up` reuses whatever
  survived its own identity checks.
- **Orphaned `next-server` (pid 77085)**: left on :3000 by the run-1 kill
  (its parent `pnpm exec next dev` died under the spike; the renamed server
  child survived). `dev:up` **refused** to touch it ("never kills processes it
  did not start"), naming the pid. I verified it manually — cwd
  `/home/user/work/linkedup-r4-stack-proof`, start 06:09:45 UTC (inside my run
  window) — and killed it **as an operator action, not a script behavior**.
  The refusal is correct and stays: same-checkout cwd alone cannot
  distinguish our orphan from a developer's own `pnpm dev`.
- **Corrected `/app` assertion**: my first (d) implementation asserted an
  unauthenticated redirect. The runtime refuted it — keyless `clerkMiddleware`
  serves the protected shell with 200. Commit `8fba383` replaced the
  assumption with what the stack can prove (app shell + no Clerk error
  markers). Enforcing redirect semantics is the journey suite's job.

## Smoke tests (proof clone)

| Suite | Command | Result |
| --- | --- | --- |
| Vitest | `pnpm exec vitest run` | `Test Files 4 passed (4)`, `Tests 29 passed (29)`, exit **0**, 9.0s |
| Playwright desktop + mobile | `pnpm exec playwright test tests/e2e/smoke.spec.ts --project=desktop --project=mobile` | `2 passed (19.2s)` — landing + sign-in render through keyless Clerk, exit **0**, 21.1s (webServer hook re-ran `pnpm dev:up` → reuse path) |

Playwright browsers: pinned driver's chromium + chromium-headless-shell **1243**
installed (`pnpm exec playwright install chromium chromium-headless-shell`)
because the shared cache held only 1248 after the sandbox replacement. Pin
untouched; no other revisions downloaded.

## Local-mode checkpoint (push backlog)

The shared GitHub token's push right is fleet-rejected ('Invalid username or
token'). Each push point: one attempt, no retries, then bundle. Bundles are
recorded here after creation (see the trailing list, appended by commit).

<!-- BUNDLES -->

- `r4-stack-checkpoint-1` — artifact **fl_sEq00ELD** (28,738 bytes), bundle of
  `origin/obv/linkedup-journey-foundation-f1..87803f7`: all seven work commits
  (a, b, c, d, seed, readiness budget, /app correction) plus this evidence
  file. Restore with
  `git bundle verify r4-stack-checkpoint-1.bundle && git fetch r4-stack-checkpoint-1.bundle 'refs/heads/*:refs/remotes/bundle/*'`.

## Honest limitations

- `/app` unauthenticated **redirect** semantics are not proven here (keyless
  SSR serves the shell with 200); the journey suite owns sign-in flow
  enforcement.
- Keyed-Clerk behavior is out of scope for this stack step.
- The seed inserts synthetic personas only; case-specific seed design belongs
  to the journey-suite thread.
