CREATE TABLE "finds" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_tweet_id" text NOT NULL,
	"source_tweet_url" text NOT NULL,
	"raw_tweet_json" jsonb,
	"raw_author_json" jsonb,
	"raw_steam_json" jsonb,
	"raw_demo_html" text,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tweet_id_idx" ON "finds" USING btree ("source_tweet_id");