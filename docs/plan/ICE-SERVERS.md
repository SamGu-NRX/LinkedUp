# Call network access

The call page obtains short-lived ICE credentials from `GET /api/call/ice` before joining. Clerk authenticates the request, and `getRoomForUser` checks active room membership before the provider runs. Responses use `Cache-Control: private, no-store`.

The provider selects Cloudflare first, then a shared-secret TURN server, then STUN when neither provider is configured. Partial provider configuration returns an error. A configured provider failure never silently falls back to STUN.

Server environment names:

- `TURN_CLOUDFLARE_KEY_ID`
- `TURN_CLOUDFLARE_API_TOKEN`
- `TURN_SHARED_SECRET`
- `TURN_URLS`

Cloudflare requires both Cloudflare names. A coturn deployment requires both shared-secret names, with comma-separated TURN URLs. Credentials expire after one hour. Only temporary credentials reach the authenticated browser. Keep provider keys out of public environment variables, logs, and source control.

The room session caches credentials in memory and refreshes within 30 seconds of expiry before an ICE restart or a received offer. `data-call-connection-path` exposes `direct`, `relay`, or `unknown` from the selected candidate pair. It contains no addresses or credentials.

The call retries ICE while joining or reconnecting. A peer that remains unreachable exhausts a 30-second initial connection budget, even if signaling succeeded first. The existing Reconnect button creates a new transport and explains that a network may block calls.

`tools/call-eval/scripts/prove-turn.mjs` owns a disposable shared-secret Node TURN relay and the local app process on port 3202. H-17 overrides only `iceTransportPolicy`, then checks endpoint access, decoded peer audio and video, selected relay candidates, and actual relay packet counters. It writes results under `docs/lane2/verification` and screenshots under `docs/lane2/screenshots`. Run it through `~/.long-run/bin/heavy` against the migrated `linkedup_turn` database on the shared local PostgreSQL server.

The reserved middleware currently redirects keyless users away from `/api/call/ice` before that route runs. `tests/unit/call-ice-middleware.witness.test.ts` records this known failure. The H-17 seed-1 run failed before creating any peer connection; both rooms showed the network-access error. Captures include Clerk's keyless-development notice, which overlaps lower call controls on mobile. A local proof route cannot establish production middleware acceptance. Sam must resolve the middleware or its Clerk session-token contract before the ordinary `/app` flow is accepted.

Cloudflare API contract: [Generate credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
