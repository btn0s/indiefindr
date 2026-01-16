#!/usr/bin/env tsx

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { suggestGamesVibe } from "../src/lib/suggest";

// Local dev convenience: load env vars from disk so you can run:
// `pnpm worker:suggestions` (no manual `source .env.local` needed).
//
// In production, these files usually don't exist and platform env vars are used.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const POLL_INTERVAL_MS = 2000;
const MAX_CONCURRENT_JOBS = 1;

async function processJob(job: { id: string; source_appid: number }) {
  const { id, source_appid } = job;

  console.log(`[WORKER] Processing job ${id} for appid ${source_appid}`);

  try {
    // Update status to running
    const { error: updateError } = await supabase
      .from("suggestion_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }

    // Fetch game data
    const { data: game, error: gameError } = await supabase
      .from("games_new")
      .select("title, short_description, developers")
      .eq("appid", source_appid)
      .single();

    if (gameError || !game) {
      throw new Error("Game not found");
    }

    // Generate suggestions
    const result = await suggestGamesVibe(
      source_appid,
      game.title,
      game.short_description || undefined,
      game.developers || undefined,
      10
    );

    if (result.suggestions.length === 0) {
      throw new Error("No suggestions generated");
    }

    // Filter verified suggestions
    const verifiedSuggestions = result.suggestions.filter((s) => s.appId && s.appId > 0);

    if (verifiedSuggestions.length === 0) {
      throw new Error("No verified suggestions generated");
    }

    // Delete existing suggestions and insert new ones
    const { error: deleteError } = await supabase
      .from("game_suggestions")
      .delete()
      .eq("source_appid", source_appid);

    if (deleteError) {
      throw new Error(`Failed to delete existing suggestions: ${deleteError.message}`);
    }

    const rows = verifiedSuggestions.map((s) => ({
      source_appid,
      suggested_appid: s.appId,
      reason: s.explanation,
    }));

    const { error: insertError } = await supabase.from("game_suggestions").insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert suggestions: ${insertError.message}`);
    }

    // Mark job as succeeded
    await supabase
      .from("suggestion_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", id);

    console.log(`[WORKER] Job ${id} completed successfully with ${verifiedSuggestions.length} suggestions`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[WORKER] Job ${id} failed:`, errorMessage);

    // Mark job as failed
    await supabase
      .from("suggestion_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: errorMessage,
      })
      .eq("id", id);
  }
}

async function claimJob(): Promise<{ id: string; source_appid: number } | null> {
  // Use a transaction-like pattern: select and update atomically
  // Since Supabase doesn't support FOR UPDATE SKIP LOCKED directly,
  // we'll use a two-step process with a unique constraint

  // Find a queued job
  const { data: jobs } = await supabase
    .from("suggestion_jobs")
    .select("id, source_appid")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const job = jobs[0];

  // Try to claim it by updating status to running
  // If another worker already claimed it, this will fail gracefully
  const { data: updated, error } = await supabase
    .from("suggestion_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "queued")
    .select()
    .single();

  if (error || !updated) {
    // Job was already claimed by another worker
    return null;
  }

  return { id: job.id, source_appid: job.source_appid };
}

async function runWorker() {
  console.log("[WORKER] Starting suggestions worker...");
  console.log(`[WORKER] Polling every ${POLL_INTERVAL_MS}ms`);

  let processing = false;

  const poll = async () => {
    if (processing) {
      return;
    }

    try {
      const job = await claimJob();
      if (job) {
        processing = true;
        await processJob(job);
        processing = false;
      }
    } catch (error) {
      console.error("[WORKER] Error in poll cycle:", error);
      processing = false;
    }
  };

  // Poll immediately, then on interval
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[WORKER] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[WORKER] Shutting down...");
  process.exit(0);
});

runWorker().catch((error) => {
  console.error("[WORKER] Fatal error:", error);
  process.exit(1);
});
