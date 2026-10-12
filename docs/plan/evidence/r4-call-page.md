# r4 call-page sub-thread — evidence log

Task: linkedup-journey-foundation-f1 (call-page lane). Branch `obv/linkedup-journey-foundation-f1`.
Clone: `/home/user/work/linkedup-r4-call` (fresh from GitHub, then sibling's 9 local commits merged from `/home/user/work/linkedup-r4-stack`; tip `bc70e05` before this thread's work — authors verified Sam Gu).

## Runtime takeover (recorded)

- Verified leftover server: `ps -p 94960 -o args=` → `next-server (v15.2.2)` (the finished stack thread's dev server, :3000). Authorized to replace.
- `kill 94960` → `pid 94960 stopped cleanly`, `port 3000 free`.
- Stack boot: `LINKEDUP_PG_PORT=54333 pnpm dev:up` under `flock /home/user/work/heavy.lock` — **exit 0, 2m33.8s**.
  - dev:up verified: `LinkedUp on :3000 · keyless Clerk sign-in · /app shell clean · server env isolated · data layer on postgresql://postgres:postgres@127.0.0.1:54333/linkedup (/home/user/work/linkedup-r4-call/.local/pg)`.
- Ports used by this thread: dev server **:3000**, Postgres **:54333** (data dir `.local/pg` inside this clone). The sibling's PG on 54329 untouched. My server pid at boot: **114241** (`next-server (v15.2.2)`).

## Environment

- `pnpm install --frozen-lockfile` under lock — **exit 0, 1m55.5s wall (1m16.6s pnpm)**.
- Pinned Playwright browsers present in `~/.cache/ms-playwright` (chromium 1243 + headless shell) — verified by cache listing, no install needed.

## Incident: orphaned lock holder

The first baseline attempt (`npx tsc --noEmit; npx vitest run` chained, one call) hit the 300s tool deadline; the tool killed the shell but the `flock` child survived orphaned (pid 115624, PPID 1, no children, 11 min) holding `heavy.lock` — starving my tmux tsc and other threads' queued commands. Killed pid 115624 (verified mine: exact command string, PPID 1, childless). Lesson recorded: chain heavy steps under tmux with logs, never rely on the tool deadline to clean up.

## Baseline attribution

- Sibling stack-thread evidence (same commit lineage, `bc70e05`): `npx tsc --noEmit` exit 0 (243s cold), Vitest **29/29** exit 0, Playwright **2/2** (desktop+mobile) exit 0.
- This clone's own tsc run: queued behind cross-thread lock contention (Connvo property runs, pairing migrate, UNTangle fe-gate) — the queued detached run (`/tmp/tsc-baseline.log`, tmux `tsc-base`) executes against the post-fix tree and is recorded below when it completes.

## Fixes applied (this thread)

1. `src/components/call/VoiceCallScreen.tsx`
   - **Uncancelled capture await (witness defect):** `startCapture` now takes an `isCancelled` probe; the mount effect passes its cleanup flag. If the screen leaves (Back, unmount, route change) while the browser permission prompt is open, the late stream is stopped (`stopAllTracks(media)`) instead of attaching behind the component's back. Existing cleanup (stop + null the stream ref) unchanged.
   - **Retry re-enabling muted mic (witness defect):** `getUserMedia` now requests `audio: micEnabledRef.current, video: cameraOnRef.current` — a retry after muting the mic asks only for video. Toggle intents mirror into refs (`micEnabledRef`/`cameraOnRef`) via `toggleMic`/`toggleCamera` so `startCapture` keeps a stable identity (no recapture on toggle) and the footer handlers stay one-liners.
   - **In-flight toggle race:** if a toggle flips while the capture request is pending, the resolved stream is filtered — disabled kinds' tracks are stopped and excluded (`new MediaStream(wantedTracks)`), the same semantics the mute effects apply.
   - Phase machine untouched: joining → connected only after capture resolves; error mapping, honest remote row, leave flow unchanged.
2. `src/app/app/call/[id]/page.tsx`
   - **Signed-out refusal was dishonest:** it reported `not_a_participant` ("You're not in this call" + "Back to the app") to unauthenticated visitors. Now: reason `signed_out`, copy "Sign in to open this call", and the action link goes to `/sign-in` ("Sign in") instead of bouncing through /app.
   - Server-side membership check still runs for every signed-in visitor; participants still come from the access record (room row) — `matching.ts` untouched.

## Tests added (this thread)

- `tests/unit/voice-call-screen.honesty.test.tsx` — new describe "leaving the room releases the camera (witnesses)": unmount-after-capture leaves zero live tracks; unmount during a pending capture releases the late stream (the uncancelled-capture-await witness); a toggle flipped during a pending capture is honored (muted mic never goes live); retry after muting the mic does not re-open the microphone.
- `tests/unit/call-page.access.test.tsx` — page-level witnesses: signed-out refusal (room lookup never called, sign-in link); signed-in non-participant refused via `getRoomForUser` with exact args; ended-room refusal; participants passed to the call screen verbatim from the access record.
- `tests/unit/call-room.access.db.test.ts` — real-database witnesses (PG 54333 via `dev-up.mjs`'s `LOCAL_DATABASE_URL`, honours `LINKEDUP_PG_PORT`): membership both directions from the room record; non-participant/unknown user/missing room refusals; repeat reads (reload) return identical access with one room row and one matched queue entry and `queueStateForUser` still matched to the same room; `endRoom` idempotent; after end both participants refuse `room_ended` and queue state is honestly idle. Synthetic rows, cascade cleanup in afterAll.

## Verification bar (pending — recorded when done)

- [ ] `npx tsc --noEmit` (queued, post-fix tree) — exit _, _ s
- [ ] `npx vitest run` — exit _, _ s, count _
- [ ] Playwright run + screenshots — pending

## Screenshots (pending)

- [ ] desktop 1440x900 → docs/plan/evidence/
- [ ] mobile 390x844 → docs/plan/evidence/

## Push / checkpoint protocol

- LOCAL-MODE OVERRIDE active (fleet token push rejection). At each push point: attempt push ONCE; on auth failure, `git bundle create ../r4-call-<n>.bundle origin/obv/linkedup-journey-foundation-f1..HEAD` + `obvious files upload` — bundle artifact ids recorded here.
- Bundles so far: (none yet)
