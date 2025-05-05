DROP INDEX "tweet_id_idx";--> statement-breakpoint
ALTER TABLE "finds" ALTER COLUMN "source_tweet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finds" ALTER COLUMN "source_tweet_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finds" ADD COLUMN "source_steam_app_id" text;--> statement-breakpoint
ALTER TABLE "finds" ADD COLUMN "source_steam_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "source_tweet_id_idx" ON "finds" USING btree ("source_tweet_id") WHERE "finds"."source_tweet_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "source_steam_app_id_idx" ON "finds" USING btree ("source_steam_app_id") WHERE "finds"."source_steam_app_id" IS NOT NULL;