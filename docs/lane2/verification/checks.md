# Lane 2L acceptance checks

H-17 and H-01 passed all three seeds through the guarded journey-proof call page. H-17 selected `relay` for both local and remote candidates on each caller, decoded both audio tones and peer colors, and observed relay media packets. [Media results](results.json) retain all six records from the executed matrix.

## Automated checks

This command passed 68 tests across 10 files, with no expected-failure witness:

```sh
pnpm exec vitest run tests/unit/voice-call-screen.honesty.test.tsx tests/unit/voice-call-screen.transport.test.tsx tests/unit/call-page.access.test.tsx tests/unit/call-signal-route.errors.test.ts tests/unit/p2p-ice.test.ts tests/unit/call-ice-route.test.ts tests/unit/ice-provider.test.ts tests/unit/journey-proof-guard.test.ts tools/call-eval/runner/probe.test.mjs tools/call-eval/runner/turn-relay.test.mjs
```

`pnpm exec tsc --noEmit` passed. `pnpm lint` passed with three inherited image warnings in the landing page and one-on-one meeting component.

```sh
~/.long-run/bin/heavy node tools/call-eval/scripts/prove-turn.mjs --scenarios=H-17,H-01,H-18 --seeds=1,2,3
```

H-17 passed 3/3 and H-01 passed 3/3. H-18 initially failed its verifier's expected color label. A later 2/3 run had a retry timeout that did not reproduce in its diagnostic seed. Source inspection found a race in selecting callers before both old attempts settled; the verifier now waits for both original connections to close.

```sh
~/.long-run/bin/heavy node tools/call-eval/scripts/prove-turn.mjs --scenarios=H-18 --seeds=1,2,3 --out=docs/lane2/verification/recovery
```

The final H-18 run passed seeds 2 and 3, proving real TURN request loss, ICE restarts, honest exhaustion, and keyboard retry with relayed live media on both callers. Seed 1 failed inside `@clerk/testing` sign-in before entering the call; its error contained no further detail. This is 2/3, not a full pass. [Recovery results](recovery/results.json) retain all three records. An earlier seed-1 run also recovered successfully, but it does not replace the final run's failed sign-in.

## Build

```sh
~/.long-run/bin/heavy node tools/call-eval/scripts/build-keyless.mjs
```

Passed, exit 0, with all 11 static pages generated. [Build output](build-output.txt) contains the complete build output without key values. The script supplies this checkout's provisioned keyless Clerk keys inside the process and runs `pnpm build` with the proof flag cleared. Alpha's `docs/plan/evidence/r4-baseline.md` and foundation handoff record an explicit publishable-key build, and PR #15 reports it passed. The earlier missing-key failure used a different invocation; supplying the provisioned keys resolves it on this branch.

## Runtime inspection

H-17 seed 1 completed keyboard mute, camera toggling, camera-menu focus and Escape restoration, Leave and Rejoin at both 1440x900 and 390x844. Connected and ICE-exhaustion states were captured at both sizes with normal and reduced motion. All eight captures were inspected. No horizontal overflow or running reduced-motion animation was observed.

Captures hide only Clerk's keyless-development notice and Next's development indicator, following the existing `call-states-shots.mjs` workflow. Generated camera colors and audio tones identify the two callers. The app and authenticated API responses are real and were not intercepted. These Chromium checks do not establish physical-device, screen-reader, Safari, Firefox, or live Cloudflare service acceptance.

The proof owns the app on port 3202 and a disposable Node TURN relay. Both exit after each run. The shared PostgreSQL server remains available to other lanes.
