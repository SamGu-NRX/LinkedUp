CREATE TABLE "call_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_ratings_rating_range" CHECK ("call_ratings"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_ratings" ADD CONSTRAINT "call_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_ratings_room_user_unique" ON "call_ratings" USING btree ("room_id","user_id");