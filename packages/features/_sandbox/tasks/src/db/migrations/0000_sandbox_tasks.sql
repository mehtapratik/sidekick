CREATE TABLE "sandbox_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sandbox_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sandbox_tasks" ADD CONSTRAINT "sandbox_tasks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sandbox_tasks_own_live_rows" ON "sandbox_tasks" AS PERMISSIVE FOR ALL TO public USING ("sandbox_tasks"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid AND "sandbox_tasks"."deleted_at" IS NULL) WITH CHECK ("sandbox_tasks"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);