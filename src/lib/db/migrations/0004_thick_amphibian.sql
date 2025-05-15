CREATE TYPE "public"."game_enrichment_content_type" AS ENUM('description', 'review_snippet', 'video_url', 'image_url', 'article_url', 'social_post_url', 'game_feature', 'system_requirements', 'tag', 'genre');--> statement-breakpoint
CREATE TYPE "public"."game_enrichment_status" AS ENUM('active', 'inactive', 'pending_review', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."game_overall_enrichment_status" AS ENUM('pending', 'in_progress', 'partial', 'enriched', 'failed');--> statement-breakpoint
CREATE TABLE "game_enrichment" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"source_name" text NOT NULL,
	"source_specific_id" text,
	"content_type" "game_enrichment_content_type" NOT NULL,
	"content_value" text,
	"content_json" jsonb,
	"language" text DEFAULT 'en',
	"region" text,
	"priority" bigint,
	"status" "game_enrichment_status" DEFAULT 'active' NOT NULL,
	"source_url" text,
	"retrieved_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"submitted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "external_source" RENAME TO "games";--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "external_source_external_id_unique";--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "external_source_steam_appid_unique";--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "external_source_found_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "library" DROP CONSTRAINT "library_game_ref_id_external_source_id_fk";
--> statement-breakpoint
DROP INDEX "idx_external_source_external_id";--> statement-breakpoint
DROP INDEX "idx_external_source_enrichment_status";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "has_completed_onboarding" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "game_enrichment" ADD CONSTRAINT "game_enrichment_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_enrichment" ADD CONSTRAINT "game_enrichment_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_game_id_content_type_source_name" ON "game_enrichment" USING btree ("game_id","content_type","source_name");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_game_id" ON "game_enrichment" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_content_type" ON "game_enrichment" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_game_enrichment_content_type_lang_region" ON "game_enrichment" USING btree ("content_type","language","region");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_found_by_profiles_id_fk" FOREIGN KEY ("found_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library" ADD CONSTRAINT "library_game_ref_id_games_id_fk" FOREIGN KEY ("game_ref_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_games_external_id" ON "games" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_games_enrichment_status" ON "games" USING btree ("enrichment_status");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_steam_appid_unique" UNIQUE("steam_appid");