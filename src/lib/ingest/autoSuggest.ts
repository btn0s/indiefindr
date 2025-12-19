import { generateText } from "ai";
import { supabase } from "../supabase/server";

/**
 * Get community suggestions for a game using Perplexity
 */
async function getSuggestions(gameName: string): Promise<string[]> {
  console.log("[AUTO-SUGGEST] Getting suggestions for:", gameName);
  
  try {
    const result = await generateText({
      model: "perplexity/sonar-pro",
      prompt: `Search Reddit, Steam forums, and gaming communities for what games players recommend as VISUALLY and AESTHETICALLY similar to "${gameName}".

Focus on games that LOOK similar - same art style, graphics fidelity, color palette, mood.

Return exactly 5 specific Steam game titles, one per line. Just the names, no explanations or numbers.`,
    });

    const suggestions = result.text
      .split("\n")
      .map(line => line
        .replace(/^\d+\.\s*/, "")  // Remove numbered list prefixes
        .replace(/\[\d+\]/g, "")    // Remove citation markers like [1], [2]
        .replace(/\*\*/g, "")       // Remove markdown bold
        .trim()
      )
      .filter(line => line.length > 0 && line.length < 100);

    console.log("[AUTO-SUGGEST] Found suggestions:", suggestions);
    return suggestions;
  } catch (error) {
    console.error("[AUTO-SUGGEST] Error getting suggestions:", error);
    return [];
  }
}

/**
 * Search Steam for a game by name and return the app ID
 */
async function searchSteamGame(gameName: string): Promise<number | null> {
  try {
    // Use Steam's search API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&cc=us&l=en`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Return first match
      const appId = data.items[0].id;
      console.log(`[AUTO-SUGGEST] Found Steam ID for "${gameName}": ${appId}`);
      return appId;
    }
    
    console.log(`[AUTO-SUGGEST] No Steam match found for "${gameName}"`);
    return null;
  } catch (error) {
    console.error(`[AUTO-SUGGEST] Error searching Steam for "${gameName}":`, error);
    return null;
  }
}

/**
 * Check if a game already exists in the database
 */
async function gameExists(appId: number): Promise<boolean> {
  const { data } = await supabase
    .from("games")
    .select("id")
    .eq("id", appId)
    .single();
  return !!data;
}

/**
 * Auto-ingest community suggestions for a game.
 * This runs in the background after a game is ingested.
 */
export async function autoIngestSuggestions(
  gameName: string,
  ingestFn: (steamUrl: string) => Promise<any>
): Promise<void> {
  console.log("\n[AUTO-SUGGEST] Starting auto-suggestion ingestion for:", gameName);
  
  try {
    // Get community suggestions
    const suggestions = await getSuggestions(gameName);
    
    if (suggestions.length === 0) {
      console.log("[AUTO-SUGGEST] No suggestions found");
      return;
    }

    // Process each suggestion
    for (const suggestion of suggestions) {
      try {
        // Search for Steam ID
        const appId = await searchSteamGame(suggestion);
        
        if (!appId) {
          console.log(`[AUTO-SUGGEST] Skipping "${suggestion}" - not found on Steam`);
          continue;
        }

        // Check if already in database
        const exists = await gameExists(appId);
        if (exists) {
          console.log(`[AUTO-SUGGEST] Skipping "${suggestion}" (${appId}) - already in database`);
          continue;
        }

        // Ingest the suggested game
        console.log(`[AUTO-SUGGEST] Ingesting "${suggestion}" (${appId})...`);
        const steamUrl = `https://store.steampowered.com/app/${appId}/`;
        
        // Fire and forget - don't wait for completion
        ingestFn(steamUrl).catch(err => {
          console.error(`[AUTO-SUGGEST] Error ingesting "${suggestion}":`, err);
        });

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[AUTO-SUGGEST] Error processing "${suggestion}":`, error);
      }
    }

    console.log("[AUTO-SUGGEST] Finished queueing suggestions for:", gameName);
  } catch (error) {
    console.error("[AUTO-SUGGEST] Error in auto-suggestion:", error);
  }
}
