# LinkedUp landing evidence

Evidence for the public-landing revision (branch
`obv/products-l2-linkedup-public-site-20261010`, based on the PR5 head).

Layout:

- `playwright.config.ts` — two projects: `desktop-1440x900`, `mobile-390x844`.
- `tests/baseline.spec.ts` — full-page screenshots; `EVIDENCE_SHOT_DIR=final`
  writes to `final/`, otherwise `baseline/`.
- `tests/landing-checks.spec.ts` — keyboard reachability and operation,
  `prefers-reduced-motion: reduce` statics, axe (wcag2a/2aa/21a/21aa, assert
  no serious/critical), configured-link resolution, and a guard that the
  fabricated claim inventory stays off the page.
- `tests/layout-shift.spec.ts` — 5 repeated loads per project, raw
  PerformanceObserver `layout-shift` entries, assert zero observed shifts.
- `baseline/`, `final/` — committed full-page screenshots.
- `findings/` — raw JSON results from the final run.
- `claims-ledger.md` — file:line claim/link audit of the PR5 head.
- `claims-ledger-final.md` — same audit for the revised page.

Run:

```
pnpm install
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_bGlua2VkLXVwLmV4YW1wbGUuY29tJA \
CLERK_SECRET_KEY=sk_live_placeholderDoNotUse pnpm build
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_bGlua2VkLXVwLmV4YW1wbGUuY29tJA \
CLERK_SECRET_KEY=sk_live_placeholderDoNotUse pnpm start -- -p 3210
pnpm exec playwright test --config evidence/linkedup-site/playwright.config.ts
```

The Clerk keys are syntactically valid placeholders for local build/runtime
only; they are not a real Clerk tenant and never leave this repo.
