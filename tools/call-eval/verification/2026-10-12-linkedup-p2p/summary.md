# LinkedUp call eval summary

Whole-run wall time: 547.1 s

| Scenario | Pass | Total |
|---|---|---|
| H-01 | 3 | 3 |
| H-02 | 3 | 3 |
| H-03 | 3 | 3 |
| H-04 | 3 | 3 |
| H-05 | 3 | 3 |
| H-06 | 3 | 3 |
| H-07 | 3 | 3 |
| H-08 | 3 | 3 |
| H-09 | 3 | 3 |
| H-10 | 3 | 3 |
| H-11 | 3 | 3 |
| H-12 | 3 | 3 |
| H-13 | 3 | 3 |
| H-14 | 3 | 3 |

p95 time-to-first-remote-frame: 2538 ms (n=3)
p95 H-07 10 s-drop recovery: 4086 ms (n=3)

## Environment

- node: v24.18.0
- chromium: chromium
- turn: in-process Node relay (runner/turn-relay.mjs)
- signaling: Postgres via POST /api/call/signal, polled every 250 ms (journey-proof path)
- platform: darwin arm64

Failures: none
