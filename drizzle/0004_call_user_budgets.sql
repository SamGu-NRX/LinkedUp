CREATE TABLE "call_user_budgets" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"used" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_user_budgets" ADD CONSTRAINT "call_user_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;