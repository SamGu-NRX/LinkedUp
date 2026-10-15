# Enable onboarding and migrate the production database

For Sam or the release operator, after reviewing this PR and before promoting alpha to main.

1. In the **production** Clerk instance, open **Sessions → Customize session token**. Add `"metadata": "{{user.public_metadata}}"` to the existing claims JSON and save it. Keep other claims. This is a session-token setting, not a named JWT template. [Clerk documents the setting and refresh behavior](https://clerk.com/docs/guides/users/extending#metadata-in-the-session-token).
2. Take a restorable production database snapshot and pause app writes. Verify the release checkout, its `DATABASE_URL`, and the `public` schema before running `pnpm exec drizzle-kit migrate`. Use the production secret through the deployment environment; do not paste it into logs or this document.
3. If migration 0000 reports `LinkedUp baseline mismatch`, stop and reconcile the named schema difference against the snapshot. Do not mark it applied manually. The baseline preserves existing rows and checks column types, nullability, defaults, primary/unique constraints, foreign keys, and its queue indexes. It adds the nullable name columns missing on main.
4. Let Drizzle use its existing journal. It applies 0006 for ratings and 0007 for orphan cleanup even if the original 0005 was already recorded. Do not replay 0005. Verify eight journal entries through 0007 and the `call_ratings` table, its 1–5 check, and its unique room/person index.
5. Re-enable writes and complete a real sign-up and onboarding. Confirm the refreshed session contains boolean `metadata.onboardingComplete: true`, then open `/app`. A completed profile with an old claim repairs its public metadata and requests a fresh token. Missing customization leaves a stable recovery screen with a retry button.
6. Finish a two-person call through the normal routes. Each person rates and chooses **Done**, returns to `/app`, and has one saved rating for that room. Repeated submission updates the same row. Verify both people can enter a fresh queue.

The local migration fixture is reconstructed from main source, not a production dump. Production data volume and migration lock duration have not been measured. The cleanup retires active rooms missing either matched participant and releases their remaining entries, so pausing writes prevents new matches from changing during cleanup.

A room with either person absent for more than two minutes expires when a participant next polls their queue, rejoins it, opens the room, or resumes signaling with a join or poll. Queue-offer polls and call heartbeats both count as presence. The two-minute reload allowance is a product choice without measured reload-gap data.

ICE configuration remains lane 2's promotion dependency. These changes do not establish connectivity across different networks.
