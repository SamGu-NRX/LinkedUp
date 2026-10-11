# Integration proposal: shared components vs. demo-local equivalents

The sample demo (`/demo`) reuses production code wherever the reuse is honest
and provider-free. Where a shared production component cannot serve the demo
without a rewrite of a file this task does not own, the demo builds a local
equivalent and records the gap here instead of touching the shared file.

## 1. `TopBar` — unnamed icon-only controls

**Shared component:** `src/components/video-meeting/top-bar.tsx`
(import-only from the demo at M1; replaced by the demo-local equivalent below)

**Why the demo could not keep using it as-is:**

- Its two controls — the sidebar toggle and the settings button — are
  icon-only `<Button variant="ghost" size="icon">` elements with **no
  accessible name**. axe-core flags both as `button-name` violations
  (impact: critical) on the simulated-meeting screen.
- The component's props expose no way to supply labels from the call site.
- In the demo those controls are also functionally dead (the sample room has
  no sidebar and no settings), and dead affordances contradict the demo's
  honesty contract.

**Demo-local equivalent:** `src/components/demo/demo-top-bar.tsx` — keeps the
shared `TimeDisplay` (import-only, unmodified) and the visual language, drops
the dead controls, and labels everything it renders ("Sample meeting with …",
"Simulated preview — sample persona, not a real person").

**Proposed production change (smallest fix):**

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={onToggleSidebar}
  aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
  className="h-8 w-8 rounded-full hover:bg-zinc-800/50"
>
```

and the same one-line `aria-label` on the settings button
(`aria-label="Open settings"`). Optionally promote the labels to props
(`sidebarToggleLabel`, `settingsLabel`) if call sites need context-specific
copy.

**Migration path:** once the shared `TopBar` carries accessible names, the
demo can delete `demo-top-bar.tsx`, import the shared `TopBar` again, and pass
the sample partner plus the demo's time handlers. The boundary scanner test
(`demo-boundaries.test.ts`) pins the demo's allowed shared imports — the
`video-meeting/time-display` entry in its positive control covers either
shape.

**Priority note for the production owner:** the unnamed buttons affect the
real room too (screen-reader users get two unlabelled controls in every
meeting), so the fix is worthwhile independently of the demo.


## 2. Route reachability — `/demo` is auth-gated for anonymous visitors

**Shared file:** `src/middleware.ts` (outside this task's ownership; unmodified)

**How the demo is reached today (verified against the production server):**
`src/middleware.ts` line 7 defines the public routes:

```ts
const isPublicRoute = createRouteMatcher(["/", "/sign-in", "/sign-up"]);
```

`/demo` is not in that list, so an anonymous visitor who navigates to `/demo`
is redirected (`307`) to sign-in by the Clerk middleware. The demo page itself
needs no Clerk provider and renders provider-free once mounted — but only a
signed-in user (or the evidence harness, which intercepts the single `/demo`
document request with the real prerendered HTML while all assets are served by
the production server — see NO-REMOTE-EFFECT.md) can reach it in a browser
today. This is why a visitor "inspecting the demo without setting up Clerk"
still requires either an account or the harness interception.

**Proposed production change (one line):** add `/demo` to the public matcher so
the sample-product mode is visitor-reachable without an account:

```ts
const isPublicRoute = createRouteMatcher(["/", "/sign-in", "/sign-up", "/demo"]);
```

**Why this is safe to propose and safe to defer:** `/demo` is `noindex`, its
tree never imports `@clerk/*` (pinned by the boundary scanner test), and the
middleware's sign-in/up redirects for real private routes are untouched. The
change is deliberately NOT made here — middleware is shared production
surface, and the sibling landing PR (#6) also touches route-adjacent copy.
The owner should apply the one-liner when landing the demo publicly, or keep
the demo staff-only by leaving it gated.

**Migration path:** none beyond the one line; the demo route has no other
integration point (no env vars, no database, no provider).

## 3. Shared root-layout landmark findings (informational, no change proposed)

The axe scans (see `evidence/axe-results.jsonl`) report three recurring
**moderate** findings on every demo screen — `landmark-main-is-top-level`,
`landmark-no-duplicate-main`, and `landmark-unique`. Their cause is the shared
root layout (`src/app/layout.tsx`) wrapping `{children}` in its own `<main>`,
which nests with the demo shell's `<main>` (the two are in mutually exclusive
shell branches; the banner is a `div role="note"`, not a landmark). This
affects every route rendered by the root layout, not just the demo. Fixing it
means removing the wrapper `<main>` from the root layout and adding a
route-level `<main>` per page — a cross-cutting change outside this task's
ownership, recorded here rather than made.
