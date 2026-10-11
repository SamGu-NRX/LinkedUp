# LinkedUp sample-product demo (fixture demo) — PR #8 review summary

**Pull request:** https://github.com/SamGu-NRX/LinkedUp/pull/8 — draft, open
**Branch:** `obv/products-l4-linkedup-fixture-demo-20261010` @ `a0f9efe`
**Base:** `obv/products-linkedup-maintenance-20261009` (itself draft PR #5 → main)
**Root task:** Explicit sample-product mode for demo

## What was built

Sample-product (fixture demo) mode for the LinkedUp predecessor: a visitor can inspect the demo without Clerk, Stream, or a database setup, and nothing can be mistaken for a real match.

- **Sample adapter** (`src/lib/demo/`): typed adapter over synthetic data for profile, queue, and meeting/call state; four failure/recovery paths (media unavailable, sample permission refused, queue expired, meeting ended) with readable error copy, recovery actions, and back navigation that never dead-ends.
- **Demo flow** (`src/app/demo`, `src/components/demo/`): profile choice → sample-connection explanation → queue → join → call state → ended, built from real components and transitions. Persistent sample-mode banner/badge and `document.title` on every screen; copy labels the wait as simulated, the participant as a sample persona, and the connection as a simulated preview.
- **Identity boundary:** production verified-session code never accepts the sample identity; the demo tree imports no `@clerk/*` or `@stream-io/*` (`demo-boundaries.test.ts`, `demo-identity.type-test.ts`). TimeManager is driven import-only through its public API; that file and `time-display.tsx` are untouched.
- **Evidence** (`docs/demo-fixture/`): Playwright config + specs, screenshots (desktop 1440×900, mobile 390×844, keyboard walk, reduced motion), `CAPABILITIES.md` (capability → source map), `NO-REMOTE-EFFECT.md`, `INTEGRATION-PROPOSAL.md`, committed `axe-results.jsonl` + `network-log.txt`.

## Milestones (pushed; every commit authored Sam Gu with the obvious-autobuild co-author trailer)

| Commit | Content |
|---|---|
| `2bae397` | M1 — sample adapter, boundary tests, labelled demo shell |
| `6f7536c` | M2 — demo flow component suite, labelled in-call top bar |
| `02e4ada` | M3 — browser evidence, axe scans, zero-remote proof |
| `117bc89` | regular merge of the moved maintenance base (`d3b9951`, `3be70b2`) |
| `a0f9efe` | browser evidence refresh on the merged tree |

## Verification record

Independently verified on origin 2026-10-11 (git refs, GitHub API, committed evidence files):

- 5 commits, all authored `Sam Gu <127461594+SamGu-NRX@users.noreply.github.com>` with the `obvious-autobuild[bot]` co-author trailer; no rebase, amend, or force-push — the base move was reconciled as a regular merge commit.
- Scope audit: base..head touches only `src/app/demo`, `src/components/demo`, `src/lib/demo`, `docs/demo-fixture`, plus additive `package.json`/`pnpm-lock.yaml`. No middleware, layout, landing, auth, onboarding, provider, action, or db files changed.
- Committed axe evidence: 18 scans; the only impact level present anywhere in the file is **moderate** (zero serious, zero critical — grep-verified over the committed JSONL). Findings are shared-root-layout landmark issues, proposed (not applied) in `INTEGRATION-PROPOSAL.md`.
- Committed network log: all requests to loopback; final line `External (non-local) requests: 0`.

Reported by the implementer and quoted in the PR body (totals string verified present; suites not re-run independently): Vitest 71/71 (demo lib 44, onboarding failure paths 9, TimeManager 13, middleware 5), component suite 12/12, `tsc --noEmit` clean, lint clean, build clean (`/demo` prerendered 16.4 kB), Playwright 9/9 (desktop + mobile journeys, keyboard-only, reduced motion, zero-outbound check) — all on the merged tree at `a0f9efe`.

## Decisions the reviewer owns

1. **`/demo` reachability:** middleware auth-gates `/demo` for anonymous visitors. The proposed one-line public-matcher change is in `INTEGRATION-PROPOSAL.md` §2 (the middleware file is outside this task's ownership). Until applied, `/demo` needs a signed-in session to reach; the browser harness documents its interception step.
2. **Shared-root-layout a11y:** the moderate landmark findings originate in the shared root layout; the fix is proposed in §1/§3, not applied.
3. **Base moved mid-task:** the maintenance writer pushed `d3b9951`/`3be70b2` after the cut at `08dff14`; reconciled by merge `117bc89`. The branch never touched the base's files — apparent deletions in two-dot diffs before the merge were diff artifacts.
4. **devDependency additions** (Playwright, testing-library, axe-core, jsdom): additive only; flagged in the PR as a conflict surface vs sibling draft PR #6 (active landing rewrite, disjoint file surface).

## Acceptance criteria — status

- Labelled sample mode, synthetic identities, inert media — met
- No Clerk/Stream/DB setup to inspect the demo — met at the application layer; visitor reachability awaits the §2 middleware decision
- Verified-session rejects sample identity; no forbidden provider imports — met (tests)
- Real functioning flow through sample adapters — met
- 2–4 pushed milestones with task-specific tests/measurements/replayable evidence — met (3 milestones + merge + evidence refresh)
- Zero serious/critical axe findings at both viewports; keyboard + reduced motion first-class — met (evidence committed)
- No remote effects — met (network log: 0 external)
- Sam Gu authorship + trailer on every commit; no history rewrite — verified on origin
- Draft PR with current Handoff, correct base — verified
- Sibling writer's surface untouched — verified (scope audit)

## Remaining (per the PR Handoff)

- Optional follow-up PR: move the demo harness to Playwright's `webServer` config once the route is public (drops the document interception).
- Apply-or-defer decisions on the two `INTEGRATION-PROPOSAL.md` items above.

*PR stays open as a draft per project policy — it is never merged by automation.*
