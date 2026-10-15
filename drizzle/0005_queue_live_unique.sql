-- Duplicate matches previously released only the duplicate entry, leaving
-- its counterpart trapped in an active room. Retire the whole losing room.
UPDATE "queue_entries" AS w SET "status" = 'expired', "exited_at" = now()
WHERE w."status" = 'waiting'
  AND EXISTS (SELECT 1 FROM "queue_entries" AS m WHERE m."user_id" = w."user_id" AND m."status" = 'matched');
--> statement-breakpoint
-- Keep the newest entry first. Duplicates within one healthy room must
-- not retire that room; cross-room duplicates leave a missing participant
-- that the room cleanup below can detect.
UPDATE "queue_entries" AS old SET "status" = 'exited', "exited_at" = now()
WHERE old."status" = 'matched'
  AND EXISTS (SELECT 1 FROM "queue_entries" AS newer WHERE newer."user_id" = old."user_id" AND newer."status" = 'matched' AND newer."id" > old."id");
--> statement-breakpoint
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
--> statement-breakpoint
DROP INDEX "queue_entries_user_waiting_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_user_live_unique" ON "queue_entries" USING btree ("user_id") WHERE status IN ('waiting', 'matched');
