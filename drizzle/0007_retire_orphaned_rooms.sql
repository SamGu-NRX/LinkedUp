-- Original 0005 could already be recorded in the journal while its losing
-- room remained active. An additive migration repairs those installations.
UPDATE "rooms" AS r SET "status" = 'ended', "ended_at" = now()
WHERE r."status" = 'active' AND (
  NOT EXISTS (SELECT 1 FROM "queue_entries" q WHERE q."room_id" = r."id" AND q."user_id" = r."user1_id" AND q."status" = 'matched')
  OR NOT EXISTS (SELECT 1 FROM "queue_entries" q WHERE q."room_id" = r."id" AND q."user_id" = r."user2_id" AND q."status" = 'matched')
);
--> statement-breakpoint
UPDATE "queue_entries" AS q SET "status" = 'exited', "exited_at" = now()
WHERE q."status" = 'matched' AND (
  q."room_id" IS NULL
  OR NOT EXISTS (SELECT 1 FROM "rooms" r WHERE r."id" = q."room_id" AND r."status" = 'active')
);
