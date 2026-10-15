# Lane 2L acceptance checks

The TURN implementation is committed, but relay acceptance is blocked by `src/middleware.ts:23`. It redirects signed-in room members without the custom Clerk onboarding claim before `/api/call/ice` runs. Both real call rooms reached the network-access error with no peer connection in H-17 seed 1. See [the run](summary.md) and [the middleware witness](../../../tests/unit/call-ice-middleware.witness.test.ts).

## Automated checks

The following command passed 58 tests across 10 files. The count includes one `it.fails` middleware witness whose assertion fails as expected. It records a blocker, not working endpoint access.

```sh
pnpm exec vitest run tests/unit/voice-call-screen.honesty.test.tsx tests/unit/voice-call-screen.transport.test.tsx tests/unit/call-page.access.test.tsx tests/unit/call-signal-route.errors.test.ts tests/unit/p2p-ice.test.ts tests/unit/call-ice-route.test.ts tests/unit/ice-provider.test.ts tests/unit/call-ice-middleware.witness.test.ts tools/call-eval/runner/probe.test.mjs tools/call-eval/runner/turn-relay.test.mjs
```

`pnpm exec vitest run tests/unit/p2p-ice.test.ts tests/unit/call-ice-middleware.witness.test.ts` passed 7 tests. `pnpm exec tsc --noEmit` passed. `pnpm lint` passed with three existing image warnings in the landing page and one-on-one meeting component.

```sh
~/.long-run/bin/heavy node tools/call-eval/scripts/prove-turn.mjs
```

H-17 failed, 0/1 seeds. The run uses this worktree's keyless Clerk development instance, `linkedup_turn` on localhost port 54329, the real call component and a shared-secret Node relay. Only the relay policy is injected; TURN credentials must come from the authenticated app endpoint. No media connection formed, so this run proves neither relay media nor ICE-failure recovery.

`~/.long-run/bin/heavy env DATABASE_URL=postgresql://postgres@127.0.0.1:54329/linkedup_turn pnpm build` compiled, then failed prerendering `/_not-found` with `@clerk/nextjs: Missing publishableKey`. A retry using the provisioned local keyless instance was cancelled after 11 minutes waiting for both shared heavy-work slots. That retry never started the build. The successful-build check remains open.

## Runtime limits

The four `screenshots/blocked-{A,B}-{1440x900,390x844}.png` captures show the new credential-service failure state. All four were inspected. Clerk's development notice overlaps the lower mobile controls. No connected state, initial ICE-exhaustion state, reduced-motion pass, keyboard-only runtime pass, screen-reader pass, Lighthouse audit or physical-device check was completed. The independent source review found no additional ICE or retry-control defect; it does not establish runtime acceptance.

The app and TURN relay started by the proof exited. PostgreSQL is shared with other active lanes and must remain available to them.
