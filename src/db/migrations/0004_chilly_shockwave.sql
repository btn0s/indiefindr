DROP INDEX "source_steam_app_id_idx";--> statement-breakpoint
ALTER TABLE "finds" ADD COLUMN "audience_appeal" text;--> statement-breakpoint
CREATE UNIQUE INDEX "source_steam_app_id_idx" ON "finds" USING btree ("source_steam_app_id") WHERE "finds"."source_steam_app_id" is not null;