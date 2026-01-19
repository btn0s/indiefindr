import { weightedAverageEmbedding, normalizeEmbedding } from "./siglip";
import { embedTextProjected } from "./text";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

const VISUAL_WEIGHT = 0.6;
const TEXT_WEIGHT = 0.4;

const MOOD_PATTERNS = [
  { pattern: /dark|grim|bleak|sinister/i, mood: "dark" },
  { pattern: /cozy|warm|peaceful|relaxing/i, mood: "cozy" },
  { pattern: /tense|intense|thrilling|suspense/i, mood: "tense" },
  { pattern: /beautiful|gorgeous|stunning/i, mood: "beautiful" },
  { pattern: /eerie|creepy|haunting/i, mood: "eerie" },
  { pattern: /whimsical|charming|delightful/i, mood: "whimsical" },
  { pattern: /brutal|violent|visceral/i, mood: "brutal" },
  { pattern: /melancholic|sad|emotional/i, mood: "melancholic" },
];

function buildMoodText(game: GameWithIgdb): string {
  const categorized = categorizeTags(extractSortedTags(game.steamspy_tags));
  const parts: string[] = [];

  if (categorized.moods.length > 0) {
    parts.push(`Mood: ${categorized.moods.slice(0, 5).join(", ")}`);
  }
  if (categorized.visuals.length > 0) {
    parts.push(`Style: ${categorized.visuals.slice(0, 3).join(", ")}`);
  }
  if (categorized.themes.length > 0) {
    parts.push(`Theme: ${categorized.themes.slice(0, 3).join(", ")}`);
  }
  if (game.igdb_data?.themes?.length) {
    parts.push(`Setting: ${game.igdb_data.themes.slice(0, 4).join(", ")}`);
  }

  const desc = (game.short_description || "").toLowerCase();
  const moodWords = MOOD_PATTERNS.filter(({ pattern }) => pattern.test(desc)).map(({ mood }) => mood);
  if (moodWords.length > 0) {
    parts.push(`Feel: ${moodWords.join(", ")}`);
  }

  return parts.join("\n") || "atmospheric indie game";
}

export async function generateAtmosphereEmbedding(
  game: GameWithIgdb,
  aestheticEmbedding?: number[]
): Promise<EmbeddingInput> {
  console.log(`Generating ATMOSPHERE embedding for ${game.title}...`);

  const embeddings: number[][] = [];
  const weights: number[] = [];

  if (aestheticEmbedding) {
    embeddings.push(aestheticEmbedding);
    weights.push(VISUAL_WEIGHT);
  }

  const moodText = buildMoodText(game);
  const textEmb = await embedTextProjected(moodText);
  embeddings.push(textEmb);
  weights.push(TEXT_WEIGHT);

  if (embeddings.length === 0) {
    throw new Error(`No embeddings generated for atmosphere: ${game.appid}`);
  }

  const combined = weightedAverageEmbedding(embeddings, weights);
  const normalized = normalizeEmbedding(combined);

  return {
    appid: game.appid,
    facet: "atmosphere",
    embedding: normalized,
    source_type: "multimodal",
    source_data: {
      aesthetic_reused: !!aestheticEmbedding,
      mood_text: moodText,
      igdb_themes: game.igdb_data?.themes || null,
    },
    embedding_model: "siglip2+text-embedding-3-small",
  };
}

export function canGenerateAtmosphereEmbedding(game: GameWithIgdb): boolean {
  const hasImage = !!(game.header_image || game.screenshots.length > 0);
  const hasTags = extractSortedTags(game.steamspy_tags).length > 0;
  return hasImage || hasTags;
}
