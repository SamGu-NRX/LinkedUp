# Handoff — LinkedUp public landing rewrite

Branch `obv/products-l2-linkedup-public-site-20261010` → `main` as draft PR
SamGu-NRX/LinkedUp#6. Authored by Sam Gu
<127461594+SamGu-NRX@users.noreply.github.com> on every commit. **Not merged,
not deployed.** Base: PR5 head `08dff143`.

## What is complete

1. **Claim/link audit** (`evidence/linkedup-site/claims-ledger.md`): the PR5
   landing had 20 inventoried claims — 16 fabricated, misleading, or puffery
   (invented retention chart, 50K+/92%/4.8/5/120+ stats, BS-Detection /
   Trust-Score cards, three testimonials, "join thousands") — plus a broken
   `#how-it-works` anchor and misleading pricing/testimonials nav items.
2. **Landing rewrite** (`52d06ec`, `src/app/page.tsx`): every remaining claim
   traces to the README or `.portfolio/project.md`. The page now carries an
   honest where-it-stands ledger (real / simulated / dormant), the real
   hackathon history, and links only to real routes and the public GitHub
   repo. Final counts: 17 claims, 0 fabricated, 8 link actions, 0 broken
   (`evidence/linkedup-site/claims-ledger-final.md`).
3. **Runtime fixes found by the checks**: visible `focus-visible` keyboard
   rings on every control (the shared `globals.css` outline rule computes to
   `none` because `--ring` is HSL parts inside `rgba()` — left untouched,
   fixed in the page), WCAG contrast on primary CTAs (emerald-800), always
   underlined footer source link, reduced-motion support
   (`MotionConfig reducedMotion="user"` + instant scroll fallback), and
   play-once in-view animations.
4. **Final evidence** (`5f15705`): Playwright suite against the production
   build on :3210 — **16 passed, 0 failed** across desktop-1440x900 and
   mobile-390x844: screenshots (recaptured, committed), keyboard operation,
   reduced-motion stability, axe serious/critical on load and full scroll
   (zero violations), link check, repeated-load layout shift (zero).
   `tsc --noEmit` pass; eslint 0 errors (1 pre-existing `<img>` warning);
   `pnpm build` pass, 16/16 pages.

## What remains

- Review and approval of the draft PR (the deliverable; nothing is merged).
- Optional follow-ups, not started: fixing the invalid `rgba(var(--ring))`
  rule in the shared `globals.css` (the page works around it), swapping the
  `<img>` for `next/image`, and landing-copy iterations after review feedback.

## How to resume

```
cd /home/user/work/LinkedUp
git checkout obv/products-l2-linkedup-public-site-20261010
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucGxhY2Vob2xkZXIubG9jYWwk \
CLERK_SECRET_KEY=sk_test_dummyplaceholderforlocalruns PORT=3210 pnpm start
pnpm exec playwright test --config=evidence/linkedup-site/playwright.config.ts
```

The Clerk key is a synthetic local-run placeholder (`clerk.placeholder.local$`
base64) — no real Clerk tenant was touched. For real auth you need the
project's own keys. Re-run `pnpm build` first if `.next` is missing (it is
gitignored); do not run `next dev` and `next build` on the same `.next`
simultaneously — the mixed turbopack output breaks `next start`.

## Guardrails honored

No merge, no deploy, no default-branch push, no workflow or settings edits,
no paid-service or live-model steps. Local evidence only.
