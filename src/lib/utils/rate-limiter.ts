/**
 * Global rate limiter using Supabase for cross-process coordination.
 * Ensures minimum delay between requests to external APIs.
 */

import { getSupabaseServerClient } from "../supabase/server";

const DEFAULT_DELAY_MS = 2000; // 2 seconds between requests

/**
 * Acquire a rate limit slot for the given key.
 * First call is immediate; subsequent calls wait to ensure minimum spacing.
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
  const supabase = getSupabaseServerClient();
  const maxRetries = 30; // Max wait time = 30 * 100ms = 3 seconds of polling
  const pollIntervalMs = 100;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const now = new Date();
      
      // First, check if a record exists and when it was last used
      const { data: current, error: fetchError } = await supabase
        .from("rate_limits")
        .select("last_request_at")
        .eq("key", key)
        .maybeSingle();

      if (fetchError) {
        console.error("[RATE LIMITER] Database error:", fetchError.message);
        await sleep(pollIntervalMs);
        continue;
      }

      // No record exists = first call ever, proceed immediately
      if (!current) {
        const { error: upsertError } = await supabase
          .from("rate_limits")
          .upsert({ key, last_request_at: now.toISOString() }, { onConflict: "key" });
        
        if (!upsertError) {
          return; // First call, proceed immediately
        }
        // Race condition: another process created it, continue to check timing
        await sleep(pollIntervalMs);
        continue;
      }

      // Record exists - check if enough time has passed
      const lastRequest = new Date(current.last_request_at).getTime();
      const elapsed = now.getTime() - lastRequest;

      if (elapsed >= minDelayMs) {
        // Enough time has passed, try to atomically update
        const minTime = new Date(now.getTime() - minDelayMs);
        const { data, error: updateError } = await supabase
          .from("rate_limits")
          .update({ last_request_at: now.toISOString() })
          .eq("key", key)
          .lt("last_request_at", minTime.toISOString())
          .select()
          .maybeSingle();

        if (updateError) {
          console.error("[RATE LIMITER] Update error:", updateError.message);
          await sleep(pollIntervalMs);
          continue;
        }

        if (data) {
          // Successfully acquired the slot
          return;
        }
        // Race condition - another process took the slot, check again
        await sleep(pollIntervalMs);
        continue;
      }

      // Not enough time has passed, wait for the remainder
      const remainingWait = minDelayMs - elapsed;
      await sleep(Math.min(remainingWait + 50, minDelayMs));
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
