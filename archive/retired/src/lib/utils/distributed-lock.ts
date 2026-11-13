/**
 * Distributed lock implementation using Supabase
 *
 * Replaces in-memory Sets for cross-process coordination
 * in multi-instance deployments (Vercel, etc.)
 */

import { getSupabaseServerClient } from "../supabase/server";
import { INGEST_CONFIG } from "../config";

export type LockResult = {
  acquired: boolean;
  lockId?: string;
};

/**
 * Attempt to acquire a distributed lock for a resource.
 *
 * @param resourceType - Type of resource (e.g., 'ingest', 'auto_ingest')
 * @param resourceId - Unique identifier for the resource (e.g., app ID)
 * @param expirySeconds - Lock expiry time in seconds (default: 60)
 * @returns Whether the lock was acquired and the lock ID if successful
 */
export async function acquireLock(
  resourceType: string,
  resourceId: string | number,
  expirySeconds: number = INGEST_CONFIG.LOCK_EXPIRY_SECONDS
): Promise<LockResult> {
  const supabase = getSupabaseServerClient();
  const lockKey = `${resourceType}:${resourceId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirySeconds * 1000);

  try {
    // First, clean up any expired locks for this key
    await supabase
      .from("distributed_locks")
      .delete()
      .eq("lock_key", lockKey)
      .lt("expires_at", now.toISOString());

    // Try to insert a new lock (will fail if lock exists due to unique constraint)
    const { data, error } = await supabase
      .from("distributed_locks")
      .insert({
        lock_key: lockKey,
        expires_at: expiresAt.toISOString(),
        acquired_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Lock already exists (unique constraint violation) or other error
      if (error.code === "23505") {
        // Unique violation - lock is held
        return { acquired: false };
      }
      console.error("[LOCK] Failed to acquire lock:", error.message);
      return { acquired: false };
    }

    return { acquired: true, lockId: data.id };
  } catch (err) {
    console.error("[LOCK] Error acquiring lock:", err);
    return { acquired: false };
  }
}

/**
 * Release a distributed lock.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Unique identifier for the resource
 */
export async function releaseLock(
  resourceType: string,
  resourceId: string | number
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const lockKey = `${resourceType}:${resourceId}`;

  try {
    await supabase.from("distributed_locks").delete().eq("lock_key", lockKey);
  } catch (err) {
    console.error("[LOCK] Error releasing lock:", err);
  }
}

/**
 * Check if a lock is currently held (without acquiring).
 *
 * @param resourceType - Type of resource
 * @param resourceId - Unique identifier for the resource
 * @returns Whether the lock is currently held
 */
export async function isLocked(
  resourceType: string,
  resourceId: string | number
): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const lockKey = `${resourceType}:${resourceId}`;
  const now = new Date();

  try {
    const { data } = await supabase
      .from("distributed_locks")
      .select("id")
      .eq("lock_key", lockKey)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    return data !== null;
  } catch (err) {
    console.error("[LOCK] Error checking lock:", err);
    return false;
  }
}

/**
 * Execute a function with a distributed lock.
 * Automatically acquires and releases the lock.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Unique identifier for the resource
 * @param fn - Function to execute while holding the lock
 * @param options - Lock options
 * @returns The result of fn, or null if lock couldn't be acquired
 */
export async function withLock<T>(
  resourceType: string,
  resourceId: string | number,
  fn: () => Promise<T>,
  options: { expirySeconds?: number; waitForLock?: boolean; maxWaitMs?: number } = {}
): Promise<T | null> {
  const { expirySeconds, waitForLock = false, maxWaitMs = 10000 } = options;

  // Try to acquire lock
  let lockResult = await acquireLock(resourceType, resourceId, expirySeconds);

  // If we should wait for the lock and didn't get it
  if (!lockResult.acquired && waitForLock) {
    const startTime = Date.now();
    const pollInterval = 500;

    while (!lockResult.acquired && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      lockResult = await acquireLock(resourceType, resourceId, expirySeconds);
    }
  }

  if (!lockResult.acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(resourceType, resourceId);
  }
}
