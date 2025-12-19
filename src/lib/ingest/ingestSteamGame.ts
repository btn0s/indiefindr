import { revalidatePath } from "next/cache";
import { supabase } from "../supabase/server";
import {
  fetchSteamGameData,
  SteamStoreProvider,
  SteamReviewsProvider,
  SteamTagsProvider,
} from "../steam/providers";
import { parseSteamUrl } from "../steam/parser";
import { extractGameFacets } from "../ai/facet-extractor";
import {
  searchGameGameplay,
  searchGameNarrative,
} from "../ai/perplexity";
import { extractGameAesthetic } from "../extractors/aesthetic";
import { buildFacetDocs } from "../facets/buildFacetDocs";
import { embed } from "../ai/gateway";
import { retry } from "../utils/retry";

const VISION_MODEL = process.env.AI_MODEL_VISION || "openai/gpt-4o-mini";
const EMBEDDING_MODEL =
  process.env.AI_MODEL_EMBEDDING || "openai/text-embedding-3-small";

export interface IngestResult {
  gameId: number;
  jobId: string;
}

export interface IngestError {
  jobId: string;
  error: string;
}

/**
 * Quick ingest: fetch and save basic Steam data immediately (without embeddings)
 * This allows instant navigation to the detail page while processing continues in background
 */
export async function quickIngestSteamGame(
  steamUrl: string
): Promise<{ gameId: number } | { error: string }> {
  // Parse app ID
  const appId = parseSteamUrl(steamUrl);
  if (!appId) {
    return { error: `Invalid Steam URL: ${steamUrl}` };
  }

  try {
    // Fetch Steam data using the unified provider
    const { storeData, tags } = await fetchSteamGameData(steamUrl);

    // Upsert game with only basic data (no embeddings, no facets yet)
    await retry(
      async () => {
        const { error } = await supabase.from("games").upsert(
          {
            id: appId,
            name: storeData.name,
            description: storeData.description,
            header_image: storeData.header_image,
            screenshots: storeData.screenshots,
            videos: storeData.videos.length > 0 ? storeData.videos : null,
            tags, // Community tags with vote counts from steam-user
            // Leave embeddings, facet texts, and models as null for now
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );
        if (error) {
          throw new Error(`Failed to upsert game: ${error.message}`);
        }
      },
      {
        maxAttempts: 3,
        initialDelayMs: 500,
        retryable: (error: any) => {
          const errorMessage = error?.message?.toLowerCase() || "";
          const errorCode = error?.code || "";
          return (
            errorMessage.includes("connection") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("network") ||
            errorCode === "PGRST116" ||
            errorCode === "PGRST301"
          );
        },
      }
    );

    return { gameId: appId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { error: errorMessage };
  }
}

/**
 * Complete ingestion: extract facets, generate embeddings, and update game record
 * This should be called after quickIngestSteamGame to finish processing
 */
async function completeIngestion(appId: number, jobId: string): Promise<void> {
  console.log("\n========================================");
  console.log("[INGEST] Starting complete ingestion for appId:", appId);

  try {
    // Fetch Steam data using the individual providers
    const storeProvider = new SteamStoreProvider();
    const reviewsProvider = new SteamReviewsProvider();
    const tagsProvider = new SteamTagsProvider();

    const [storeData, reviewSummary, communityTags] = await Promise.all([
      storeProvider.fetchGameDetails(appId),
      reviewsProvider.fetchReviewSummary(appId),
      tagsProvider.fetchTags(appId),
    ]);

    console.log("[INGEST] Game data fetched:", storeData.name);
    console.log("[INGEST] Community tags:", Object.keys(communityTags).length, "tags");

    // Get tag names for vision model context (sorted by vote count)
    const steamTagNames = Object.entries(communityTags)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);

    console.log(
      "[INGEST] Running vision aesthetic extraction + web searches for gameplay/narrative in parallel..."
    );

    const [visionFacets, visionAesthetic, webGameplay, webNarrative] =
      await Promise.all([
        extractGameFacets(
          storeData.name,
          storeData.description,
          storeData.screenshots,
          steamTagNames,
          VISION_MODEL
        ),
        extractGameAesthetic(storeData.name, storeData.screenshots),
        searchGameGameplay(storeData.name),
        searchGameNarrative(storeData.name),
      ]);

    console.log("[INGEST] Vision facets received");
    console.log("[INGEST] Vision aesthetic:", visionAesthetic?.description || "null");
    console.log("[INGEST] Web gameplay:", webGameplay?.description || "null");
    console.log("[INGEST] Web narrative:", webNarrative?.description || "null");

    // Build facet documents - use vision for aesthetic, Perplexity for gameplay/narrative
    const facetDocs = buildFacetDocs(storeData, communityTags, visionFacets, {
      aesthetic: visionAesthetic,
      gameplay: webGameplay,
      narrative: webNarrative,
    });

    console.log("[INGEST] Generating embeddings...");
    // Generate embeddings for all three facets with retries
    // Skip embedding generation for empty documents (embedding API requires non-empty input)
    const [aestheticEmbedding, gameplayEmbedding, narrativeEmbedding] =
      await Promise.all([
        facetDocs.aesthetic.trim()
          ? retry(
              () => embed({ model: EMBEDDING_MODEL, value: facetDocs.aesthetic }),
              {
                maxAttempts: 3,
                initialDelayMs: 1000,
                retryable: (error: any) => {
                  const errorMessage = error?.message?.toLowerCase() || "";
                  const status = error?.status || error?.response?.status;
                  return (
                    status === 429 ||
                    status >= 500 ||
                    errorMessage.includes("rate limit") ||
                    errorMessage.includes("timeout")
                  );
                },
              }
            ).then((r) => r.embedding)
          : Promise.resolve(null),
        facetDocs.gameplay.trim()
          ? retry(
              () => embed({ model: EMBEDDING_MODEL, value: facetDocs.gameplay }),
              {
                maxAttempts: 3,
                initialDelayMs: 1000,
                retryable: (error: any) => {
                  const errorMessage = error?.message?.toLowerCase() || "";
                  const status = error?.status || error?.response?.status;
                  return (
                    status === 429 ||
                    status >= 500 ||
                    errorMessage.includes("rate limit") ||
                    errorMessage.includes("timeout")
                  );
                },
              }
            ).then((r) => r.embedding)
          : Promise.resolve(null),
        facetDocs.narrative.trim()
          ? retry(
              () => embed({ model: EMBEDDING_MODEL, value: facetDocs.narrative }),
              {
                maxAttempts: 3,
                initialDelayMs: 1000,
                retryable: (error: any) => {
                  const errorMessage = error?.message?.toLowerCase() || "";
                  const status = error?.status || error?.response?.status;
                  return (
                    status === 429 ||
                    status >= 500 ||
                    errorMessage.includes("rate limit") ||
                    errorMessage.includes("timeout")
                  );
                },
              }
            ).then((r) => r.embedding)
          : Promise.resolve(null),
      ]);

    console.log("[INGEST] Embeddings generated:");
    console.log(
      "[INGEST]   aesthetic:",
      aestheticEmbedding ? `${aestheticEmbedding.length} dimensions` : "skipped (empty)"
    );
    console.log(
      "[INGEST]   gameplay:",
      gameplayEmbedding ? `${gameplayEmbedding.length} dimensions` : "skipped (empty)"
    );
    console.log(
      "[INGEST]   narrative:",
      narrativeEmbedding ? `${narrativeEmbedding.length} dimensions` : "skipped (empty)"
    );

    console.log("[INGEST] Updating database...");
    // Update game with embeddings, facet texts, and community tags
    await retry(
      async () => {
        const updateData: Record<string, any> = {
          tags: communityTags, // Update with full community tags
          review_summary: reviewSummary,
          aesthetic_text: facetDocs.aesthetic || null,
          gameplay_text: facetDocs.gameplay || null,
          narrative_text: facetDocs.narrative || null,
          vision_model: VISION_MODEL,
          embedding_model: EMBEDDING_MODEL,
          updated_at: new Date().toISOString(),
        };
        
        // Only include embeddings if they were generated (non-null)
        if (aestheticEmbedding) updateData.aesthetic_embedding = aestheticEmbedding;
        if (gameplayEmbedding) updateData.gameplay_embedding = gameplayEmbedding;
        if (narrativeEmbedding) updateData.narrative_embedding = narrativeEmbedding;

        const { error } = await supabase
          .from("games")
          .update(updateData)
          .eq("id", appId);
        if (error) {
          throw new Error(`Failed to update game: ${error.message}`);
        }
      },
      {
        maxAttempts: 3,
        initialDelayMs: 500,
        retryable: (error: any) => {
          const errorMessage = error?.message?.toLowerCase() || "";
          const errorCode = error?.code || "";
          return (
            errorMessage.includes("connection") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("network") ||
            errorCode === "PGRST116" ||
            errorCode === "PGRST301"
          );
        },
      }
    );

    // Update job status
    await supabase
      .from("ingest_jobs")
      .update({
        status: "succeeded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log("[INGEST] SUCCESS for appId:", appId);
    console.log("========================================\n");

    // Revalidate the game detail page so Next.js cache is invalidated
    try {
      revalidatePath(`/games/${appId}`);
    } catch {
      // revalidatePath might not work outside request context
      console.log("Note: revalidatePath called outside request context");
    }
  } catch (error) {
    console.log("[INGEST] ERROR for appId:", appId);
    console.log("[INGEST] Error:", error);
    console.log("========================================\n");
    // Update job with error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("ingest_jobs")
      .update({
        status: "failed",
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw error;
  }
}

/**
 * Ingest a Steam game: fetch data, extract facets, generate embeddings, and store
 * This is the full ingestion pipeline (for backward compatibility)
 */
export async function ingestSteamGame(
  steamUrl: string
): Promise<IngestResult | IngestError> {
  // Parse app ID
  const appId = parseSteamUrl(steamUrl);
  if (!appId) {
    throw new Error(`Invalid Steam URL: ${steamUrl}`);
  }

  // Create ingest job
  const { data: job, error: jobError } = await supabase
    .from("ingest_jobs")
    .insert({
      steam_url: steamUrl,
      steam_appid: appId,
      status: "running",
    })
    .select()
    .single();

  if (jobError || !job) {
    throw new Error(`Failed to create ingest job: ${jobError?.message}`);
  }

  const jobId = job.id;

  try {
    // First do quick ingest to save basic data
    const quickResult = await quickIngestSteamGame(steamUrl);
    if ("error" in quickResult) {
      throw new Error(quickResult.error);
    }

    // Then complete the ingestion (facets + embeddings) in background
    // Don't await - let it run asynchronously
    completeIngestion(appId, jobId).catch((err) => {
      console.error(`Background ingestion failed for ${appId}:`, err);
    });

    // Return immediately with gameId so user can navigate
    return {
      gameId: appId,
      jobId,
    };
  } catch (error) {
    // Update job with error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("ingest_jobs")
      .update({
        status: "failed",
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      jobId,
      error: errorMessage,
    };
  }
}
