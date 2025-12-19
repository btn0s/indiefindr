export type GameNew = {
  appid: number;
  screenshots: string[];
  videos: string[];
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  raw: unknown; // Raw Steam API response
  suggestions_result_text: string | null;
  suggestions_usage_stats: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  created_at: string;
  updated_at: string;
};

/**
 * Parsed suggestion item from Perplexity suggestions text
 */
export type ParsedSuggestionItem = {
  title: string;
  steamLink: string;
  explanation: string;
  appId?: number;
};
