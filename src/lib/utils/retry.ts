/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryable: (error: unknown) => {
    const err = error as {
      message?: string;
      status?: number;
      response?: { status?: number };
    };
    // Retry on network errors, 5xx errors, and rate limits
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true; // Network error
    }
    if (err?.response?.status) {
      const status = err.response.status;
      return status >= 500 || status === 429; // Server error or rate limit
    }
    if (err?.status) {
      return err.status >= 500 || err.status === 429;
    }
    // Retry on common error messages
    const errorMessage = err?.message?.toLowerCase() || "";
    return (
      errorMessage.includes("timeout") ||
      errorMessage.includes("network") ||
      errorMessage.includes("econnreset") ||
      errorMessage.includes("etimedout") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    );
  },
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!opts.retryable(error)) {
        throw error;
      }

      if (attempt < opts.maxAttempts) {
        const currentDelay = Math.min(delay, opts.maxDelayMs);
        await sleep(currentDelay);
        delay *= opts.backoffMultiplier;
      }
    }
  }

  throw lastError;
}
