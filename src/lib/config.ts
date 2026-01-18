/**
 * Centralized configuration constants
 *
 * All magic numbers and timing values should be defined here
 * to make the codebase easier to tune and maintain.
 */

// =============================================================================
// API & Rate Limiting
// =============================================================================

export const API_CONFIG = {
  /** Maximum app IDs per batch request */
  BATCH_MAX_APPIDS: 60,

  /** Minimum search query length */
  SEARCH_MIN_LENGTH: 2,

  /** Maximum search results from database */
  SEARCH_DB_LIMIT: 10,

  /** Maximum search results from Steam */
  SEARCH_STEAM_LIMIT: 10,
} as const;

export const RATE_LIMIT_CONFIG = {
  /** Minimum delay between Steam API requests (ms) */
  STEAM_API_DELAY_MS: 2000,

  /** Maximum retries for rate limit polling */
  MAX_RATE_LIMIT_RETRIES: 30,

  /** Polling interval for rate limit checks (ms) */
  RATE_LIMIT_POLL_INTERVAL_MS: 100,
} as const;

// =============================================================================
// Retry & Backoff
// =============================================================================

export const RETRY_CONFIG = {
  /** Default max retry attempts */
  DEFAULT_MAX_ATTEMPTS: 3,

  /** Default initial delay between retries (ms) */
  DEFAULT_INITIAL_DELAY_MS: 1000,

  /** Default max delay between retries (ms) */
  DEFAULT_MAX_DELAY_MS: 10000,

  /** Default backoff multiplier */
  DEFAULT_BACKOFF_MULTIPLIER: 2,

  /** Steam API specific: max attempts */
  STEAM_MAX_ATTEMPTS: 5,

  /** Steam API specific: initial delay (ms) */
  STEAM_INITIAL_DELAY_MS: 3000,

  /** Steam API specific: max delay (ms) */
  STEAM_MAX_DELAY_MS: 30000,

  /** Perplexity API specific: max attempts */
  PERPLEXITY_MAX_ATTEMPTS: 2,

  /** Perplexity API specific: initial delay (ms) */
  PERPLEXITY_INITIAL_DELAY_MS: 1000,
} as const;

// =============================================================================
// Ingestion & Embeddings
// =============================================================================

export const INGEST_CONFIG = {
  /** Max wait time for concurrent ingestion (attempts) */
  INGESTION_WAIT_MAX_ATTEMPTS: 10,

  /** Delay between ingestion wait checks (ms) */
  INGESTION_WAIT_DELAY_MS: 1000,

  /** Lock expiry time for distributed locks (seconds) */
  LOCK_EXPIRY_SECONDS: 60,
} as const;

export const EMBEDDING_CONFIG = {
  /** Delay between games when batch processing (ms) */
  BATCH_DELAY_MS: 1000,

  /** Delay between image embeddings (ms) */
  IMAGE_DELAY_MS: 500,

  /** Default similarity threshold for search */
  DEFAULT_SIMILARITY_THRESHOLD: 0.5,

  /** Default number of similar games to return */
  DEFAULT_SIMILAR_COUNT: 12,
} as const;

// =============================================================================
// SSE Streaming
// =============================================================================

export const SSE_CONFIG = {
  /** Polling interval for SSE updates (ms) */
  POLL_INTERVAL_MS: 2000,

  /** Max consecutive polls without change before timeout */
  MAX_NO_CHANGE_POLLS: 30,
} as const;

// =============================================================================
// Client-Side UI
// =============================================================================

export const UI_CONFIG = {
  /** Delay before showing "slow loading" notice (ms) */
  SLOW_NOTICE_DELAY_MS: 3500,

  /** Number of similar games to prefetch */
  PREFETCH_SIMILAR_COUNT: 3,

  /** Max auto-ingest attempts client-side */
  CLIENT_MAX_AUTO_INGEST: 6,

  /** Delay between batch fetch retries for missing games (ms) */
  BATCH_FETCH_RETRY_DELAY_MS: 3000,

  /** Max batch fetch retry attempts per game */
  BATCH_FETCH_MAX_RETRIES: 10,
} as const;

// =============================================================================
// Client-Side Polling (GameProcessingState)
// =============================================================================

export const PROCESSING_POLL_CONFIG = {
  /** Polling interval for checking if game is ready (ms) */
  POLL_INTERVAL_MS: 2000,

  /** Maximum poll attempts before giving up (60 * 2s = 2 minutes) */
  MAX_POLL_ATTEMPTS: 60,

  /** Retry delays for ingestion triggers (ms) - immediate, then 10s, 30s, 60s */
  RETRY_DELAYS_MS: [0, 10000, 30000, 60000],
} as const;

// =============================================================================
// Game Page
// =============================================================================

export const GAME_PAGE_CONFIG = {
  /** Max attempts to wait for game in DB */
  WAIT_FOR_GAME_MAX_ATTEMPTS: 15,

  /** Delay between game DB checks (ms) */
  WAIT_FOR_GAME_DELAY_MS: 1000,

  /** Quick check attempts (for fast ingestion race) */
  QUICK_CHECK_ATTEMPTS: 2,

  /** Quick check delay (ms) */
  QUICK_CHECK_DELAY_MS: 500,

  /** ISR revalidation interval (seconds) */
  REVALIDATE_SECONDS: 60,
} as const;

// =============================================================================
// Caching
// =============================================================================

export const CACHE_CONFIG = {
  /** Steam existence check cache TTL (seconds) */
  STEAM_EXISTS_CACHE_TTL: 3600, // 1 hour
} as const;
