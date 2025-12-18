import { revalidatePath } from "next/cache";
import { supabase } from "../supabase/server";
import { parseSteamAppId } from "../steam/parseSteamUrl";
import { fetchSteamGameData } from "../steam/providers/steamStoreProvider";
import { fetchSteamReviewSummary } from "../steam/providers/steamReviewsProvider";
import { extractGameFacets } from "../ai/facet-extractor";
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
  const appId = parseSteamAppId(steamUrl);
  if (!appId) {
    return { error: `Invalid Steam URL: ${steamUrl}` };
  }

  try {
    // Fetch only basic Steam store data (fast)
    const gameData = await fetchSteamGameData(appId);

    // Prepare tags as JSONB (tag -> weight, default weight 1.0)
    const tagsJsonb: Record<string, number> = {};
    [...gameData.genres, ...gameData.tags].forEach((tag) => {
      tagsJsonb[tag] = 1.0;
    });

    // Upsert game with only basic data (no embeddings, no facets yet)
    await retry(
      async () => {
        const { error } = await supabase.from("games").upsert(
          {
            id: appId,
            name: gameData.name,
            description: gameData.description,
            header_image: gameData.header_image,
            screenshots: gameData.screenshots,
            videos: gameData.videos.length > 0 ? gameData.videos : null,
            tags: tagsJsonb,
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
  try {
    // Fetch Steam data again (or we could pass it, but this is simpler)
    const gameData = await fetchSteamGameData(appId);
    const reviewSummary = await fetchSteamReviewSummary(appId);

    // Extract facets using vision - pass Steam tags so model uses exact industry terms
    const steamTags = [...gameData.genres, ...gameData.tags];
    const visionFacets = await extractGameFacets(
      gameData.name,
      gameData.description,
      gameData.screenshots,
      steamTags,
      VISION_MODEL
    );

    // Build facet documents
    const facetDocs = buildFacetDocs(gameData, visionFacets);

    // Generate embeddings for all three facets with retries
    const [aestheticEmbedding, gameplayEmbedding, narrativeEmbedding] =
      await Promise.all([
        retry(
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
        ),
        retry(
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
        ),
        retry(
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
        ),
      ]).then((results) => results.map((r) => r.embedding));

    // Update game with embeddings and facet texts
    await retry(
      async () => {
        const { error } = await supabase
          .from("games")
          .update({
            review_summary: reviewSummary,
            aesthetic_text: facetDocs.aesthetic,
            gameplay_text: facetDocs.gameplay,
            narrative_text: facetDocs.narrative,
            aesthetic_embedding: aestheticEmbedding,
            gameplay_embedding: gameplayEmbedding,
            narrative_embedding: narrativeEmbedding,
            vision_model: VISION_MODEL,
            embedding_model: EMBEDDING_MODEL,
            updated_at: new Date().toISOString(),
          })
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

    // Revalidate the game detail page so Next.js cache is invalidated
    try {
      revalidatePath(`/games/${appId}`);
    } catch {
      // revalidatePath might not work outside request context
      console.log("Note: revalidatePath called outside request context");
    }
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
  const appId = parseSteamAppId(steamUrl);
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
