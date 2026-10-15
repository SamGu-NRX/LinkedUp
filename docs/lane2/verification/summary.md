# Call media proof

These six results are the H-17 and H-01 records from the executed three-seed matrix. H-18 recovery is reported separately in [recovery/summary.md](recovery/summary.md), after correcting its verifier's expected color label.

| Scenario | Passed | Seeds |
| --- | --- | --- |
| H-17, endpoint-issued relay media | 3/3 | 1, 2, 3 |
| H-01, first frames, peer colors and frame rate | 3/3 | 1, 2, 3 |

Every H-17 selected pair reports `local: relay` and `remote: relay` on both callers. Both received audio tones and peer colors were decoded. The relay recorded real media packets in both directions. H-01's first remote frames arrived in 949–2008 ms, with measured frame rates of 30.3–35.3 fps.

H-17 seed 1 completed keyboard mute, camera toggling, camera-menu focus and Escape restoration, Leave and Rejoin at 1440x900 and 390x844. The connected state was captured at both sizes with normal and reduced motion. Every captured call had no horizontal overflow; reduced-motion captures had no running animations.

The call room and authenticated ICE endpoint ran through the local journey-proof aliases, with keyless Clerk users, the lane-owned `linkedup_turn` database, and generated camera/microphone fixtures. Only `iceTransportPolicy: relay` was injected. Credentials came from the app endpoint. No app document or API response was intercepted.
