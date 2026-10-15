# Call network access

The call page obtains temporary ICE credentials before joining. `GET /api/call/ice?roomId=<uuid>` authenticates with Clerk and checks active room membership before issuing credentials. Responses use `Cache-Control: private, no-store`.

The provider selects Cloudflare first, then shared-secret TURN, then STUN when neither provider is configured. Partial provider configuration returns an error. A configured provider failure never silently falls back to STUN.

Server environment names match Connvo:

- `TURN_CLOUDFLARE_KEY_ID`
- `TURN_CLOUDFLARE_API_TOKEN`
- `TURN_SHARED_SECRET`
- `TURN_URLS`

Cloudflare requires both Cloudflare names. A coturn deployment requires both shared-secret names, with comma-separated TURN URLs. Credentials expire after one hour. Only temporary credentials reach the authenticated browser. Keep provider keys out of public environment variables, logs, and source control.

The room session caches credentials in memory and refreshes within 30 seconds of expiry before an ICE restart or received offer. `data-call-connection-path` exposes `direct`, `relay`, or `unknown` from the selected candidate pair. It contains no addresses or credentials.

The call retries ICE while joining or reconnecting. A newly arrived unreachable peer exhausts the existing 30-second joining budget even when signaling connected first. The failure explains that a network may block calls, and Reconnect creates a fresh transport.

The local journey-proof call page passes `/onboarding?journey-proof=ice` as its ICE endpoint. The guarded rewrite forwards that request to the same authenticated API route, retaining `roomId`. The normal `/app` call page keeps `/api/call/ice`. The proof rewrite is absent by default and refuses production builds, production servers, and Vercel deployments under the existing `LINKEDUP_JOURNEY_PROOF` guard.

`~/.long-run/bin/heavy node tools/call-eval/scripts/prove-turn.mjs --scenarios=H-17,H-01,H-18 --seeds=1,2,3` owns a disposable shared-secret Node relay and the local app on port 3202. H-17 overrides only `iceTransportPolicy`, verifies endpoint-issued credentials, decodes peer audio and video, checks relay candidates on both sides, and checks packet counters. H-18 drops relay requests, observes ICE restarts and exhaustion, restores the relay, and verifies keyboard retry recovers relayed media. It restores relay availability in `finally` so later seeds remain independent. Results and screenshots live under `docs/lane2/`.

For a production build after local keyless provisioning, run `~/.long-run/bin/heavy node tools/call-eval/scripts/build-keyless.mjs`. It reads only this checkout's `.clerk/.tmp/keyless.json`, supplies the keys inside the build process, clears the local proof flag, and uses the lane's `linkedup_turn` database. It never prints keys. The explicit-key build approach is recorded in `docs/plan/evidence/r4-baseline.md` and `docs/plan/handoffs/linkedup-journey-foundation-f1.md`.

Cloudflare API contract: [Generate credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
