/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryable: (error: any) => {
    // Retry on network errors, 5xx errors, and rate limits
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network error
    }
    if (error?.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429; // Server error or rate limit
    }
    if (error?.status) {
      return error.status >= 500 || error.status === 429;
    }
    // Retry on common error messages
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
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
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!opts.retryable(error)) {
        throw error;
      }

      // Don't sleep after last attempt
      if (attempt < opts.maxAttempts) {
        // Calculate delay with exponential backoff
        const currentDelay = Math.min(delay, opts.maxDelayMs);
        await sleep(currentDelay);
        delay *= opts.backoffMultiplier;
      }
    }
  }

  throw lastError;
}
