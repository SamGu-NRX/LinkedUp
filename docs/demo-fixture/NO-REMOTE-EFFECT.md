# NO-REMOTE-EFFECT.md — the sample demo makes zero outbound network requests

Claim: during a complete sample-demo run (profile choice → connection
explanation → queue → join → in-call → leave → restart), the demo makes
**zero outbound (non-local) network requests**. Every request the browser
makes is a `GET` against the local production server on `127.0.0.1`. There is
no camera capture, no microphone capture, no Clerk/Stream/Supabase runtime
call, and no telemetry from the demo tree.

This document records the exact harness, commands, and the unedited summary of
the recorded request log so the result can be reproduced.

## How the harness reaches the demo without auth (and without effects)

`src/middleware.ts` gates `/demo` behind sign-in for anonymous visitors (see
INTEGRATION-PROPOSAL.md §2 — a one-line public-matcher change is proposed for
the owner). The evidence harness therefore:

1. Starts the **real production build** (`pnpm build`, then
   `./node_modules/.bin/next start -p 4310`) — assets are served by the
   production server on `127.0.0.1:4310`.
2. Intercepts **only the single `/demo` document request** and fulfils it with
   the **real prerendered HTML** from `.next/server/app/demo.html` (no edited
   or synthetic page). Every subsequent request (chunks, CSS, fonts, the RSC
   prefetch) goes to the real server over the loopback.
3. Drives the whole journey with real clicks/keys against that production
   server, while a `page.on("request")` listener records every request.

No request interception beyond the one document fulfilment; no route mocks;
no network stubs. If the demo tree tried to call Clerk, Stream, Supabase, or
any remote host, the log would show a non-local request and the
`zero remote effect` test would fail.

## Exact commands (run 6, the committed evidence)

```bash
# 1. Production build of the real app (includes the demo route)
pnpm build

# 2. Serve the production build on loopback
tmux new-session -d -s svc-4310 \
  "cd /home/user/work/linkedup-fixture-demo-20261010 && exec ./node_modules/.bin/next start -p 4310"

# 3. Full evidence suite (9 tests): journeys + axe scans + screenshots +
#    keyboard-only + reduced-motion + zero-outbound-request check
pnpm exec playwright test --config=docs/demo-fixture/playwright/playwright.config.ts
```

Harness sources (owned by this task):

- `docs/demo-fixture/playwright/playwright.config.ts` — projects
  `desktop` (1440x900) and `mobile` (390x844); single worker for
  deterministic timing.
- `docs/demo-fixture/playwright/tests/flow.spec.ts` — full journey per
  viewport with axe scans and screenshots; meeting clock; scripted chat.
- `docs/demo-fixture/playwright/tests/keyboard-motion.spec.ts` — keyboard-only
  navigation (Tab/Enter only) and `prefers-reduced-motion: reduce` journey.
- `docs/demo-fixture/playwright/tests/network.spec.ts` — the zero-outbound
  check that writes the log below.
- `docs/demo-fixture/playwright/helpers/` — document interception, axe
  runner (`@axe-core/playwright`), request logger, keyboard helper.

## Recorded result (unedited log summary)

The run recorded **27 requests**. Every one targets the loopback server
`127.0.0.1:4310`; **0 are external**. The full list is committed at
`evidence/network-log.txt`; its summary block:

```text
Requests recorded during a whole sample-demo run (27 total, all hosts):
GET document   http://127.0.0.1:4310/demo
GET font       http://127.0.0.1:4310/_next/static/media/5dfb1d0134f1564c-s.p.otf
GET font       http://127.0.0.1:4310/_next/static/media/5e2deae4b23fe9dc-s.p.woff2
GET font       http://127.0.0.1:4310/_next/static/media/b9cdf579b141d3d6-s.p.woff2
GET font       http://127.0.0.1:4310/_next/static/media/e4af272ccee01ff0-s.p.woff2
GET stylesheet http://127.0.0.1:4310/_next/static/css/eebc7413e3000652.css
GET stylesheet http://127.0.0.1:4310/_next/static/css/21e50076623580b6.css
GET script     http://127.0.0.1:4310/_next/static/chunks/webpack-122a916895e21383.js
GET script     http://127.0.0.1:4310/_next/static/chunks/137c818c-106a66a265f7afcc.js
GET script     http://127.0.0.1:4310/_next/static/chunks/384-6d13d05147dd583f.js
GET script     http://127.0.0.1:4310/_next/static/chunks/main-app-3c9d77614997a700.js
GET script     http://127.0.0.1:4310/_next/static/chunks/8341-a87ea9ddf3550cf6.js
GET script     http://127.0.0.1:4310/_next/static/chunks/8236-bef0fd09228e231c.js
GET script     http://127.0.0.1:4310/_next/static/chunks/9336-63265079e84d02cb.js
GET script     http://127.0.0.1:4310/_next/static/chunks/8819-8a583b57a64b744e.js
GET script     http://127.0.0.1:4310/_next/static/chunks/app/layout-92288da5db24ea4e.js
GET script     http://127.0.0.1:4310/_next/static/chunks/4387-98b624c3c27f36fc.js
GET script     http://127.0.0.1:4310/_next/static/chunks/8654-2cb92a57653d1234.js
GET script     http://127.0.0.1:4310/_next/static/chunks/1412-4093514fd931f577.js
GET script     http://127.0.0.1:4310/_next/static/chunks/7027-20d9b72a18e3f09d.js
GET script     http://127.0.0.1:4310/_next/static/chunks/8796-a34093c6e0c3d90c.js
GET script     http://127.0.0.1:4310/_next/static/chunks/7454-6e5ec8ff20b83128.js
GET script     http://127.0.0.1:4310/_next/static/chunks/app/demo/page-928235876e1490d9.js
GET fetch      http://127.0.0.1:4310/?_rsc=1vhu0
GET script     http://127.0.0.1:4310/_next/static/chunks/3753-20e9055c22dec392.js
GET script     http://127.0.0.1:4310/_next/static/chunks/9906-d3b39da8cb4f1b23.js
GET script     http://127.0.0.1:4310/_next/static/chunks/app/page-f99af509f20a037a.js

External (non-local) requests: 0
```

Request-type breakdown: 1 document, 4 fonts, 2 stylesheets, 19 scripts,
1 `fetch` — the last is Next.js's own RSC prefetch of the local home page
(`/?_rsc=…`) triggered by the demo's "Exit the sample demo" `next/link`; it
targets the same loopback server.

## What this does and does not prove

Proven by this run:

- The demo tree makes no external request during the whole journey — no
  Clerk bootstrap, no Stream token/connector, no Supabase call, no telemetry
  beacon, no remote favicon (the demo layout overrides the root layout's
  favicon with an inline data URL).
- The simulated media path never touches `navigator.mediaDevices` — the
  persona tiles are generated visuals and the audio meter is scripted
  (`src/lib/demo/sample-media.ts`), and the journey exercises them.
- The four failure/recovery paths, back navigation, and restart complete
  offline in both viewports, keyboard-only, and under reduced motion.

Not exercised here (deferred with reasons):

- A **signed-in production user** visiting `/demo` through the Clerk
  middleware: exercising that path requires a real Clerk account (no live
  Clerk instance is authorized for this task). The harness interception used
  here is recorded as such rather than dressed up as an anonymous visit.
- The exact browser versions used are the Playwright-bundled Chromium for
  this commit; the log was generated on the task sandbox (Linux) — no other
  host was checked.

## Boundaries that hold the guarantee

- The boundary scanner test (`src/lib/demo/demo-boundaries.test.ts`) asserts
  the demo tree imports neither `@clerk/*` nor `@stream-io/*` and never
  references `getUserMedia`/`mediaDevices` or production auth actions — with
  positive controls proving the scanner itself works.
- The demo layout (`src/app/demo/layout.tsx`) overrides the root favicon with
  an inline data URL, removing the only remote-first request the root layout
  would otherwise cause on this route.
