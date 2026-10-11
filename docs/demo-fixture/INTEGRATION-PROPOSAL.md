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
