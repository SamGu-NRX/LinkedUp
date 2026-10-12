# LinkedUp call eval

Scores the two-peer H scenarios (`lib/scenario-contracts.ts`, from Connvo's
`CALL-PLAN.md`) on LinkedUp's real call room. Ported from Connvo's
`tools/call-eval` at alpha d5be541. The fixtures, decoders, probe, TURN
relay, shaper and scenario bodies are Connvo's. LinkedUp's own parts are
`runner/context.mjs` and `runner/linkedup.mjs`:

- Personas A, B and the outsider O are Clerk users on the stack's keyless
  instance with onboarded `users` rows. Sign-up and onboarding are the J
  suite's job.
- Each peer is its own Chromium with the fixture camera and microphone. It
  signs in with `@clerk/testing`, queues on the journey-proof queue page and
  presses Join the call, so every room comes from the real queue. The
  personas are freed between scenarios (rooms ended, queue entries exited).
- Pages show people by `users.id`; the harness names them by letter, and
  `window.__harnessIds` maps one to the other in every page.
- H-07's "signaling gone" takes the peer's browser offline; its media is cut
  by its UDP shaper, as in Connvo.

Run it against the stack started with the journey-proof path and the call
trace:

```sh
LINKEDUP_JOURNEY_PROOF=1 NEXT_PUBLIC_LINKEDUP_CALL_TRACE=1 pnpm dev:up
pnpm call-eval:fixtures            # once; the media files are not committed
pnpm call-eval --base-url=http://localhost:3000 --scenarios=H-01..H-14 --seeds=1..3
node tools/call-eval/scripts/call-states-shots.mjs --base-url=http://localhost:3000
```

Results go to `tools/call-eval/out/` (`--out` to change it). H-15 and H-16
are in `runner/scenarios-h.mjs` but not wired for this port.
