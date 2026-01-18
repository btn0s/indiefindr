import { fetchSteamGame, type SteamGameData } from "./steam";
import { getSupabaseServerClient } from "./supabase/server";
import { acquireLock, releaseLock, isLocked } from "./utils/distributed-lock";
import { INGEST_CONFIG } from "./config";
import {
  generateAllEmbeddings,
  type GameForEmbedding,
  type EmbeddingInput,
} from "./embeddings";

export type IngestResult = {
  steamData: SteamGameData;
  embeddings: EmbeddingInput[];
};

export async function ingest(
  steamUrl: string,
  skipEmbeddings = false,
  force = false
): Promise<IngestResult> {
  const appId = parseAppId(steamUrl);

  if (appId && !force) {
    const existing = await getExistingGame(appId);
    if (existing) return existing;

    if (await isLocked("ingest", appId)) {
      const result = await waitForIngestion(appId);
      if (result) return result;
    }
  }

  const lockAcquired = appId ? await acquireLock("ingest", appId) : { acquired: false };

  try {
    console.log("[INGEST] Fetching Steam data for:", steamUrl);
    const steamData = await fetchSteamGame(steamUrl);

    console.log("[INGEST] Saving to database:", steamData.appid);
    await saveSteamData(steamData);

    // Generate embeddings in background
    if (!skipEmbeddings && steamData.screenshots?.length) {
      generateEmbeddingsInBackground(steamData).catch((err) => {
        console.error("[INGEST] Background embeddings error:", err);
      });
    }

    return { steamData, embeddings: [] };
  } finally {
    if (lockAcquired.acquired && appId) {
      await releaseLock("ingest", appId);
    }
  }
}

async function generateEmbeddingsInBackground(steamData: SteamGameData): Promise<void> {
  console.log("[INGEST] Generating embeddings in background for:", steamData.title);

  try {
    const game: GameForEmbedding = {
      appid: steamData.appid,
      title: steamData.title,
      header_image: steamData.header_image,
      screenshots: steamData.screenshots || [],
      short_description: steamData.short_description,
      long_description: steamData.long_description,
      steamspy_tags: null, // Will be enriched later
      raw: steamData.raw as GameForEmbedding["raw"],
    };

    const embeddings = await generateAllEmbeddings(game);

    // Save embeddings to database
    await saveEmbeddings(embeddings);

    console.log("[INGEST] Background embeddings complete for:", steamData.appid);
  } catch (err) {
    console.error("[INGEST] Failed to generate embeddings for:", steamData.appid, err);
  }
}

async function saveEmbeddings(embeddings: EmbeddingInput[]): Promise<void> {
  if (embeddings.length === 0) return;

  const supabase = getSupabaseServerClient();

  for (const embedding of embeddings) {
    const { error } = await supabase.from("game_embeddings").upsert(
      {
        appid: embedding.appid,
        facet: embedding.facet,
        embedding: embedding.embedding,
        embedding_model: embedding.embedding_model || "unknown",
        embedding_version: 1,
        source_type: embedding.source_type,
        source_data: embedding.source_data || null,
      },
      { onConflict: "appid,facet" }
    );

    if (error) {
      console.error(`[INGEST] Failed to save ${embedding.facet} embedding:`, error.message);
    }
  }
}

async function saveSteamData(steamData: SteamGameData): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("games_new").upsert(
    {
      appid: steamData.appid,
      screenshots: steamData.screenshots,
      videos: steamData.videos,
      title: steamData.title,
      header_image: steamData.header_image,
      short_description: steamData.short_description,
      long_description: steamData.long_description,
      raw: steamData.raw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "appid" }
  );

  if (error) {
    throw new Error(`Failed to save Steam data: ${error.message}`);
  }
}

function parseAppId(steamUrl: string): number | null {
  const match = steamUrl.match(/\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : null;
}

async function getExistingGame(appId: number): Promise<IngestResult | null> {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("games_new")
    .select("*")
    .eq("appid", appId)
    .maybeSingle();

  if (!existing) return null;

  console.log(`[INGEST] Game ${appId} already exists, returning cached data`);
  const rawType = (existing.raw as { type?: string })?.type || "game";

  return {
    steamData: {
      appid: existing.appid,
      title: existing.title,
      screenshots: existing.screenshots || [],
      videos: existing.videos || [],
      header_image: existing.header_image,
      short_description: existing.short_description,
      long_description: existing.long_description,
      type: rawType,
      raw: existing.raw,
    },
    embeddings: [],
  };
}

async function waitForIngestion(appId: number): Promise<IngestResult | null> {
  console.log(`[INGEST] Game ${appId} is being ingested, waiting...`);

  for (let i = 0; i < INGEST_CONFIG.INGESTION_WAIT_MAX_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, INGEST_CONFIG.INGESTION_WAIT_DELAY_MS));
    const result = await getExistingGame(appId);
    if (result) return result;
  }

  return null;
}
