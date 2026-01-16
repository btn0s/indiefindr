import { fetchSteamGame, searchAppIdByTitle, type SteamGameData } from "./steam";
import { suggestGamesVibe } from "./suggest";
import { getSupabaseServerClient } from "./supabase/server";
import { getSupabaseServiceClient } from "./supabase/service";
import { Suggestion } from "./supabase/types";
import { acquireLock, releaseLock, isLocked } from "./utils/distributed-lock";
import { INGEST_CONFIG } from "./config";

export type IngestResult = {
  steamData: SteamGameData;
  suggestions: { suggestions: Suggestion[] };
};

export async function ingest(
  steamUrl: string,
  skipSuggestions = false,
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

  const lockAcquired = appId
    ? await acquireLock("ingest", appId)
    : { acquired: false };

  try {
    console.log("[INGEST] Fetching Steam data for:", steamUrl);
    const steamData = await fetchSteamGame(steamUrl);

    console.log("[INGEST] Saving to database:", steamData.appid);
    await saveSteamData(steamData);

    if (!skipSuggestions && steamData.screenshots?.length) {
      enqueueSuggestionJob(steamData.appid).catch((err) => {
        console.error("[INGEST] Failed to enqueue suggestion job:", err);
      });
    }

    return { steamData, suggestions: { suggestions: [] } };
  } finally {
    if (lockAcquired.acquired && appId) {
      await releaseLock("ingest", appId);
    }
  }
}

async function enqueueSuggestionJob(appId: number): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.from("suggestion_jobs").upsert(
    {
      source_appid: appId,
      status: "queued",
      error: null,
      started_at: null,
      finished_at: null,
    },
    {
      onConflict: "source_appid",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    throw new Error(`Failed to enqueue suggestion job: ${error.message}`);
  }

  console.log("[INGEST] Enqueued suggestion job for:", appId);
}

export async function clearSuggestions(appId: number): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: null,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appId);

  if (error) {
    throw new Error(`Failed to clear suggestions: ${error.message}`);
  }
}

export async function refreshSuggestions(appId: number): Promise<{
  suggestions: Suggestion[];
  newCount: number;
  missingAppIds: number[];
  missingCount: number;
}> {
  const supabase = await getSupabaseServerClient();
  const { data: gameData, error } = await supabase
    .from("games_new")
    .select("screenshots, title, short_description, long_description, raw, suggested_game_appids")
    .eq("appid", appId)
    .single();

  if (error || !gameData) {
    throw new Error("Game not found");
  }

  if (!gameData.screenshots?.length) {
    throw new Error("No screenshots available");
  }

  console.log("[REFRESH] Generating suggestions for:", gameData.title);

  const developers =
    gameData.raw &&
    typeof gameData.raw === "object" &&
    "developers" in gameData.raw &&
    Array.isArray(gameData.raw.developers)
      ? (gameData.raw.developers as string[])
      : undefined;
  const vibeResult = await suggestGamesVibe(
    appId,
    gameData.title,
    gameData.short_description || undefined,
    developers,
    10
  );

  const existingSuggestions: Suggestion[] = gameData.suggested_game_appids || [];
  const merged = mergeSuggestions(existingSuggestions, vibeResult.suggestions);

  await saveSuggestions(appId, merged);

  const missingAppIds = await findMissingGameIds(merged.map((s) => s.appId));

  return {
    suggestions: merged,
    newCount: vibeResult.suggestions.length,
    missingAppIds,
    missingCount: missingAppIds.length,
  };
}

export async function findMissingGameIds(appIds: number[]): Promise<number[]> {
  const supabase = await getSupabaseServerClient();
  if (!appIds.length) return [];

  const { data: existing } = await supabase
    .from("games_new")
    .select("appid")
    .in("appid", appIds);

  const existingSet = new Set((existing || []).map((g) => g.appid));
  return appIds.filter((id) => !existingSet.has(id));
}

export async function autoIngestMissingGames(appIds: number[]): Promise<void> {
  const missingIds = await findMissingGameIds(appIds);
  if (!missingIds.length) return;

  const toIngest: number[] = [];
  for (const id of missingIds) {
    if (!(await isLocked("auto_ingest", id))) {
      toIngest.push(id);
    }
  }

  if (!toIngest.length) return;

  console.log(`[AUTO-INGEST] Ingesting ${toIngest.length} missing games...`);

  for (const appId of toIngest) {
    const lockResult = await acquireLock("auto_ingest", appId);
    if (!lockResult.acquired) continue;

    try {
      await ingest(`https://store.steampowered.com/app/${appId}/`, true);
      console.log(`[AUTO-INGEST] Success: ${appId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AUTO-INGEST] Failed: ${appId}`, message);

      if (message.includes("not found") || message.includes("unavailable")) {
        await correctOrRemoveInvalidSuggestion(appId);
      }
    } finally {
      await releaseLock("auto_ingest", appId);
    }
  }

  console.log(`[AUTO-INGEST] Completed ${toIngest.length} games`);
}

async function correctOrRemoveInvalidSuggestion(invalidAppId: number): Promise<void> {
  const supabase = await getSupabaseServerClient();
  try {
    const { data: gamesWithSuggestion } = await supabase
      .from("games_new")
      .select("appid, suggested_game_appids")
      .not("suggested_game_appids", "is", null);

    if (!gamesWithSuggestion) return;

    for (const game of gamesWithSuggestion) {
      const suggestions: Suggestion[] = game.suggested_game_appids || [];
      const invalidSuggestion = suggestions.find((s) => s.appId === invalidAppId);

      if (!invalidSuggestion) continue;

      let correctedId: number | null = null;
      if (invalidSuggestion.title) {
        console.log(`[AUTO-INGEST] Searching for "${invalidSuggestion.title}" to correct ${invalidAppId}`);
        correctedId = await searchAppIdByTitle(invalidSuggestion.title);
      }

      if (correctedId && correctedId !== invalidAppId) {
        console.log(`[AUTO-INGEST] Corrected ${invalidAppId} → ${correctedId} for game ${game.appid}`);
        const corrected = suggestions.map((s) =>
          s.appId === invalidAppId ? { ...s, appId: correctedId! } : s
        );
        await supabase
          .from("games_new")
          .update({ suggested_game_appids: corrected, updated_at: new Date().toISOString() })
          .eq("appid", game.appid);

        try {
          await ingest(`https://store.steampowered.com/app/${correctedId}/`, true);
          console.log(`[AUTO-INGEST] Ingested corrected game ${correctedId}`);
        } catch {
          console.log(`[AUTO-INGEST] Failed to ingest corrected game ${correctedId}`);
        }
      } else {
        console.log(`[AUTO-INGEST] No correction found, removing ${invalidAppId} from game ${game.appid}`);
        const filtered = suggestions.filter((s) => s.appId !== invalidAppId);
        await supabase
          .from("games_new")
          .update({ suggested_game_appids: filtered, updated_at: new Date().toISOString() })
          .eq("appid", game.appid);
      }
    }
  } catch (err) {
    console.error(`[AUTO-INGEST] Failed to correct/remove suggestion ${invalidAppId}:`, err);
  }
}

async function saveSteamData(steamData: SteamGameData): Promise<void> {
  const supabase = await getSupabaseServerClient();
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

async function saveSuggestions(appId: number, suggestions: Suggestion[]): Promise<void> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("games_new")
    .update({
      suggested_game_appids: suggestions,
      updated_at: new Date().toISOString(),
    })
    .eq("appid", appId);

  if (error) {
    throw new Error(`Failed to save suggestions: ${error.message}`);
  }
}

function parseAppId(steamUrl: string): number | null {
  const match = steamUrl.match(/\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : null;
}

function mergeSuggestions(existing: Suggestion[], incoming: Suggestion[]): Suggestion[] {
  const map = new Map<number, Suggestion>();
  for (const s of existing) map.set(s.appId, s);
  for (const s of incoming) map.set(s.appId, s);
  return Array.from(map.values());
}

async function getExistingGame(appId: number): Promise<IngestResult | null> {
  const supabase = await getSupabaseServerClient();
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
    suggestions: {
      suggestions: existing.suggested_game_appids || [],
    },
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
