/**
 * NARRATIVE facet embedding generation
 *
 * Generates embeddings from game descriptions and themes that capture:
 * - Setting (fantasy, sci-fi, modern, etc.)
 * - Narrative themes
 * - Story type and tone
 * - Player fantasy (what you get to be/do)
 */

import { embedTextProjected, cleanTextForEmbedding } from "./text";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

/**
 * Infer the game's setting from tags and description
 */
function inferSetting(game: GameWithIgdb): string {
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);
  const themes = categorized.themes;

  // IGDB themes take priority
  if (game.igdb_data?.themes && game.igdb_data.themes.length > 0) {
    return game.igdb_data.themes.slice(0, 3).join(", ");
  }

  // Check for setting indicators in tags
  const settingPriority = [
    "sci-fi",
    "fantasy",
    "medieval",
    "post-apocalyptic",
    "cyberpunk",
    "steampunk",
    "space",
    "western",
    "noir",
    "modern",
    "historical",
  ];

  for (const setting of settingPriority) {
    if (themes.includes(setting)) {
      return setting.charAt(0).toUpperCase() + setting.slice(1);
    }
  }

  // Try to infer from description
  const desc = (game.short_description || "").toLowerCase();

  if (desc.includes("space") || desc.includes("galaxy") || desc.includes("planet")) {
    return "Science fiction, Space";
  }
  if (desc.includes("magic") || desc.includes("kingdom") || desc.includes("dragon")) {
    return "Fantasy";
  }
  if (desc.includes("zombie") || desc.includes("apocalypse") || desc.includes("wasteland")) {
    return "Post-apocalyptic";
  }

  return themes.slice(0, 2).join(", ") || "Unknown";
}

/**
 * Infer narrative themes from tags and description
 */
function inferThemes(game: GameWithIgdb): string[] {
  const themes: string[] = [];

  // IGDB themes
  if (game.igdb_data?.themes) {
    themes.push(...game.igdb_data.themes.slice(0, 5));
  }

  // Tag-based themes
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);

  // Add mood-related themes
  for (const mood of categorized.moods.slice(0, 3)) {
    if (!themes.includes(mood)) {
      themes.push(mood);
    }
  }

  // Add setting themes
  for (const theme of categorized.themes.slice(0, 3)) {
    if (!themes.includes(theme)) {
      themes.push(theme);
    }
  }

  return themes.slice(0, 8);
}

/**
 * Infer the narrative tone
 */
function inferNarrativeTone(game: GameWithIgdb): string {
  const tags = extractSortedTags(game.steamspy_tags);
  const categorized = categorizeTags(tags);
  const moods = categorized.moods;

  // Map moods to narrative tone
  if (moods.includes("horror") || moods.includes("dark")) {
    return "Dark, tense";
  }
  if (moods.includes("cozy") || moods.includes("relaxing")) {
    return "Warm, gentle";
  }
  if (moods.includes("funny") || moods.includes("comedy")) {
    return "Comedic, lighthearted";
  }
  if (moods.includes("emotional") || moods.includes("story-rich")) {
    return "Emotional, dramatic";
  }
  if (moods.includes("atmospheric")) {
    return "Atmospheric, immersive";
  }

  return "Engaging";
}

/**
 * Infer what the player gets to be/do (player fantasy)
 */
function inferPlayerFantasy(game: GameWithIgdb): string {
  const desc = game.short_description || "";

  // Try simple pattern extraction
  const match = desc.match(/you (?:are|play as|become) (?:a |an )?([^,.]+)/i);
  if (match) {
    return match[1].trim();
  }

  // Just use first part of description if available
  if (desc.length > 10) {
    const firstSentence = desc.split(/[.!?]/)[0];
    if (firstSentence.length < 100) {
      return firstSentence.trim();
    }
  }

  return "";
}

/**
 * Build structured text template for NARRATIVE embedding
 */
export function buildNarrativeText(game: GameWithIgdb): string {
  const setting = inferSetting(game);
  const themes = inferThemes(game);
  const tone = inferNarrativeTone(game);
  const fantasy = inferPlayerFantasy(game);

  // Clean description
  const description = cleanTextForEmbedding(
    game.short_description || game.long_description || "",
    500
  );

  // Use IGDB storyline if available
  const storyline = game.igdb_data?.storyline
    ? cleanTextForEmbedding(game.igdb_data.storyline, 500)
    : "";

  const parts: string[] = [
    `Setting: ${setting}`,
    `Themes: ${themes.join(", ") || "Adventure"}`,
    `Story: ${description || game.title}`,
    `Tone: ${tone}`,
  ];

  if (fantasy) {
    parts.push(`Fantasy: ${fantasy}`);
  }

  // Add storyline if available and different from description
  if (storyline && storyline !== description) {
    parts.push(`Storyline: ${storyline}`);
  }

  return parts.join("\n");
}

/**
 * Generate NARRATIVE embedding for a game
 *
 * @param game - Game data with description and optional IGDB enrichment
 * @returns Embedding input ready for storage
 */
export async function generateNarrativeEmbedding(
  game: GameWithIgdb
): Promise<EmbeddingInput> {
  const narrativeText = buildNarrativeText(game);

  console.log(
    `Generating NARRATIVE embedding for ${game.title}...`
  );
  console.log(`  Template:\n${narrativeText.split("\n").map(l => `    ${l}`).join("\n")}`);

  const embedding = await embedTextProjected(narrativeText);

  return {
    appid: game.appid,
    facet: "narrative",
    embedding,
    source_type: "text",
    source_data: {
      template: narrativeText,
      has_description: !!game.short_description,
      has_igdb_storyline: !!game.igdb_data?.storyline,
    },
    embedding_model: "text-embedding-3-small",
  };
}

/**
 * Check if a game has sufficient data for NARRATIVE embedding
 */
export function canGenerateNarrativeEmbedding(game: GameWithIgdb): boolean {
  return !!(
    game.short_description ||
    game.long_description ||
    game.igdb_data?.storyline
  );
}
