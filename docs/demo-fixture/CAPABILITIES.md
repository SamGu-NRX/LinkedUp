# CAPABILITIES.md — every demo capability label mapped to its backing code

Rule of this document: **no claim without backing code.** Every user-visible
capability of the sample demo (`/demo`) is listed with the source files that
implement it. Shared production files appear as **import-only (unmodified)** —
the demo tree never edits them; see INTEGRATION-PROPOSAL.md for the two
integration gaps found.

Owned trees (this task):

- `src/app/demo/**`
- `src/components/demo/**`
- `src/lib/demo/**`

Shared production files reused by the demo, unmodified:

- `src/components/video-meeting/time-manager.ts` (public API only)
- `src/components/video-meeting/time-display.tsx` (render-only)
- `src/components/ui/**` (shadcn primitives), `src/utils/motion`, `src/utils/cn`

---

## 1. Sample mode labelling (persistent, every screen)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| "Sample mode" badge and banner: *"Sample demo — everything here is simulated. No real account, camera, microphone, or network call is used."* | Persistent header on every stage, both shell branches | `src/components/demo/demo-banner.tsx` (`role="note"`); copy from `src/lib/demo/sample-mode.ts` (`SAMPLE_MODE_BADGE`, `SAMPLE_MODE_BANNER`) |
| Per-stage page title suffix *"LinkedUp — Sample demo (simulated data)"* | `document.title` on every stage | `src/lib/demo/sample-mode.ts` (`SAMPLE_MODE_PAGE_TITLE`, `sampleStageTitle`); applied in `src/components/demo/demo-shell.tsx` title effect |
| Screen-reader stage announcements ("Sample demo screen: …") | `role="status"` live region, every stage | `src/lib/demo/sample-mode.ts` (`sampleStageAnnouncement`); rendered in `src/components/demo/demo-shell.tsx` (`data-testid="demo-live-region"`) |
| `noindex` + sample-mode metadata | Demo route only | `src/app/demo/layout.tsx` |

## 2. Profile choice (stage 1)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| Sample profile cards with fictional identities | Profile-choice stage | `src/lib/demo/sample-personas.ts` (`SAMPLE_PROFILES` — "Priya Sampleton" et al.); card in `src/components/demo/sample-profile-card.tsx` |
| "Sample profile option" selection | Profile-choice stage | Reducer event `profile-selected` in `src/lib/demo/demo-state.ts`; rendered in `src/components/demo/demo-stage-views.tsx` |
| Sample interest chips and pairing preview | Profile-choice stage | `src/lib/demo/demo-views.ts` (`toUserCardView`, `sharedInterestNames`) |
| Continue ("Continue to the simulated queue") | Profile-choice stage | Reducer transition `profile-confirmed`; stage view in `demo-stage-views.tsx` |

## 3. Connection explanation (stage 2)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| "Simulated match — sample persona" explanation screen | Connection-explanation stage | Stage view in `src/components/demo/demo-stage-views.tsx`; persona pairing via `samplePersonaForProfile` in `sample-personas.ts` |
| Explanation that the queue/wait is simulated and why a match appears | Same stage | Copy constants in `src/lib/demo/sample-mode.ts`; static text in `demo-stage-views.tsx` |
| "Why am I seeing this?" disclosure | Same stage | Collapsible (shadcn) in `demo-stage-views.tsx` |

## 4. Simulated queue (stage 3)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| Simulated wait, labelled as simulated | Queue stage | Reducer `queue-tick` driven by shell interval; constants in `src/lib/demo/demo-state.ts` (`SAMPLE_MATCH_AFTER_SECONDS = 8`) |
| Natural match at 8 s ("Your sample peer is ready") | Queue stage | Reducer transition `queue-tick` → `connection-explained` in `demo-state.ts` |
| Skip the wait ("Skip the simulated wait") | Queue stage | Reducer event `queue-skipped` in `demo-state.ts` |
| Queue expiry at 30 s with recovery ("queue expired" failure path) | Queue stage | `SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS = 30`, reducer expiry transition; copy in `FAILURE_COPY` (`demo-state.ts`) |
| Back navigation from queue | Queue stage | Reducer `navigate-back` with per-stage back stack in `demo-state.ts` |

## 5. Sample-connection explanation before joining (stage 4)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| "Sample connection" explanation and preview card | Connection-explained stage | Stage view in `demo-stage-views.tsx`; persona tile preview via `src/components/demo/sample-tile.tsx` |
| "Open the simulated meeting" join affordance | Same stage | Reducer event `meeting-opened` in `demo-state.ts` |
| Inert media check ("Run the simulated device check") | Same stage | `src/lib/demo/sample-media.ts` (`resolveSampleMediaCheck`) — generated visuals only, never `getUserMedia` |

## 6. Simulated meeting / in-call (stage 6)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| Meeting room labelled "Simulated preview — sample persona, not a real person" | In-call stage | `src/components/demo/demo-top-bar.tsx`; constants in `sample-mode.ts` |
| Scripted meeting clock (5:00 allowance) driven by the product TimeManager | In-call stage | `src/components/video-meeting/time-manager.ts` — public API `calculateRemaining`, `canRequestTime`, `formatTime` (import-only, unmodified); display via `time-display.tsx`; reducer `call-tick` in `demo-state.ts` (`SAMPLE_STARTING_ALLOWANCE_SECONDS = 300`) |
| Sample persona tiles ("scripted visual, not a live feed") | In-call stage | `src/components/demo/sample-tile.tsx` — generated gradient visuals, no camera capture; connection states from `demo-views.ts` (`SAMPLE_CONNECTION_STATES`) |
| Scripted speaking pattern (sample audio indicator) | In-call stage | `src/lib/demo/sample-media.ts` (`sampleAudioLevel`, `sampleSpeakingPattern`) |
| Toggle "Show time left" | In-call stage | `DemoTopBar` in `demo-top-bar.tsx` + `TimeDisplay` (shared, import-only) |
| Sample time request ("Sample time request pending" → simulated peer approval) | In-call stage | `TimeManager.canRequestTime` gate + reducer events `call-time-request-sent` / `call-time-request-resolved` in `demo-state.ts` |
| Local sample chat script, revealing every 25 s, never sent anywhere | In-call stage | `SAMPLE_CHAT_SCRIPT`, `SAMPLE_CHAT_REVEAL_EVERY_SECONDS` in `src/lib/demo/sample-mode.ts`; chat panel in `demo-stage-views.tsx` |
| "Leave the simulated meeting" | In-call stage | Reducer event `call-left` → `ended` stage in `demo-state.ts` |

## 7. Failure and recovery paths (four, plus expiry recovery)

All failure copy is defined in `FAILURE_COPY` (`src/lib/demo/demo-state.ts`);
rehearsal UI is `src/components/demo/rehearse-controls.tsx` (a labelled
`Rehearse a failure path (sample only)` disclosure in the top bar). Every
failure screen offers a recovery action and back navigation that never
dead-ends.

| Failure path | Copy (readable, sample-labelled) | Recovery action | Backing source |
| --- | --- | --- | --- |
| Media unavailable | "Simulated device check failed — no sample camera" etc. | "Retry the sample device check" | Reducer `media-check-failed` / `media-recovery` in `demo-state.ts`; view in `demo-stage-views.tsx` |
| Sample permission refused | "Sample permission refused — the sample persona cannot grant camera access" | Retry path with readable guidance | Reducer `device-permission-refused` in `demo-state.ts` |
| Queue expired | "The simulated queue expired" | "Return to the sample queue" | Reducer `queue-expired` + recovery in `demo-state.ts` |
| Meeting ended | "You left the simulated meeting" / allowance exhausted | "Restart the sample demo" | Reducer `call-left` + allowance-exhaustion transition in `demo-state.ts` |
| Rehearsal of any path | "Rehearse a failure path (sample only)" disclosure | Injects the failure event via `rehearse` | `src/components/demo/rehearse-controls.tsx`; `DemoShell.rehearse` in `demo-shell.tsx` |

## 8. Ended / restart (stage 9)

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| "You left the simulated meeting" summary | Ended stage | Stage view in `demo-stage-views.tsx` |
| "Restart the sample demo" | Ended stage | Reducer `demo-restarted` → fresh `initialDemoFlowState()` in `demo-state.ts` |

## 9. Navigation and exit

| Capability label | Where shown | Backing source |
| --- | --- | --- |
| "Go back one step in the sample demo" (never dead-ends) | Every non-initial stage | Reducer `navigate-back` + back-stack discipline in `demo-state.ts`; button in `demo-shell.tsx` |
| "Exit the sample demo and return to the LinkedUp home page" | Every stage | Link to `/` in `demo-shell.tsx` |

## 10. Identity boundary (what the demo does NOT do)

| Guarantee | Backing source |
| --- | --- |
| Sample identity is structurally distinct from production identity | `src/lib/demo/sample-identity.ts` — branded `SamplePersonaId` / `SampleProfileId` types; production `UserInfo` has no branded sample id; type-level rejection pinned by `@ts-expect-error` assertions in `src/lib/demo/demo-boundaries.test.ts` |
| Demo tree never imports `@clerk/*` or `@stream-io/*` | Boundary scanner test in `src/lib/demo/demo-boundaries.test.ts` (scans owned trees for forbidden imports/calls); positive control pins the allowed shared imports (`time-manager`, `time-display`) |
| Demo tree never calls production auth actions | Production verifier lives in `src/app/onboarding/_actions.ts` (Clerk `auth()`-coupled); the demo tree contains no import of it (scanner test) |
| No real camera, microphone, or network at runtime | `sample-media.ts` generates visuals; Playwright network evidence (`docs/demo-fixture/evidence/network-log.txt`, see NO-REMOTE-EFFECT.md) recorded zero external requests across a whole run |

## Evidence cross-references

- Zero-external-network proof and exact commands: `docs/demo-fixture/NO-REMOTE-EFFECT.md`
- Accessibility scan results (axe, both viewports): `docs/demo-fixture/evidence/axe-results.jsonl`
- Screenshots (desktop 1440x900, mobile 390x844): `docs/demo-fixture/screenshots/{desktop,mobile}/`
- Harness and specs: `docs/demo-fixture/playwright/`
