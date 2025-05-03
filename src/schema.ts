import { z } from "zod";

// Define the Zod schema for the final report
export const IndieDevReportSchema = z.object({
  developerName: z
    .string()
    .nullable()
    .describe("The name of the indie developer or studio. Null if not found."),
  gameName: z
    .string()
    .nullable()
    .describe("The name of the game. Null if not found."),
  tweetSummary: z
    .string()
    .describe(
      "A brief summary of the original tweet's content based *only* on the tweet text provided."
    ),
  webSearchResultSummary: z
    .string()
    .describe(
      "A summary of the findings from the initial web search (developer info, game info, URLs)."
    ),
  developerWebsiteUrl: z
    .string()
    .nullable()
    .describe(
      "Official website URL of the developer/studio found during web search. Null if not found."
    ),
  gameWebsiteUrl: z
    .string()
    .nullable()
    .describe(
      "Official website URL of the game found during web search. Null if not found."
    ),
  steamStoreUrl: z
    .string()
    .nullable()
    .describe(
      "URL of the game's Steam store page found during web search. Null if not found."
    ),
  fundingPageUrl: z
    .string()
    .nullable()
    .describe(
      "URL of the Kickstarter or other funding page found during web search, if applicable. Null if not found."
    ),
  steamDescription: z
    .string()
    .nullable()
    .describe(
      "Description snippet scraped from the Steam page, if available. Null if not found."
    ),
  steamTags: z
    .string()
    .nullable()
    .describe(
      "Comma-separated tags/genres scraped from the Steam page, if available. Null if not found."
    ),
  overallSummary: z
    .string()
    .describe(
      "A final synthesized summary combining all gathered information."
    ),
});
