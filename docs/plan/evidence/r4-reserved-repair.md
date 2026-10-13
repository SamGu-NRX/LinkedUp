# r4 reserved-file repair — evidence record

Task: linkedup-journey-foundation-f1 (reserved-file-repair sub-thread of the r4
coordinator). Branch `obv/linkedup-journey-foundation-f1`, draft PR #10 into
`alpha`. This file is the evidence deliverable for the three-commit objective:

1. **Commit 1** — revert the reserved-file violation: `src/middleware.ts`
   restored to exactly alpha's version (violation introduced by `c2034dc`).
2. **Commit 2** — the failing witness for the onboarding redirect loop.
3. **Commit 3** — the labelled proof path (finished user proceeds through the
   DB-backed gate), plus the facts record of what the app writes today.

The r3 reserved-file-repair sub-thread (a child of one of the dead writer
threads) already pushed the three commits the objective describes. This thread
verified each one, captured the witness failure with its real output, and
recorded the source facts. Nothing was re-implemented, and the reserved file
was not touched: **the repair commits and the evidence commit are all Sam Gu
authored with the required co-author trailer.**

## Inherited state, verified before any work

Clone: `https://github.com/SamGu-NRX/LinkedUp.git` → `/home/user/work/linkedup-r4-reserved`
(fresh clone from GitHub, per protocol; identity configured before any commit:

```console
$ git config user.name 'Sam Gu'
$ git config user.email '127461594+SamGu-NRX@users.noreply.github.com'
```

Branch checkout at `a0040f4` (the r4 baseline evidence commit). Prior history
on the branch (Sam Gu authored, co-author trailer present):

| SHA | Subject | What it is |
|---|---|---|
| `63fa409` | revert only `src/middleware.ts` | commit 1 (the revert) |
| `4797edd` | add onboarding-loop witness + labelled gate-proof route/test | commit 2+3 combined |
| `a0040f4` | docs(plan): r4 baseline — E2E deferred | baseline evidence |

Verification of the inherited repair:

```console
$ git diff origin/alpha HEAD -- src/middleware.ts
(exit 0, empty output — byte-identical to alpha)

$ git show --stat 63fa409 | tail -4
 src/middleware.ts | 54 ++++++-----------------------------------------
 1 file changed, 4 insertions(+), 50 deletions(-)
```

The revert touches only `src/middleware.ts` — nothing else from `c2034dc` was
reverted: the DB-backed gate (`src/app/onboarding-gate.tsx`,
`src/app/onboarding/template.tsx`, the onboarding layout) is present at HEAD.
The witness and proof files:

```console
$ ls src/app/gate-proof/page.tsx tests/unit/gate-proof.route.test.tsx \
      tests/unit/middleware.onboarding-loop.witness.test.ts
src/app/gate-proof/page.tsx
tests/unit/gate-proof.route.test.tsx
tests/unit/middleware.onboarding-loop.witness.test.ts
```

## Sandbox-replacement incident log

Twice during this thread the shared sandbox was replaced under us
(`2026-10-12 ~04:00Z` and `~05:10Z`, observed via sandbox id changes and a
`.restore-done` marker). Each replacement destroyed all session-local state,
including this thread's clone, `node_modules`, and unpushed work:

- First replacement: destroyed the clone holding the local evidence commit
  `dee4618` (the first version of this file, committed but not pushed) and the
  queued verification runs. Everything was rebuilt from GitHub + conversation
  record; the evidence file was rewritten from scratch.
- Second replacement: destroyed the rebuilt clone mid-verification (the
  detached gate chain's log was lost after it had completed successfully:
  install 0 / tsc 0 / vitest 0 — 13 tests / raw witness exit 1 / proof 4-of-4).

Rebuilt again and re-verified everything in a single fast session. All outputs
below are from the **third** clone's runs (2026-10-12 05:15–05:20Z), produced
after the last rebuild. The lesson applied: verify fast, commit, and push
early — do not hold a docs-only commit hostage to a long shared-lock queue.

## Gates (current tree, `a0040f4` + this file's commit)

| Check | Result | Duration |
|---|---|---|
| `pnpm install --frozen-lockfile --prefer-offline` | exit 0 | 27s |
| `npx tsc --noEmit` | exit 0 | 46s |
| `pnpm exec vitest run` (full suite) | exit 0, 13 tests / 3 files | 6.2s |
| raw witness run (un-`.fails`-ed copy) | exit 1 (expected failure) | ~2s |
| `pnpm exec vitest run tests/unit/gate-proof.route.test.tsx` | exit 0, 4/4 | 1.9s |

Full-suite output (verbatim tail):

```
 ✓ tests/unit/voice-call-screen.honesty.test.tsx (8 tests) 261ms
 ✓ tests/unit/middleware.onboarding-loop.witness.test.ts (1 test) 13ms
 ✓ tests/unit/gate-proof.route.test.tsx (4 tests) 53ms

 Test Files  3 passed (3)
      Tests  13 passed (13)
   Start at  05:18:21
   Duration  6.17s (transform 466ms, setup 0ms, collect 2.44s, tests 327ms, environment 1.97s, prepare 635ms)
```

## Commit 2 — the witness and the failure it captures

The witness test
(`tests/unit/middleware.onboarding-loop.witness.test.ts`, one `it.fails` case)
names the exact reserved file and lines in its title:

```
× onboarding redirect loop witness (src/middleware.ts:23) >
  KNOWN-FAILING WITNESS: a DB-onboarding-complete user is still bounced to
  /onboarding by the claim read at src/middleware.ts:23 (redirect at :25) —
  flips when Sam fixes the middleware
```

- `src/middleware.ts:23` is the claim read (`publicMetadata.onboardingComplete`).
- `src/middleware.ts:25` is the redirect back to `/onboarding`.

The suite passes with the `it.fails` wrapper (the failure is declared and
currently exists — vitest exit 0). To capture the underlying failure honestly,
the witness body was run as a temporary plain test (`.fails(` → `(`, scratch
copy `tests/unit/_scratch-witness-raw.test.ts`, deleted after capture):

```console
$ sed 's/it\.fails(/it(/' tests/unit/middleware.onboarding-loop.witness.test.ts \
    > tests/unit/_scratch-witness-raw.test.ts
$ pnpm exec vitest run tests/unit/_scratch-witness-raw.test.ts; echo "exit:$?"
```

Verbatim failure output:

```
 × onboarding redirect loop witness (src/middleware.ts:23) > KNOWN-FAILING WITNESS:
   a DB-onboarding-complete user is still bounced to /onboarding by the claim read at
   src/middleware.ts:23 (redirect at :25) — flips when Sam fixes the middleware 30ms
     → expected 'http://localhost:3000/onboarding' not to contain '/onboarding'
 FAIL  tests/unit/_scratch-witness-raw.test.ts > onboarding redirect loop witness
   (src/middleware.ts:23) > KNOWN-FAILING WITNESS: …
 AssertionError: expected 'http://localhost:3000/onboarding' not to contain '/onboarding'
       Tests  1 failed (1)
```

`RAW_WITNESS_VITEST_EXIT:1` — the failure is real and reproduced: the real
middleware handler, invoked with only `auth()` mocked, redirects the
DB-onboarding-complete user to `/onboarding`. After the scratch file was
removed, `git status --porcelain` was empty (no uncommitted changes).

## Commit 3 — the proof path (labelled, outside reserved files)

`tests/unit/gate-proof.route.test.tsx` (4 tests) exercises the DB-backed
gate through `src/app/gate-proof/page.tsx` — a clearly labelled test route
(rendered banner: “test-only gate proof route”), not a `/demo` route and not
any reserved file. These component tests prove that the DB-backed gate
renders the app shell for `dbUser.onboardingComplete === true`. They do not
exercise middleware or establish a finished-user browser journey: without
the Clerk completion claim, middleware can still redirect `/gate-proof`
and `/app` to `/onboarding`, whose layout redirects back to `/app`.

```console
$ pnpm exec vitest run tests/unit/gate-proof.route.test.tsx

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  1.93s
```

Browser-check screenshots (1440x900 / 390x844) were not produced: no dev
server was started for this evidence pass; the route test runs in a DOM
environment against the real gate component. The witness + route tests
together cover the gate component and reproduce the conflicting middleware
decision. The browser journey remains blocked on Sam's session-token decision.

## Facts (recorded, no fix attempted)

**1. Does the app write `publicMetadata.onboardingComplete` anywhere?**

```console
$ grep -rn "publicMetadata" src/ --include="*.ts" --include="*.tsx"
src/app/onboarding/_actions.ts:78:      publicMetadata: {
src/middleware.ts:21:  // Catch users who do not have `onboardingComplete: true` in their publicMetadata
```

Exactly one writer: `src/app/onboarding/_actions.ts:77-81`. The middle reference
is only a comment in the reserved middleware. (The original task brief’s
premise — “the app never writes it” — is therefore not accurate as of HEAD;
the actual defect is narrower, see below.)

**2. What the server actions currently write, and in what order**

`src/app/onboarding/_actions.ts` `completeOnboarding` performs, in order:
1. validate + zod-parse the form data;
2. upsert the onboarding profile rows;
3. persist `users.onboardingComplete = true` to the database
   (`_actions.ts:71`, inside the `update` at `:39-51` / insert path above it);
4. **then** persist the Clerk claim (`_actions.ts:77-81`):

```ts
// 4. Persist success flag in Clerk metadata (after DB writes).
await client.users.updateUser(userId, {
  publicMetadata: {
    onboardingComplete: true,
  },
});
```

5. clear existing interests and link the newly picked ones.

Because the DB flag is written strictly before the Clerk claim, any failure or
non-execution of the Clerk write (network, keyless-instance claim window,
action abort after step 3) leaves a user whose DB says complete but whose
token still lacks the claim. The middleware reads only the token claim, so
that user is bounced to `/onboarding` forever — the loop the witness names.
There is no backfill path: no code re-syncs the claim for DB-complete users.

**3. Does the keyless Clerk setup even allow writing that claim?**

Yes — the runtime has a secret key available. Evidence from the installed
`@clerk/nextjs@6.12.5` sources (grep of `node_modules/.pnpm/
@clerk+nextjs@6.12.5*/node_modules/@clerk/nextjs/dist/esm/server/`):

- `keyless-node.js:29` — the keyless configuration path is
  `.clerk/<tmp>/keyless.json`; `keyless-node.js:98` warns the directory
  “includes the secret key of the unclaimed instance”.
- `clerkMiddleware.js:40,44` — the middleware resolves credentials as
  `publishableKey || PUBLISHABLE_KEY || keyless?.publishableKey` and
  `secretKey || SECRET_KEY || keyless?.secretKey`, i.e. the middleware runs
  with a secret key when the app is keyless.
- `next.config.mjs` contains no Clerk key references; the app does not set
  explicit keys, so the keyless path is the live one in this dev setup.

`users.updateUser` with `publicMetadata` is a backend call requiring the
secret key — available per the above — so the write the action attempts is
permitted. Two honest caveats, unverified locally: the action was not run
against a live keyless instance (no live instance in this sandbox), and the
session-token `metadata` propagation from `updateUser` to the middleware’s
`auth()` was not traceable from installed package source alone (it is
documented Clerk behavior, not a locally derived fact).

## Author audit (before push)

```console
$ git log --format='%h %an <%ae> %s' origin/alpha..HEAD
(16 commits — every one `Sam Gu <127461594+SamGu-NRX@users.noreply.github.com>`; sorted
count: 16 × Sam Gu, 0 exceptions)
```

Every commit in this thread (including this evidence commit) is authored by
Sam Gu with:

```
Co-authored-by: obvious-autobuild[bot] <262744130+obvious-autobuild[bot]@users.noreply.github.com>
```

## Push protocol application

Before push: `git fetch origin` — remote tip `a0040f4` = local `HEAD~1` (the
remote had not moved; the evidence commit is a clean fast-forward, no merge
needed). Gates were green on this exact tree (see table above).

**Push attempt: FAILED — credential blocker, commit preserved locally.**
Two attempts, both with the token in a short-lived inline credential helper
(`username=x-access-token`, then `username=obvious-autobuild[bot]`), both
rejected:

```text
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/SamGu-NRX/LinkedUp.git/'
```

Diagnosis: the same token **reads** fine — `git -c credential.helper=… ls-remote
origin refs/heads/alpha` exits 0 and returns the ref — so the credential is
valid for authentication but is rejected on the write path (push permission
missing or the token is not the push credential for this repo; consistent with
the known fleet-wide `GITHUB_TOKEN` push rejection seen today by the UNTangle
and Connvo threads). Per the workspace rule no other credential or workaround
was attempted. No token value was echoed, logged, or stored; the remote URL in
`.git/config` carries no credential.

**Local state awaiting the credential fix:** `ce36f5e` (this evidence file) on
top of remote tip `a0040f4` — a plain `git push origin
obv/linkedup-journey-foundation-f1` with a working push credential completes
the task; then re-verify `git ls-remote` matches `ce36f5e`.

## Full command list (chronological, with exit codes)

```text
# clone + identity
git clone https://github.com/SamGu-NRX/LinkedUp.git /home/user/work/linkedup-r4-reserved   # exit 0
git config user.name 'Sam Gu'                                                             # exit 0
git config user.email '127461594+SamGu-NRX@users.noreply.github.com'                      # exit 0
git fetch origin alpha                                                                    # exit 0
git checkout obv/linkedup-journey-foundation-f1                                           # exit 0
git diff origin/alpha HEAD -- src/middleware.ts                                           # exit 0, empty
# environment (after each sandbox replacement)
corepack enable --install-directory ~/.local/bin                                          # exit 0
corepack prepare pnpm@10.34.5 --activate                                                  # exit 0
pnpm install --frozen-lockfile --prefer-offline                                           # exit 0 (27s)
# gates
npx tsc --noEmit                                                                          # exit 0 (46s)
pnpm exec vitest run                                                                      # exit 0, 13/13 (6.2s)
sed 's/it\.fails(/it(/' tests/unit/middleware.onboarding-loop.witness.test.ts \
  > tests/unit/_scratch-witness-raw.test.ts                                               # exit 0
pnpm exec vitest run tests/unit/_scratch-witness-raw.test.ts                              # exit 1 (expected)
rm tests/unit/_scratch-witness-raw.test.ts                                                # exit 0
pnpm exec vitest run tests/unit/gate-proof.route.test.tsx                                 # exit 0, 4/4
# facts
grep -rn "publicMetadata" src/ --include="*.ts" --include="*.tsx"                         # exit 0, 2 hits
git log --format='%h %an <%ae>' origin/alpha..HEAD | sort | uniq -c | sort -rn            # 16 × Sam Gu
# push (BLOCKED — see Push protocol application)
git -c credential.helper='!f() { echo username=x-access-token; echo password=$SECRET_GITHUB_TOKEN; }; f' \
  push origin obv/linkedup-journey-foundation-f1                      # exit 128, Invalid username or token
git -c credential.helper='…' ls-remote origin refs/heads/alpha         # exit 0 (read path works)
git -c credential.helper='… push (username=obvious-autobuild[bot])     # exit 128, same error
```

*(Host note: shared sandbox; heavy steps run serially under
`flock /home/user/work/heavy.lock`. Earlier long waits were lock contention
plus two sandbox replacements, not command failures — see the incident log.)*
