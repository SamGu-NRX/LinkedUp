# Handoff — LinkedUp public landing rewrite

Branch `obv/products-l2-linkedup-public-site-20261010` →
`obv/products-linkedup-maintenance-20261009` as draft PR
SamGu-NRX/LinkedUp#6 (retargeted from `main`, so the PR diff carries only the
landing work: maintenance changes stay in PR #5 and the portfolio entry stays
in PR #3 — this branch no longer carries `.portfolio/project.md`). Authored by
Sam Gu <127461594+SamGu-NRX@users.noreply.github.com> on every commit, with
`Co-authored-by: obvious-autobuild[bot]` on every commit created after the
retarget. **Not merged, not deployed.** Base: maintenance head `08dff14`.

Commit history on this branch (rebased onto the maintenance head):

- `c01ed4a` — file:line claim and link ledger for the PR5 landing (amended to
  drop the portfolio file and add the bot co-author trailer)
- `dac97c7` — Playwright evidence rig and PR5 baseline captures
- `74dfba1` — landing rewrite grounded in the README and portfolio
- `8efa718` — final landing validation and recaptured captures
- `f661788` — retarget follow-up: honest Connvo successor note, updated
  ledger and captures, handoff

## What is complete

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

## What remains

- Review and approval of the draft PR (the deliverable; nothing is merged).
  Merge order matters: PR #5 (maintenance) and PR #3 (portfolio) are its
  siblings on `main`; this PR now stacks on the maintenance branch.
- Optional follow-ups, not started: fixing the invalid `rgba(var(--ring))`
  rule in the shared `globals.css` (the page works around it), swapping the
  `<img>` for `next/image`, and landing-copy iterations after review feedback.

## How to resume

```
cd /home/user/work/LinkedUp
git checkout obv/products-l2-linkedup-public-site-20261010
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
