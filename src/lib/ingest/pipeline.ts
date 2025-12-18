import { fetchSteamGameData } from '../steam/providers';
import { parseSteamUrl } from '../steam/parser';
import { extractGameFacets } from '../ai/facet-extractor';
import {
  searchGameAesthetic,
  searchGameGameplay,
  searchGameNarrative,
} from "../ai/perplexity";
import { buildFacetDocs } from '../facets/buildFacetDocs';
import { embed, EMBEDDING_MODEL, VISION_MODEL } from '../ai/gateway';
import { supabase } from '../supabase/server';
import type { Game } from '../supabase/types';
import { retry } from '../utils/retry';

export type IngestResult = {
  success: boolean;
  gameId?: number;
  error?: string;
};

/**
 * Main ingestion pipeline
 * 1. Parse Steam URL
 * 2. Fetch Steam data
 * 3. Extract facets using vision model
 * 4. Generate embeddings for each facet
 * 5. Upsert into games table
 */
export async function ingestGame(steamUrl: string): Promise<IngestResult> {
  console.log("\n========================================");
  console.log("[PIPELINE] Starting ingest");
  console.log("[PIPELINE] Steam URL:", steamUrl);
  
  const appId = parseSteamUrl(steamUrl);
  console.log("[PIPELINE] Parsed appId:", appId);
  
  if (!appId) {
    console.log("[PIPELINE] ERROR: Invalid Steam URL");
    return {
      success: false,
      error: `Invalid Steam URL: ${steamUrl}`,
    };
  }
  
  // Create or update ingest job
  const { data: job, error: jobError } = await supabase
    .from('ingest_jobs')
    .insert({
      steam_url: steamUrl,
      steam_appid: appId,
      status: 'running',
    })
    .select()
    .single();
  
  if (jobError && !jobError.message.includes('duplicate')) {
    // Try to get existing job
    const { data: existingJob } = await supabase
      .from('ingest_jobs')
      .select()
      .eq('steam_appid', appId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!existingJob) {
      return {
        success: false,
        error: `Failed to create ingest job: ${jobError.message}`,
      };
    }
    
    // Update existing job
    await supabase
      .from('ingest_jobs')
      .update({ status: 'running', error: null })
      .eq('id', existingJob.id);
  }
  
  try {
    // Step 1: Fetch Steam data
    console.log("\n[PIPELINE] Step 1: Fetching Steam data...");
    const { storeData, reviewSummary, tags } = await fetchSteamGameData(
      steamUrl
    );

    console.log("[PIPELINE] Steam data received:");
    console.log("[PIPELINE]   name:", storeData.name);
    console.log(
      "[PIPELINE]   description:",
      storeData.description?.substring(0, 200) + "..."
    );
    console.log("[PIPELINE]   header_image:", storeData.header_image);
    console.log(
      "[PIPELINE]   screenshots:",
      JSON.stringify(storeData.screenshots, null, 2)
    );
    console.log(
      "[PIPELINE]   videos:",
      JSON.stringify(storeData.videos, null, 2)
    );
    console.log("[PIPELINE]   store tags:", JSON.stringify(storeData.tags, null, 2));
    console.log("[PIPELINE]   reviewSummary:", reviewSummary);
    console.log("[PIPELINE]   tags (weighted):", JSON.stringify(tags, null, 2));

    // Step 2: Extract facets using vision model + web search for aesthetics
    if (!storeData.screenshots || storeData.screenshots.length === 0) {
      throw new Error("No screenshots available for vision analysis");
    }

    // Extract Steam tags for context - pass to model so it uses exact industry terms
    const steamTags = Object.keys(tags);
    console.log("[PIPELINE]   steamTags for vision:", steamTags);

    // Run vision extraction and web searches for all facets in parallel
    console.log(
      "\n[PIPELINE] Step 2: Running vision extraction + web searches for all facets in parallel..."
    );
    const [facets, webAesthetic, webGameplay, webNarrative] = await Promise.all([
      extractGameFacets(
        storeData.name,
        storeData.description,
        storeData.screenshots,
        steamTags,
        VISION_MODEL
      ),
      searchGameAesthetic(storeData.name),
      searchGameGameplay(storeData.name),
      searchGameNarrative(storeData.name),
    ]);

    console.log("\n[PIPELINE] Vision facets received:");
    console.log(
      "[PIPELINE]   aesthetics:",
      JSON.stringify(facets.aesthetics, null, 2)
    );
    console.log(
      "[PIPELINE]   gameplay:",
      JSON.stringify(facets.gameplay, null, 2)
    );
    console.log(
      "[PIPELINE]   narrativeMood:",
      JSON.stringify(facets.narrativeMood, null, 2)
    );

    console.log("\n[PIPELINE] Web facets received:");
    console.log(
      "[PIPELINE]   webAesthetic:",
      webAesthetic?.description || "null"
    );
    console.log(
      "[PIPELINE]   webGameplay:",
      webGameplay?.description || "null"
    );
    console.log(
      "[PIPELINE]   webNarrative:",
      webNarrative?.description || "null"
    );

    // Build facet documents - use Perplexity results for all facets
    console.log("\n[PIPELINE] Step 3: Building facet documents...");
    const facetDocs = buildFacetDocs(storeData, tags, facets, {
      aesthetic: webAesthetic,
      gameplay: webGameplay,
      narrative: webNarrative,
    });

    console.log("\n[PIPELINE] Facet documents built:");
    console.log("[PIPELINE]   aesthetic text:\n", facetDocs.aesthetic);
    console.log("\n[PIPELINE]   gameplay text:\n", facetDocs.gameplay);
    console.log("\n[PIPELINE]   narrative text:\n", facetDocs.narrative);

    // Step 4: Generate embeddings for each facet with retries
    console.log("\n[PIPELINE] Step 4: Generating embeddings...");
    console.log("[PIPELINE]   model:", EMBEDDING_MODEL);
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

    console.log("[PIPELINE] Embeddings generated:");
    console.log(
      "[PIPELINE]   aesthetic embedding length:",
      aestheticEmbedding.length
    );
    console.log(
      "[PIPELINE]   gameplay embedding length:",
      gameplayEmbedding.length
    );
    console.log(
      "[PIPELINE]   narrative embedding length:",
      narrativeEmbedding.length
    );

    // Step 5: Upsert into games table
    console.log("\n[PIPELINE] Step 5: Upserting to database...");
    const gameData: Omit<Game, 'created_at' | 'updated_at'> = {
      id: appId,
      name: storeData.name,
      description: storeData.description,
      header_image: storeData.header_image,
      screenshots: storeData.screenshots,
      videos: storeData.videos.length > 0 ? storeData.videos : null,
      tags,
      review_summary: reviewSummary,
      aesthetic_text: facetDocs.aesthetic,
      gameplay_text: facetDocs.gameplay,
      narrative_text: facetDocs.narrative,
      aesthetic_embedding: aestheticEmbedding,
      gameplay_embedding: gameplayEmbedding,
      narrative_embedding: narrativeEmbedding,
      vision_model: VISION_MODEL,
      embedding_model: EMBEDDING_MODEL,
    };
    
    await retry(
      async () => {
        const { error } = await supabase
          .from('games')
          .upsert(gameData, {
            onConflict: 'id',
          });
        if (error) {
          throw new Error(`Failed to upsert game: ${error.message}`);
        }
      },
      {
        maxAttempts: 3,
        initialDelayMs: 500,
        retryable: (error: any) => {
          // Retry on connection errors and transient database errors
          const errorMessage = error?.message?.toLowerCase() || '';
          const errorCode = error?.code || '';
          return (
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorCode === 'PGRST116' || // Connection error
            errorCode === 'PGRST301' // Service unavailable
          );
        },
      }
    );
    
    // Update ingest job status
    const jobId = job?.id || (await supabase
      .from('ingest_jobs')
      .select('id')
      .eq('steam_appid', appId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()).data?.id;
    
    if (jobId) {
      await supabase
        .from('ingest_jobs')
        .update({ status: 'succeeded' })
        .eq('id', jobId);
    }
    
    console.log("\n[PIPELINE] SUCCESS");
    console.log("[PIPELINE] Game ID:", appId);
    console.log("========================================\n");
    
    return {
      success: true,
      gameId: appId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log("\n[PIPELINE] ERROR:", errorMessage);
    console.log("[PIPELINE] Full error:", error);
    console.log("========================================\n");
    
    // Update ingest job with error
    const jobId = job?.id || (await supabase
      .from('ingest_jobs')
      .select('id')
      .eq('steam_appid', appId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()).data?.id;
    
    if (jobId) {
      await supabase
        .from('ingest_jobs')
        .update({ status: 'failed', error: errorMessage })
        .eq('id', jobId);
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}
