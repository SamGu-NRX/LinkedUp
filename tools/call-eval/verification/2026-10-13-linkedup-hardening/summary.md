# LinkedUp call eval summary

Whole-run wall time: 182.3 s

| Scenario | Pass | Total |
|---|---|---|
| H-01 | 1 | 1 |
| H-02 | 1 | 1 |
| H-03 | 1 | 1 |
| H-04 | 1 | 1 |
| H-05 | 1 | 1 |
| H-06 | 1 | 1 |
| H-07 | 1 | 1 |
| H-08 | 1 | 1 |
| H-09 | 1 | 1 |
| H-10 | 1 | 1 |
| H-11 | 1 | 1 |
| H-12 | 1 | 1 |
| H-13 | 1 | 1 |
| H-14 | 1 | 1 |

p95 time-to-first-remote-frame: 1132 ms (n=1)
p95 H-07 10 s-drop recovery: 3980 ms (n=1)

## Environment

- node: v24.18.0
- chromium: chromium
- turn: in-process Node relay (runner/turn-relay.mjs)
- signaling: Postgres via POST /api/call/signal, polled every 250 ms (journey-proof path)
- platform: darwin arm64

Failures: none
