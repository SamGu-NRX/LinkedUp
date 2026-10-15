CREATE TABLE "room_match_intros" (
  "room_id" uuid PRIMARY KEY REFERENCES "rooms"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "question" text NOT NULL,
  "shared_interests" jsonb NOT NULL
);
