-- One live queue entry per person, waiting or matched. Data from before
-- this index can break it: the race it closes left some people with a
-- waiting entry beside a matched one, or with two matched entries. Resolve
-- those first: a waiting entry beside a matched one expires (the match is
-- what the person is in), and of several matched entries the newest stays.
UPDATE "queue_entries" AS w SET "status" = 'expired', "exited_at" = now()
WHERE w."status" = 'waiting'
  AND EXISTS (SELECT 1 FROM "queue_entries" AS m WHERE m."user_id" = w."user_id" AND m."status" = 'matched');--> statement-breakpoint
UPDATE "queue_entries" AS old SET "status" = 'exited', "exited_at" = now()
WHERE old."status" = 'matched'
  AND EXISTS (SELECT 1 FROM "queue_entries" AS newer WHERE newer."user_id" = old."user_id" AND newer."status" = 'matched' AND newer."id" > old."id");--> statement-breakpoint
DROP INDEX "queue_entries_user_waiting_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_user_live_unique" ON "queue_entries" USING btree ("user_id") WHERE status IN ('waiting', 'matched');
