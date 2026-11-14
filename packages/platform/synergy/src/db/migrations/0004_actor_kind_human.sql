ALTER TABLE "entity_index" DROP CONSTRAINT "entity_index_actor_kind_check";--> statement-breakpoint
ALTER TABLE "version_log" DROP CONSTRAINT "version_log_actor_kind_check";--> statement-breakpoint
ALTER TABLE "entity_index" ADD CONSTRAINT "entity_index_actor_kind_check" CHECK ("entity_index"."actor_kind" IN ('human', 'system', 'agent', 'api_key'));--> statement-breakpoint
ALTER TABLE "version_log" ADD CONSTRAINT "version_log_actor_kind_check" CHECK ("version_log"."actor_kind" IN ('human', 'system', 'agent', 'api_key'));