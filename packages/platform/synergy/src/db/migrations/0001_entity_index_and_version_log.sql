CREATE TABLE "entity_index" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"display_name" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"content_seq" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "entity_index_status_check" CHECK ("entity_index"."status" IN ('active', 'deprecated', 'superseded')),
	CONSTRAINT "entity_index_counters_check" CHECK ("entity_index"."version" > 0 AND "entity_index"."revision" >= 0 AND "entity_index"."content_seq" >= 0),
	CONSTRAINT "entity_index_actor_kind_check" CHECK ("entity_index"."actor_kind" IN ('person', 'system', 'agent', 'api_key')),
	CONSTRAINT "entity_index_actor_id_check" CHECK (("entity_index"."actor_kind" = 'system') = ("entity_index"."actor_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "version_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "version_log_version_check" CHECK ("version_log"."version" > 0),
	CONSTRAINT "version_log_actor_kind_check" CHECK ("version_log"."actor_kind" IN ('person', 'system', 'agent', 'api_key')),
	CONSTRAINT "version_log_actor_id_check" CHECK (("version_log"."actor_kind" = 'system') = ("version_log"."actor_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "entity_index" ADD CONSTRAINT "entity_index_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_log" ADD CONSTRAINT "version_log_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_log" ADD CONSTRAINT "version_log_entity_id_entity_index_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity_index"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_index_user_id_status_idx" ON "entity_index" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "version_log_entity_id_version_key" ON "version_log" USING btree ("entity_id","version") WHERE "version_log"."deleted_at" IS NULL;