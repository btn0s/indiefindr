import { z } from "zod";

const TeamMemberSchema = z.object({
  name: z.string().nullable().describe("Name of the team member."),
  role: z.string().nullable().describe("Role of the team member."),
  // Add social links later if needed?
});

export const GameLandingPageSchema = z.object({
  // --- Game Info ---
  gameName: z.string().nullable().describe("The primary name of the game."),
  tagline: z
    .string()
    .nullable()
    .describe("A short, catchy tagline or slogan for the game."),
  shortDescription: z
    .string()
    .nullable()
    .describe("A brief (1-2 sentence) overview of the game."),
  detailedDescription: z
    .string()
    .nullable()
    .describe(
      "A more comprehensive description of the game, its story, gameplay, etc."
    ),
  genres: z
    .array(z.string())
    .nullable()
    .describe(
      "List of genres associated with the game (e.g., 'RPG', 'Strategy', 'Puzzle')."
    ),
  tags: z
    .array(z.string())
    .nullable()
    .describe(
      "List of more specific tags (e.g., 'Pixel Art', 'Roguelike', 'Co-op')."
    ),
  platforms: z
    .array(z.string())
    .nullable()
    .describe(
      "List of platforms the game is available on or planned for (e.g., 'PC', 'Mac', 'Linux', 'PlayStation 5', 'Xbox Series X/S', 'Nintendo Switch', 'iOS', 'Android')."
    ),
  releaseStatus: z
    .string()
    .nullable()
    .describe(
      "Current release status (e.g., 'Released', 'Early Access', 'Announced', 'Wishlist Only', 'TBA')."
    ),
  releaseDate: z
    .string()
    .nullable()
    .describe("The official release date (or planned year/quarter), if known."),
  price: z
    .string()
    .nullable()
    .describe(
      "The game's price, if available (e.g., '$19.99', 'Free to Play')."
    ),
  officialWebsiteUrl: z
    .string()
    .nullable()
    .describe("The official website URL specifically for the game."),
  steamStoreUrl: z
    .string()
    .nullable()
    .describe("URL of the game's Steam store page."),
  otherStoreUrls: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .nullable()
    .describe(
      "URLs for other store pages (e.g., Epic Games Store, GOG, itch.io, console stores)."
    ),
  trailerVideoUrl: z
    .string()
    .nullable()
    .describe("URL of the main official trailer video (e.g., YouTube, Vimeo)."),
  screenshotUrls: z
    .array(z.string())
    .nullable()
    .describe("List of URLs for game screenshots."),
  keyFeatures: z
    .array(z.string())
    .nullable()
    .describe("List of key selling points or features of the game."),

  // --- Developer / Team Info ---
  developerName: z
    .string()
    .nullable()
    .describe("The name of the indie developer or studio."),
  developerWebsiteUrl: z
    .string()
    .nullable()
    .describe("Official website URL of the developer/studio."),
  developerLocation: z
    .string()
    .nullable()
    .describe(
      "General location of the developer/studio (e.g., 'Germany', 'Remote')."
    ),
  teamBackground: z
    .string()
    .nullable()
    .describe(
      "Detailed background information about the team, their history, previous projects, founding story etc."
    ),
  teamMembers: z
    .array(TeamMemberSchema)
    .nullable()
    .describe("List of known key team members and their roles."),
  socialMediaLinks: z
    .array(z.object({ platform: z.string(), url: z.string() }))
    .nullable()
    .describe(
      "Links to the developer's/game's official social media profiles (e.g., Twitter, Discord, Facebook, Instagram)."
    ),

  // --- Community & Links ---
  pressKitUrl: z
    .string()
    .nullable()
    .describe("URL for the official press kit, if available."),
  discordInviteUrl: z
    .string()
    .nullable()
    .describe("URL for the official Discord community server invite."),
  subredditUrl: z
    .string()
    .nullable()
    .describe("URL for the game's subreddit, if available."),
  otherCommunityLinks: z
    .array(z.object({ name: z.string(), url: z.string() }))
    .nullable()
    .describe("Links to other relevant community hubs (forums, wikis, etc.)."),

  // --- Funding ---
  fundingStatus: z
    .string()
    .nullable()
    .describe(
      "Information about funding (e.g., 'Self-funded', 'Kickstarter Funded', 'Seeking Funding')."
    ),
  fundingPageUrl: z
    .string()
    .nullable()
    .describe(
      "URL of the Kickstarter, Patreon, or other funding page, if applicable."
    ),

  // --- Synthesis & Original Data ---
  tweetSummary: z
    .string()
    .describe(
      "A brief summary of the original tweet's content provided as input."
    ), // Keeping this non-nullable as it's direct input processing
  initialWebSearchSummary: z
    .string()
    .nullable()
    .describe(
      "A summary of the findings from the initial AI web search phase."
    ), // Renamed for clarity
  scrapedSteamDescription: z
    .string()
    .nullable()
    .describe(
      "Raw description text scraped directly from the Steam page, if available."
    ), // Renamed
  scrapedSteamTags: z
    .string()
    .nullable()
    .describe(
      "Comma-separated raw tags scraped directly from the Steam page, if available."
    ), // Renamed
  overallSummary: z
    .string()
    .nullable()
    .describe(
      "A final synthesized summary combining all gathered information."
    ),
});

// Type alias for convenience
export type GameLandingPageData = z.infer<typeof GameLandingPageSchema>;
