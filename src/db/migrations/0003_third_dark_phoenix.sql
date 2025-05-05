ALTER TABLE "finds" RENAME COLUMN "raw_demo_html" TO "has_steam_demo";--> statement-breakpoint
DROP INDEX "source_tweet_id_idx";--> statement-breakpoint
ALTER TABLE "finds" DROP COLUMN "source_tweet_id";--> statement-breakpoint
ALTER TABLE "finds" DROP COLUMN "source_tweet_url";--> statement-breakpoint
ALTER TABLE "finds" DROP COLUMN "raw_tweet_json";--> statement-breakpoint
ALTER TABLE "finds" DROP COLUMN "raw_author_json";