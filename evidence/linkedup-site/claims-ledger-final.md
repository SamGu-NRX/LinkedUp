# LinkedUp public landing: final claim and link ledger

Scope: `src/app/page.tsx` (the revised public landing) on branch
`obv/products-l2-linkedup-public-site-20261010`, after the rewrite and the
final validation pass. The branch is based directly on the maintenance head
`08dff14` (`obv/products-linkedup-maintenance-20261009`); draft PR #6 is
retargeted to that branch, so the PR diff contains only the landing work —
the maintenance changes stay in PR #5 and the portfolio entry stays in
PR #3 (this branch no longer carries `.portfolio/project.md`).

Sources of truth, unchanged from `claims-ledger.md`:

- The repo itself: `README.md` ("What this repo actually is"), routes under `src/app/`.
- `.portfolio/project.md` (PR #3, `docs/portfolio-entry`), the resume-backed
  portfolio entry for kgu.one.
- The successor relationship: direction from the project owner, grounded in
  the observable fact that `SamGu-NRX/Connvo` is a public repository owned by
  the same account; Connvo's README itself makes no LinkedUp claim.

Rule applied: a landing claim is allowed only if this repo, the portfolio
entry, or the owner's direction grounds it. Everything the initial audit
flagged as fabricated or misleading was removed or rewritten. The page
discloses, in its own copy, what is real and what is simulated (section
"Where it stands").

## Final claim inventory (revised landing)

| # | Line(s) in `src/app/page.tsx` | Claim as shipped | Verdict | Evidence |
|---|---|---|---|---|
| 1 | 316 | "Maintained in the open · the demo lives in this repo" | Keep | The repo is public on GitHub and contains the demo |
| 2 | 323 | "Professional Networking Without the BS." headline | Keep | README tagline: "Professional connections, without the BS." |
| 3 | 328-331 | "matches two people on what their interests mean, then puts them straight into a one-on-one video call. Built for a hackathon in 2025, kept alive in this repository" | Keep (product intent) | README pitch; call room is disclosed as simulated (#9, #10-11) |
| 4 | 335-336 | "Second place overall, iSTEM@Stevens Hacks 2025 · piloted with more than 40 users" | Keep | `.portfolio/project.md` `award:` field and pilot section |
| 5 | 387-390 | "The picture above is the real simulated meeting room from this repository: mock participants, discussion prompts..., notes, chat, and the meeting-time manager" | Keep | README; `src/app/videocall/[id]/` |
| 6 | 409-415 | "Networking without the feed" section intro (interests → closest-meaning person → skip the message thread) | Keep (product intent) | README pitch; simulation disclosed later |
| 7 | 423 | "Clerk gates every route. Five-step wizard, zod-validated, written to Postgres through Drizzle; onboarding complete only after every write succeeds." | Keep | README; middleware and `/onboarding` in repo |
| 8 | 429 | "Queue runs on mock data in this repository; the original pilot matched interests as embeddings in Postgres with pgvector" | Keep | README ("no ML matching service in this repo — matching and queue pages are UI flows over mock data"); portfolio (pgvector matching in the original build) |
| 9 | 435 | "The room at /videocall/[id] simulates the meeting: prompts, notes, chat, elapsed clock, low-time warnings, extension cooldown, hard 20-minute cap." | Keep | README; `src/app/videocall/[id]/` |
| 10 | 442-462 | "How it works" four steps ("Every step below is something the repository actually implements.") | Keep | Sign-in/onboarding, queue flows, and the simulated room exist in the repo |
| 11 | 488-550 | "Where it stands" ledger: real items (Clerk routes, onboarding persistence, screens, simulated room, dark mode) vs simulated/dormant items (mock matching, no ML service, Stream room removed with SDKs kept, placeholder modes do not work, no deployment claim) | Keep | Each line traces to the README's "what this repo actually is" |
| 12 | 557-564 | Counts: 5 onboarding steps · 1 simulated meeting room · 40+ pilot users · 2nd iSTEM@Stevens Hacks 2025 | Keep | Counts derived from the repo (5 steps, 1 room) and portfolio (40+, 2nd place) |
| 13 | 569-588 | History: five-person team led by Sam Gu, 2nd place, 40+ users, 140% higher match satisfaction; future list (modes beyond one-on-one, better matching, ML moderation) still open and not advertised as done | Keep | `.portfolio/project.md` body; README what-comes-next |
| 14 | 583-588 | "The same team's successor project, Connvo, is in development in its own public repository. LinkedUp is the hackathon build you can run today; nothing here is a sign up for Connvo, and this page makes no claims about Connvo's features or timeline." | Keep (successor note, owner-directed) | SamGu-NRX/Connvo is public and owned by the same account (verified via `gh repo view`); the page names and links it while explicitly claiming nothing about features, timeline, or availability. Connvo's README does not itself describe LinkedUp, so the relationship is stated at the repository-ownership level only |
| 15 | 607-613 | "Open the demo yourself ... every claim on this page traces to it [the GitHub source]" | Keep | Backed by this ledger |
| 16 | 625, 669 | "Read the source" / "Source on GitHub" → github.com/SamGu-NRX/LinkedUp | Keep | Real, public repository |
| 17 | 665-667 | Footer: "Built by a five-person team at iSTEM@Stevens Hacks 2025, maintained in the open." | Keep | Portfolio entry |
| 18 | 676 | Footer joke line | Keep | Explicit joke, no factual claim |

Removed from the PR5 page (see `claims-ledger.md` for the original flags):
the invented retention chart, "50K+ / 92% / 4.8/5 / 120+" stats, the six
"BS Detection / Trust Score / ..." feature cards, all three testimonials, and
"Join thousands of professionals".

## Final link inventory (revised landing)

| # | Line(s) | Link / target | Verdict |
|---|---|---|---|
| 1 | 291 | nav → `/app` | OK, real route |
| 2 | 341 | hero → `/app` | OK, real route |
| 3 | 616 | CTA → `/app` | OK, real route |
| 4 | 395 | nav scroll → `#what-it-is` | OK, target exists |
| 5 | 442 | nav scroll → `#how-it-works` | OK, target exists (was broken in PR5) |
| 6 | 488 | nav scroll → `#where-it-stands` | OK, target exists |
| 7 | 625 | CTA → `REPO_URL` (GitHub, LinkedUp) | OK, public repo |
| 8 | 669 | footer → `REPO_URL` (GitHub, LinkedUp) | OK, public repo |
| 9 | 585 | history → `CONNVO_URL` (GitHub, Connvo) | OK, public repo; external link opens in a new tab |

Removed: nav items `#testimonials` and `#pricing` (fabricated sections gone).

## Final counts

- Claims inventoried: 18 — 16 keep with named evidence, 1 keep as an explicit
  joke, 1 owner-directed successor note that names its own limits. Zero
  fabricated, zero misleading, zero puffery claims remain.
- Configured link actions: 9 (3 × `/app`, 3 × scroll targets, 2 × LinkedUp
  GitHub, 1 × Connvo GitHub).
- Broken scroll targets: 0.
- Misleading targets: 0.

## Runtime fixes made during validation (page-owned, verified)

1. Keyboard focus was invisible everywhere: `src/app/globals.css` sets an
   always-on `outline: 2px solid rgba(var(--ring), 0.5)`, but `--ring` holds
   space-separated HSL parts, so `rgba()` is invalid and computes to `none`.
   Fixed in the page (not the shared stylesheet) with explicit
   `focus-visible:outline-2` rings on every interactive control.
2. Contrast: white-on-emerald-600 measured 3.65:1 and white-on-Tailwind-v4
   emerald-700 (`#1d8969`) measured 4.34:1. Primary CTAs and step badges now
   use emerald-800 (hover emerald-900); the hero trust line moved from
   gray-500 (3.85:1) to gray-700.
3. The footer GitHub link is always underlined (was color-only, which fails
   axe `link-in-text-block`).
4. Reduced motion: the page is wrapped in `MotionConfig reducedMotion="user"`
   and `scrollToSection` uses `behavior: "auto"` under
   `prefers-reduced-motion: reduce`.
5. In-view animations play once (`viewport={{ once: true }}`): fast anchor
   jumps no longer replay entrances, and full-page captures show settled
   content.
6. The `<img>` warning for `landerimage.png` is pre-existing (same element in
   PR5) and accepted; tsc and eslint report no errors.

## Verification state at this head

- `pnpm exec tsc --noEmit` — pass.
- `ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint src/app/page.tsx` — 0 errors,
  1 pre-existing warning.
- `pnpm build` (placeholder Clerk keys, clean `.next`) — pass, 16/16 static pages.
- `pnpm exec playwright test --config=evidence/linkedup-site/playwright.config.ts`
  against the production server on `:3210` — 16 passed, 0 failed
  (screenshots, keyboard, reduced motion, axe ×2 viewports ×2 states, links,
  repeated-load layout shift). Re-run after the Connvo note landed; see the
  committed `results/report.json` for the latest run.
