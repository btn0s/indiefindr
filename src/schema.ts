import { z } from "zod";

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
  sourceSteamUrl: z.string().url().nullable(),
  steamAppId: z
    .string()
    .nullable()
    .describe(
      "The extracted Steam Application ID, if a Steam store page link was found."
    ),
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
