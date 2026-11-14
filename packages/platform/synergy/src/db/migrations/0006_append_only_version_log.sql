DROP INDEX "version_log_entity_id_version_key";--> statement-breakpoint
CREATE UNIQUE INDEX "version_log_entity_id_version_key" ON "version_log" USING btree ("entity_id","version");--> statement-breakpoint
ALTER TABLE "version_log" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "version_log" DROP COLUMN "deleted_at";