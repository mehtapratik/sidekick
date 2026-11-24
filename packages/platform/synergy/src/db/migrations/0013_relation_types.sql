CREATE TABLE "relation_types" (
	"source_key" text PRIMARY KEY NOT NULL,
	"target_key" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relation_types_kind_check" CHECK ("relation_types"."kind" IN ('reference', 'association')),
	CONSTRAINT "relation_types_status_check" CHECK ("relation_types"."status" IN 
        ('active', 'deprecated'))
);
--> statement-breakpoint
ALTER TABLE "relation_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "relation_types_read_all" ON "relation_types" AS PERMISSIVE FOR SELECT TO public USING (true); 
--> statement-breakpoint

-- The starter vocabulary (relationships PRD) and the two system rows.
-- Seeded BEFORE the FORCE below: FORCE makes the table owner obey RLS too,
-- and there is no INSERT policy, so after it not even this migration could write.
INSERT INTO "relation_types" ("source_key", "target_key", "kind", "is_system") VALUES
	-- References: the source points at the target.
	('derived-from', 'source-of', 'reference', false),
	('cites', 'cited-by', 'reference', false),
	('supported-by', 'evidence-for', 'reference', false),
	('explained-by', 'explains', 'reference', false),
	('exception-to', 'has-exception', 'reference', false),
	-- Associations: the two entities are only related. May form loops.
	('inspired-by', 'inspiration-for', 'association', false),
	('next', 'previous', 'association', false),
	('related-to', 'related-to', 'association', false),
	('contradicts', 'contradicts', 'association', false),
	('defined-by', 'defines', 'association', false),
	('violates', 'violated-by', 'association', false),
	-- System rows: Synergy's own, not part of the vocabulary users pick from.
	('untyped', 'untyped', 'reference', true),
	('superseded-by', 'supersedes', 'reference', true);
--> statement-breakpoint

-- Two walls, as for the outbox (0009). The policy limits WHICH rows are
-- visible; this REVOKE limits WHICH operations app_runtime may run. Core's
-- default privileges gave it all four; it keeps SELECT only.
ALTER TABLE "relation_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "relation_types" FROM app_runtime;

