CREATE TABLE "user_feature_entitlements" (
	"user_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_feature_entitlements_user_id_feature_key_pk" PRIMARY KEY("user_id","feature_key")
);
--> statement-breakpoint
ALTER TABLE "user_feature_entitlements" ADD CONSTRAINT "user_feature_entitlements_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
