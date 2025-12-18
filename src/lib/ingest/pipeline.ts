import { parseSteamUrl, fetchSteamGameData } from '../steam/providers';
import { extractGameFacets } from '../ai/facet-extractor';
import { buildFacetDocs } from '../facets/buildFacetDocs';
import { embed, EMBEDDING_MODEL, VISION_MODEL } from '../ai/gateway';
import { supabase } from '../supabase/server';
import type { Game } from '../supabase/types';

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
  const appId = parseSteamUrl(steamUrl);
  
  if (!appId) {
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
    const { storeData, reviewSummary, tags } = await fetchSteamGameData(steamUrl);
    
    // Step 2: Extract facets using vision model
    if (!storeData.screenshots || storeData.screenshots.length === 0) {
      throw new Error('No screenshots available for vision analysis');
    }
    
    // Extract Steam tags for context - pass to model so it uses exact industry terms
    const steamTags = Object.keys(tags);
    const facets = await extractGameFacets(
      storeData.name,
      storeData.description,
      storeData.screenshots,
      steamTags,
      VISION_MODEL
    );
    
    // Build facet documents (extracts descriptions from structured facets)
    const facetDocs = buildFacetDocs(storeData, facets);
    
    // Step 3: Generate embeddings for each facet
    const [aestheticEmbedding, gameplayEmbedding, narrativeEmbedding] = await Promise.all([
      embed({ model: EMBEDDING_MODEL, value: facetDocs.aesthetic }),
      embed({ model: EMBEDDING_MODEL, value: facetDocs.gameplay }),
      embed({ model: EMBEDDING_MODEL, value: facetDocs.narrative }),
    ]).then(results => results.map(r => r.embedding));
    
    // Step 4: Upsert into games table
    const gameData: Omit<Game, 'created_at' | 'updated_at'> = {
      id: appId,
      name: storeData.name,
      description: storeData.description,
      header_image: storeData.header_image,
      screenshots: storeData.screenshots,
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
    
    const { error: upsertError } = await supabase
      .from('games')
      .upsert(gameData, {
        onConflict: 'id',
      });
    
    if (upsertError) {
      throw new Error(`Failed to upsert game: ${upsertError.message}`);
    }
    
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
    
    return {
      success: true,
      gameId: appId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
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
