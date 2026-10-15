CREATE TABLE "call_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" integer NOT NULL,
	"state" varchar(10) DEFAULT 'open' NOT NULL,
	"closed_reason" varchar(10),
	"mic_on" boolean DEFAULT true NOT NULL,
	"camera_on" boolean DEFAULT true NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rate_window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"rate_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_signals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"from_session_id" varchar(64) NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_session_id" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_signals" ADD CONSTRAINT "call_signals_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_sessions_room_session_unique" ON "call_sessions" USING btree ("room_id","session_id");--> statement-breakpoint
CREATE INDEX "call_sessions_room_state_idx" ON "call_sessions" USING btree ("room_id","state");--> statement-breakpoint
CREATE INDEX "call_sessions_room_user_state_idx" ON "call_sessions" USING btree ("room_id","user_id","state");--> statement-breakpoint
CREATE INDEX "call_sessions_state_heartbeat_idx" ON "call_sessions" USING btree ("state","last_heartbeat_at");--> statement-breakpoint
CREATE INDEX "call_signals_unread_idx" ON "call_signals" USING btree ("room_id","to_session_id","processed","id");--> statement-breakpoint
CREATE INDEX "call_signals_cleanup_idx" ON "call_signals" USING btree ("processed","created_at");