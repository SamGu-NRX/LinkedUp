# LinkedUp call eval summary

Whole-run wall time: 134.7 s

| Scenario | Pass | Total |
|---|---|---|
| H-18 | 2 | 3 |

p95 time-to-first-remote-frame: n/a ms (n=0)
p95 H-07 10 s-drop recovery: n/a ms (n=0)

## Environment

- node: v26.5.0
- chromium: chromium
- turn: in-process Node relay (runner/turn-relay.mjs)
- signaling: Postgres via POST /api/call/signal, polled every 250 ms (journey-proof path)
- platform: darwin arm64

Failures:
- H-18 seed 3 (p2p-postgres): A: condition not reached within 15000 ms
