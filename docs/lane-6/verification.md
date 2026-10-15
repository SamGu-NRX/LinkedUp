# Lane 6 promotion evidence

For the lead reviewing PR #20. All database checks used the lane-owned `linkedup_ship` database on the shared local server. Production was untouched.

## Reproduce the checks

From this worktree, configure the shared server and assigned app port:

```sh
export LINKEDUP_DATABASE_NAME=linkedup_ship
export LINKEDUP_PG_DATA_DIR='/Users/samgu/Programming Projects/fleet-leads/wt/linkedup-turn/.local/pg'
export LINKEDUP_DEV_PORT=3206
pnpm test:unit --silent
pnpm exec tsc --noEmit --pretty false
pnpm lint
```

- Unit tests: 291 passed across 33 files. Migration tests contribute eight cases covering empty and main-shaped schemas, repeated migration, resumption after the original 0005, schema mismatch rejection, and duplicate rows for the same healthy room.
- Typecheck: passed.
- Lint: passed with three existing `no-img-element` warnings in the landing page and one-on-one page. Changed files have no warnings.

Run the browser cases against the local keyless instance:

```sh
LINKEDUP_JOURNEY_PROOF=1 ~/.long-run/bin/heavy pnpm dev:up
LINKEDUP_JOURNEY_PROOF=1 J_SEEDS=3 J_CASES=J1,J2,J3 ~/.long-run/bin/heavy pnpm exec playwright test tests/e2e/journeys.spec.ts --project=desktop --max-failures=1
LINKEDUP_JOURNEY_PROOF=1 J_SEEDS=3 J_CASES=J4,J5,J6 ~/.long-run/bin/heavy pnpm exec playwright test tests/e2e/journeys.spec.ts --project=desktop --max-failures=1
LINKEDUP_JOURNEY_PROOF=1 J_SEEDS=3 J_CASES=J7,J8 ~/.long-run/bin/heavy pnpm exec playwright test tests/e2e/journeys.spec.ts --project=desktop --max-failures=1
```

J1–J8 passed all three seeds, 24 case/seed combinations, across focused runs. The missing-claim recovery test also passed. The initial broad run passed onboarding and J1–J3 before an aborted completion request in the helper stopped J4. After the helper waited for recovery, J4–J6 passed. The final J7/J8 run passed 7/7 including onboarding. These are combined coverage results, not one uninterrupted 25-test run.

Production build is pending.

The browser signs up synthetic users through Clerk and completes the actual onboarding wizard. Normal `/onboarding` verifies stable missing-claim recovery, an offline refresh error, and retry. Matching and calls then use the existing, development-only journey-proof routes because this unclaimed Clerk instance lacks session-token customization. J8 reads saved ratings directly from Postgres after an offline failure and retry, and completes both participants through keyboard controls. App documents and APIs are not intercepted.

The screenshots in `screenshots/` show missing-claim recovery, refresh failure, refresh pending, selected rating, save failure, and save pending. Each state has 1440×900 and 390×844 captures with reduced motion enabled and disabled. Screenshot-only CSS hides Clerk and Next development overlays, which otherwise cover the phone's status text. Product content and requests are unchanged. No new motion was added.

## Coverage limits

- Claim-present refresh and navigation are covered by unit tests. Normal-route browser acceptance with the customized claim requires Sam's configured Clerk instance.
- The migration fixture comes from main source, not a production dump. Production lock duration and data volume are unmeasured. Follow [the rollout steps](rollout.md) before promotion.
- Remote-media readiness uses deterministic transport tests. Cross-network connectivity still depends on lane 2's ICE work.
- Keyboard behavior and accessible names were checked. A human screen-reader pass was not run.
- A mobile Lighthouse run on the development sign-in page scored 49 performance and 100 accessibility. It does not measure production or call performance.
