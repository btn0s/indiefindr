import { z } from "zod";
import { customType } from "drizzle-orm/pg-core";
import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Define the custom vector type
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
});

const TeamMemberSchema = z.object({
  name: z.string().nullable().describe("Name of the team member."),
  role: z.string().nullable().describe("Known role of the team member."),
});

// A flexible schema for categorized links
const LinkSchema = z.object({
  type: z
    .string()
    .describe(
      "Type of link (e.g., 'Official Website', 'Steam', 'Twitter', 'Discord', 'YouTube', 'Kickstarter', 'Publisher', 'Itch.io', 'Press Kit', 'Subreddit', 'Other Store', 'Other Social', 'Other Community')."
    ),
  url: z.string().nullable().describe("The URL for the link."),
  name: z
    .string()
    .nullable()
    .describe(
      "Optional name or description for the link (e.g., store name, platform name)."
    ),
});

export const DetailedIndieGameReportSchema = z.object({
  // --- Core Entities ---
  gameName: z
    .string()
    .nullable()
    .describe(
      "Best guess for the primary name of the game based on all sources."
    ),
  developerName: z
    .string()
    .nullable()
    .describe(
      "Best guess for the name of the primary developer/studio based on all sources."
    ),
  publisherName: z
    .string()
    .nullable()
    .describe(
      "Best guess for the name of the game's publisher, if identified."
    ),

  // --- Descriptions & Details ---
  gameDescription: z
    .string()
    .nullable()
    .describe(
      "Synthesized description of the game (gameplay, story, features) based on all available information."
    ),
  developerBackground: z
    .string()
    .nullable()
    .describe(
      "Information found about the developer/studio's history, location, mission, notable previous work, or team size/structure."
    ),
  teamMembers: z
    .array(TeamMemberSchema)
    .nullable()
    .describe("List of identified team members and their roles, if found."),
  publisherInfo: z
    .string()
    .nullable()
    .describe(
      "Information found about the publisher (e.g., website, notable games)."
    ),
  fundingInfo: z
    .string()
    .nullable()
    .describe(
      "Details found about the game's funding status, history, or sources (e.g., Kickstarter details, publisher funding, self-funded)."
    ),
  releaseInfo: z
    .string()
    .nullable()
    .describe(
      "Information about the game's release status, date, target platforms, and price, if found."
    ),
  genresAndTags: z
    .array(z.string())
    .nullable()
    .describe(
      "List of genres and specific tags associated with the game based on all sources."
    ),

  // --- Links & Online Presence ---
  relevantLinks: z
    .array(LinkSchema)
    .nullable()
    .describe(
      "A comprehensive list of all relevant URLs found, categorized by type (Official Website, Steam, Twitter, Discord, YouTube, Kickstarter, Publisher, Itch.io, Press Kit, etc.). Try to find as many as possible."
    ),

  // --- Source Data & Confidence ---
  sourceTweetText: z
    .string()
    .describe("The original tweet text provided as input."),
  aiConfidenceAssessment: z
    .string()
    .nullable()
    .describe(
      "AI's brief assessment of the confidence in the accuracy and completeness of the gathered information (e.g., 'High confidence, most key details found', 'Moderate confidence, some details missing', 'Low confidence, primary sources limited')."
    ),

  // --- Final Summary ---
  overallReportSummary: z
    .string()
    .nullable()
    .describe(
      "A final synthesized summary paragraph combining the most important factual findings about the game and developer."
    ),
});

// Type alias for convenience
export type DetailedIndieGameReport = z.infer<
  typeof DetailedIndieGameReportSchema
>;

// Define the table for storing the submitted finds and their reports
export const finds = pgTable("finds", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceTweetId: text("source_tweet_id").notNull().unique(),
  sourceTweetUrl: text("source_tweet_url").notNull(),
  rawTweetJson: jsonb("raw_tweet_json"),
  rawAuthorJson: jsonb("raw_author_json"),
  rawSteamJson: jsonb("raw_steam_json"),
  rawDemoHtml: text("raw_demo_html"),
  report: jsonb("report").$type<DetailedIndieGameReport>().notNull(),
  vectorEmbedding: vector("vector_embedding"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Type alias for convenience when selecting/inserting finds
export type Find = typeof finds.$inferSelect;
export type NewFind = typeof finds.$inferInsert;
