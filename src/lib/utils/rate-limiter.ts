/**
 * Global rate limiter using Supabase for cross-process coordination.
 * Ensures minimum delay between requests to external APIs.
 */

import { supabase } from "../supabase/server";

const DEFAULT_DELAY_MS = 2000; // 2 seconds between requests

/**
 * Acquire a rate limit slot for the given key.
 * This will wait until it's safe to make a request, ensuring the minimum delay.
 * 
 * Uses atomic database operations to coordinate across multiple processes.
 * 
 * @param key - Rate limit key (e.g., 'steam_api')
 * @param minDelayMs - Minimum delay between requests in milliseconds
 * @returns Promise that resolves when it's safe to proceed
 */
export async function acquireRateLimit(
  key: string = "steam_api",
  minDelayMs: number = DEFAULT_DELAY_MS
): Promise<void> {
  const maxRetries = 30; // Max wait time = 30 * 100ms = 3 seconds of polling
  const pollIntervalMs = 100;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try to acquire the slot using an atomic update
      // Only update if enough time has passed since last request
      const now = new Date();
      const minTime = new Date(now.getTime() - minDelayMs);

      const { data, error } = await supabase
        .from("rate_limits")
        .update({ last_request_at: now.toISOString() })
        .eq("key", key)
        .lt("last_request_at", minTime.toISOString())
        .select()
        .maybeSingle();

      if (error) {
        console.error("[RATE LIMITER] Database error:", error.message);
        // On DB error, wait and retry
        await sleep(pollIntervalMs);
        continue;
      }

      if (data) {
        // Successfully acquired the slot
        return;
      }

      // Slot not available yet, check how long to wait
      const { data: current } = await supabase
        .from("rate_limits")
        .select("last_request_at")
        .eq("key", key)
        .single();

      if (current) {
        const lastRequest = new Date(current.last_request_at).getTime();
        const elapsed = now.getTime() - lastRequest;
        const remainingWait = Math.max(0, minDelayMs - elapsed);

        if (remainingWait > 0) {
          // Wait for the remaining time plus a small buffer
          await sleep(Math.min(remainingWait + 50, minDelayMs));
        } else {
          // Race condition - another process just took the slot, try again quickly
          await sleep(pollIntervalMs);
        }
      } else {
        // No record found, create one
        await supabase
          .from("rate_limits")
          .upsert({ key, last_request_at: now.toISOString() });
        return;
      }
    } catch (err) {
      console.error("[RATE LIMITER] Error acquiring rate limit:", err);
      await sleep(pollIntervalMs);
    }
  }

  // If we've exhausted retries, proceed anyway but log a warning
  console.warn(`[RATE LIMITER] Timed out waiting for rate limit slot for key: ${key}`);
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
