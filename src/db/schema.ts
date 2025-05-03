import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Define the structure for the 'report' column based on your Zod schema
// Note: Drizzle doesn't directly use Zod types for DB columns,
// but this helps document what the jsonb structure should contain.
// We'll store the validated Zod object as JSONB.
import { type DetailedIndieGameReport } from "@/schema"; // Assuming path is correct

export const finds = pgTable(
  "finds",
  {
    id: serial("id").primaryKey(),
    sourceTweetId: text("source_tweet_id").notNull(), // Extracted ID from URL
    sourceTweetUrl: text("source_tweet_url").notNull(), // The full URL used for the find

    // Raw JSON dumps from APIs
    rawTweetJson: jsonb("raw_tweet_json"), // Storing the raw JSON object from Twitter API
    rawAuthorJson: jsonb("raw_author_json"), // Storing the raw JSON object for the author profile
    rawSteamJson: jsonb("raw_steam_json"), // Storing the raw JSON from Steam API (if found)
    rawDemoHtml: text("raw_demo_html"), // Storing the raw HTML snippet for demo check (if found)

    // The processed report conforming to DetailedIndieGameReportSchema
    report: jsonb("report").$type<DetailedIndieGameReport>().notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()) // Auto-update on modification
      .notNull(),
  },
  (table) => {
    return {
      // Add an index to quickly find finds by their source tweet ID
      tweetIdIdx: uniqueIndex("tweet_id_idx").on(table.sourceTweetId),
    };
  }
);

// Optional: Define a type for inserting new finds if needed elsewhere
export type NewFind = typeof finds.$inferInsert;
// Optional: Define a type for selecting finds if needed elsewhere
export type SelectFind = typeof finds.$inferSelect;
