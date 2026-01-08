/**
 * Zod schemas for API route validation
 */
import { z } from "zod";

// =============================================================================
// Common Schemas
// =============================================================================

export const AppIdSchema = z.coerce.number().int().positive();

export const SteamUrlSchema = z
  .string()
  .min(1, "Steam URL is required")
  .refine(
    (url) => {
      // Accept either a URL or a plain app ID
      const urlPattern = /store\.steampowered\.com\/app\/\d+/i;
      const appIdPattern = /^\d+$/;
      return urlPattern.test(url) || appIdPattern.test(url);
    },
    { message: "Invalid Steam URL or app ID" }
  );

// =============================================================================
// API Route Schemas
// =============================================================================

/**
 * POST /api/games/submit
 */
export const SubmitGameSchema = z.object({
  steamUrl: SteamUrlSchema,
  skipSuggestions: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});
export type SubmitGameInput = z.infer<typeof SubmitGameSchema>;

/**
 * POST /api/games/batch
 */
export const BatchGamesSchema = z.object({
  appids: z
    .array(z.union([z.number(), z.string()]))
    .min(1, "At least one app ID is required")
    .max(100, "Maximum 100 app IDs per request")
    .transform((ids) =>
      ids
        .map((id) => (typeof id === "number" ? id : parseInt(String(id), 10)))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
});
export type BatchGamesInput = z.infer<typeof BatchGamesSchema>;

/**
 * GET /api/games/search?q=...
 */
export const SearchGamesSchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
});
export type SearchGamesInput = z.infer<typeof SearchGamesSchema>;

/**
 * POST /api/games/[appid]/suggestions/refresh
 */
export const RefreshSuggestionsSchema = z.object({
  force: z.boolean().optional().default(false),
});
export type RefreshSuggestionsInput = z.infer<typeof RefreshSuggestionsSchema>;

// =============================================================================
// Steam API Response Schemas (for runtime validation)
// =============================================================================

export const SteamScreenshotSchema = z.object({
  path_full: z.string().optional(),
  path_thumbnail: z.string().optional(),
});

export const SteamMovieSchema = z.object({
  id: z.number(),
  highlight: z.boolean().optional(),
  hls_h264: z.string().optional(),
  dash_h264: z.string().optional(),
  dash_av1: z.string().optional(),
  mp4: z
    .object({
      max: z.string().optional(),
      "480": z.string().optional(),
    })
    .optional(),
  webm: z
    .object({
      max: z.string().optional(),
      "480": z.string().optional(),
    })
    .optional(),
});

export const SteamGenreSchema = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string(),
});

export const SteamCategorySchema = z.object({
  id: z.number(),
  description: z.string(),
});

export const SteamPriceOverviewSchema = z.object({
  final_formatted: z.string().optional(),
  final: z.number().optional(),
  currency: z.string().optional(),
});

export const SteamPlatformsSchema = z.object({
  windows: z.boolean().optional(),
  mac: z.boolean().optional(),
  linux: z.boolean().optional(),
});

export const SteamReleaseDateSchema = z.object({
  coming_soon: z.boolean().optional(),
  date: z.string().optional(),
});

export const SteamMetacriticSchema = z.object({
  score: z.number().optional(),
  url: z.string().optional(),
});

/**
 * Steam API raw game data schema
 * Used to validate the `raw` field stored in Supabase
 */
export const SteamRawGameDataSchema = z.object({
  steam_appid: z.number().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  header_image: z.string().optional(),
  short_description: z.string().optional(),
  detailed_description: z.string().optional(),
  screenshots: z.array(SteamScreenshotSchema).optional(),
  movies: z.array(SteamMovieSchema).optional(),
  genres: z.array(SteamGenreSchema).optional(),
  categories: z.array(SteamCategorySchema).optional(),
  developers: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  price_overview: SteamPriceOverviewSchema.optional(),
  platforms: SteamPlatformsSchema.optional(),
  release_date: SteamReleaseDateSchema.optional(),
  metacritic: SteamMetacriticSchema.optional(),
});
export type SteamRawGameData = z.infer<typeof SteamRawGameDataSchema>;

/**
 * Safely parse Steam raw data with fallback
 */
export function parseSteamRawData(raw: unknown): SteamRawGameData | null {
  const result = SteamRawGameDataSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  console.warn("[SCHEMA] Failed to parse Steam raw data:", result.error.message);
  return null;
}
