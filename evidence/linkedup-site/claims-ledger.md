# LinkedUp public landing: claim and link ledger

Scope: `src/app/page.tsx` (the public landing) at the PR5 head,
`08dff143d6b684bf4316e85fdabacdd7377d8c74`
(branch `obv/products-linkedup-maintenance-20261009`, PR #5).
Sources of truth used for the audit:

- The repo itself: `README.md` ("What this repo actually is"), routes under `src/app/`.
- `.portfolio/project.md` (open PR #3, `docs/portfolio-entry`), the resume-backed
  portfolio entry for kgu.one.

Rule applied: a landing claim is allowed only if this repo, the portfolio entry,
or a public source backs it. Claims derived from code alone that assert real
users, real deployments, real AI systems, real Clerk/video-call operations, or
historical achievements are flagged.

## Initial claim inventory (PR5 head)

| # | Line(s) in `src/app/page.tsx` | Claim as shipped | Verdict | Evidence status |
|---|---|---|---|---|
| 1 | 45-52 | Retention chart data, 85%→95% Jan-Jun | Fabricated | No source anywhere in repo or portfolio |
| 2 | 382 | "Professional networking reimagined" | Puffery | No source |
| 3 | 385-391 | "Professional Networking Without the BS." headline | Keep | Matches README tagline "Professional connections, without the BS." |
| 4 | 393-395 | "Where professionals come to actually connect..." | Puffery | No source |
| 5 | 465-466 | "50K+ BS-Free Conversations" | Fabricated | No source; contradicts 40+ user pilot (portfolio) |
| 6 | 471-472 | "92% Less Cringe Than LinkedIn" | Fabricated | No source |
| 7 | 477-478 | "4.8/5 User Satisfaction" | Fabricated | No source |
| 8 | 483-484 | "120+ Countries Represented" | Fabricated | No source |
| 9 | 515-518 | "5-Minute Calls" | Misleading | Demo timer has a hard 20-minute cap (README); no 5-minute call length |
| 10 | 521-524 | "Smart Matching" | Misleading | README: "no ML matching service in this repo — matching and queue pages are UI flows over mock data" |
| 11 | 527-530 | "BS Detection" AI flags buzzwords | Fabricated | No such system in repo |
| 12 | 533-536 | "Real Talk Only" | Puffery | Implies moderation behavior not in repo |
| 13 | 539-542 | "Trust Score" | Fabricated | Not in repo |
| 14 | 545-548 | "Actual Growth" tracking | Fabricated | Not in repo |
| 15 | 558-600 | Testimonials: Sarah K., Alex T., Mike R. with 5-star ratings | Fabricated | Invented people; no source |
| 16 | 575 | "No paid testimonials. Just honest feedback." | Fabricated framing | The testimonials themselves are invented |
| 17 | 617-676 | "Industry-Leading Retention" + chart | Fabricated | Invented data (#1); "People who join LinkedUp actually keep using it" unsupported |
| 18 | 683-685 | "Join thousands of professionals building meaningful connections" | Fabricated | Contradicts portfolio: pilot with 40+ users |
| 19 | 693 | "Start Your Journey" | Puffery | No source |
| 20 | 726-729 | Footer joke line | Keep | Explicit joke, no factual claim |

Historical/achievement claims the landing may make, with their backing:

- "Second place overall at iSTEM@Stevens Hacks 2025" — `.portfolio/project.md`
  `award:` field and body (resume-backed, PR #3).
- "Built by a five-person team" / "piloted with more than 40 users" —
  `.portfolio/project.md` body.
- "140% higher match satisfaction in the pilot" — `.portfolio/project.md`
  `## The pilot` section.

Claims the landing must NOT make (task constraint: nothing invented from code):

- No claim that real video calls work. README: the Stream-backed room was
  removed; `/videocall/[id]` is a simulated demo with mock participants.
- No claim that real Clerk operations are demonstrated end to end on the
  landing; Clerk sign-in/up routes exist in-repo but the landing does not
  exercise them.
- No deployment claim. The repo does not establish a live deployment; the
  portfolio's historical site link stays in the portfolio file only.
- No claim of a future/successor product. The landing presents LinkedUp as the
  maintained predecessor: the maintained repo with a working simulated demo.
  Nothing in this repo or Connvo's README grounds a specific successor
  relationship, so none is advertised.

## Initial link inventory (PR5 head)

| # | Line(s) | Link / target | Verdict |
|---|---|---|---|
| 1 | 324 | nav scroll → `#features` | OK, target exists (line 492) |
| 2 | 330 | nav scroll → `#testimonials` | Target exists (line 558) but section content is fabricated |
| 3 | 336 | nav scroll → `#pricing` | Misleading: target exists (line 670) but is a CTA section; no pricing exists in the product |
| 4 | 411 | hero scroll → `#how-it-works` | Broken: no element with id `how-it-works` on the page |
| 5 | 357 | nav → `/app` | OK, real route (Clerk-gated demo app) |
| 6 | 401 | hero → `/app` | OK, real route |
| 7 | 687 | CTA → `/app` | OK, real route |
| 8 | 705-713 | footer logos | Not links |

## Initial counts

- Claims inventoried: 20 (3 keep / 1 misleading-as-stated carried in a keep-able
  feature, 16 flagged fabricated/misleading/puffery).
- Configured internal link actions: 7 (3 × `/app`, 4 × scroll targets).
- Broken scroll targets: 1 (`how-it-works`).
- Misleading targets: 2 (`pricing` as a nav item, `testimonials` as social proof).

## Final counts (after the landing revision)

Recorded in `evidence/linkedup-site/claims-ledger-final.md` with the same
method, updated after `tsc`, `build`, and `eslint` pass.
