CREATE TABLE "call_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"peer_id" integer NOT NULL,
	"queue_type" varchar(20) NOT NULL,
	"duration_seconds" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_peer_id_users_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_summaries_room_user_unique" ON "call_summaries" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "call_summaries_user_recent_idx" ON "call_summaries" USING btree ("user_id","ended_at");