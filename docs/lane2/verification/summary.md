# LinkedUp call eval summary

Whole-run wall time: 63.4 s

| Scenario | Pass | Total |
|---|---|---|
| H-17 | 0 | 1 |

p95 time-to-first-remote-frame: n/a ms (n=0)
p95 H-07 10 s-drop recovery: n/a ms (n=0)

## Environment

- node: v26.5.0
- chromium: chromium
- turn: in-process Node relay (runner/turn-relay.mjs)
- signaling: Postgres via POST /api/call/signal, polled every 250 ms (journey-proof path)
- platform: darwin arm64

Failures:
- H-17 seed 1 (p2p-postgres): A: condition not reached within 30000 ms | [{"url":"/onboarding?journey-proof=call&room=…","phase":"failed","error":"The call service could not prepare network access. Try again.","tiles":[],"pcs":[],"candidates":[],"configs":[],"probeConfig":"{\"iceTransportPolicy\":\"relay\"}","freshGather":{"found":["end"],"state":"complete"},"visibility":"visible","log":["7765 connect as 1"]},{"url":"/onboarding?journey-proof=call&room=…","phase":"failed","error":"The call service could not prepare network access. Try again.","tiles":[],"pcs":[],"candidates":[],"configs":[],"probeConfig":"{\"iceTransportPolicy\":\"relay\"}","freshGather":{"found":["end"],"state":"complete"},"visibility":"visible","log":["2460 connect as 2"]}]
