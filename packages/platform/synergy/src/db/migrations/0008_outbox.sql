CREATE TABLE "outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"xact_id" "xid8" DEFAULT pg_current_xact_id() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	CONSTRAINT "outbox_kind_check" CHECK ("outbox"."kind" IN ('entity.created', 'entity.content_saved', 'entity.version_bumped', 'entity.status_changed')),
	CONSTRAINT "outbox_actor_kind_check" CHECK ("outbox"."actor_kind" IN ('human', 'system', 'agent', 'api_key')),
	CONSTRAINT "outbox_actor_id_check" CHECK (("outbox"."actor_kind" = 'system') = ("outbox"."actor_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_xact_id_id_idx" ON "outbox" USING btree ("xact_id","id");--> statement-breakpoint
CREATE POLICY "outbox_insert_own_rows" ON "outbox" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("outbox"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);