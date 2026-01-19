import { embedTextProjected, cleanTextForEmbedding } from "./text";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

const SETTING_PRIORITY = [
  "sci-fi", "fantasy", "medieval", "post-apocalyptic", "cyberpunk",
  "steampunk", "space", "western", "noir", "modern", "historical",
];

function inferSetting(game: GameWithIgdb): string {
  const themes = categorizeTags(extractSortedTags(game.steamspy_tags)).themes;

  if (game.igdb_data?.themes?.length) {
    return game.igdb_data.themes.slice(0, 3).join(", ");
  }

  for (const setting of SETTING_PRIORITY) {
    if (themes.includes(setting)) {
      return setting.charAt(0).toUpperCase() + setting.slice(1);
    }
  }

  const desc = (game.short_description || "").toLowerCase();
  if (desc.includes("space") || desc.includes("galaxy") || desc.includes("planet")) return "Science fiction, Space";
  if (desc.includes("magic") || desc.includes("kingdom") || desc.includes("dragon")) return "Fantasy";
  if (desc.includes("zombie") || desc.includes("apocalypse") || desc.includes("wasteland")) return "Post-apocalyptic";

  return themes.slice(0, 2).join(", ") || "Unknown";
}

function inferThemes(game: GameWithIgdb): string[] {
  const themes: string[] = [];

  if (game.igdb_data?.themes) themes.push(...game.igdb_data.themes.slice(0, 5));

  const categorized = categorizeTags(extractSortedTags(game.steamspy_tags));
  for (const mood of categorized.moods.slice(0, 3)) {
    if (!themes.includes(mood)) themes.push(mood);
  }
  for (const theme of categorized.themes.slice(0, 3)) {
    if (!themes.includes(theme)) themes.push(theme);
  }

  return themes.slice(0, 8);
}

function inferNarrativeTone(game: GameWithIgdb): string {
  const moods = categorizeTags(extractSortedTags(game.steamspy_tags)).moods;

  if (moods.includes("horror") || moods.includes("dark")) return "Dark, tense";
  if (moods.includes("cozy") || moods.includes("relaxing")) return "Warm, gentle";
  if (moods.includes("funny") || moods.includes("comedy")) return "Comedic, lighthearted";
  if (moods.includes("emotional") || moods.includes("story-rich")) return "Emotional, dramatic";
  if (moods.includes("atmospheric")) return "Atmospheric, immersive";

  return "Engaging";
}

function inferPlayerFantasy(game: GameWithIgdb): string {
  const desc = game.short_description || "";
  const match = desc.match(/you (?:are|play as|become) (?:a |an )?([^,.]+)/i);
  if (match) return match[1].trim();

  if (desc.length > 10) {
    const firstSentence = desc.split(/[.!?]/)[0];
    if (firstSentence.length < 100) return firstSentence.trim();
  }

  return "";
}

export function buildNarrativeText(game: GameWithIgdb): string {
  const setting = inferSetting(game);
  const themes = inferThemes(game);
  const tone = inferNarrativeTone(game);
  const fantasy = inferPlayerFantasy(game);

  const description = cleanTextForEmbedding(game.short_description || game.long_description || "", 500);
  const storyline = game.igdb_data?.storyline ? cleanTextForEmbedding(game.igdb_data.storyline, 500) : "";

  const parts: string[] = [
    `Setting: ${setting}`,
    `Themes: ${themes.join(", ") || "Adventure"}`,
    `Story: ${description || game.title}`,
    `Tone: ${tone}`,
  ];

  if (fantasy) parts.push(`Fantasy: ${fantasy}`);
  if (storyline && storyline !== description) parts.push(`Storyline: ${storyline}`);

  return parts.join("\n");
}

export async function generateNarrativeEmbedding(game: GameWithIgdb): Promise<EmbeddingInput> {
  const narrativeText = buildNarrativeText(game);
  console.log(`Generating NARRATIVE embedding for ${game.title}...`);

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

export function canGenerateNarrativeEmbedding(game: GameWithIgdb): boolean {
  return !!(game.short_description || game.long_description || game.igdb_data?.storyline);
}
