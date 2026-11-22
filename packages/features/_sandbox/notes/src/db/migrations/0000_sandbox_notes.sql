CREATE TABLE "sandbox_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sandbox_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sandbox_notes" ADD CONSTRAINT "sandbox_notes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sandbox_notes_own_live_rows" ON "sandbox_notes" AS PERMISSIVE FOR ALL TO public USING ("sandbox_notes"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid AND "sandbox_notes"."deleted_at" IS NULL) WITH CHECK ("sandbox_notes"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);