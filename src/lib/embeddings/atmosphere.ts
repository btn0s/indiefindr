import { normalizeEmbedding } from "./siglip";
import { embedTextProjected } from "./text";
import { describeImagesAtmosphere, combineAtmosphereDescriptions } from "./vision";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameWithIgdb, EmbeddingInput } from "./types";

const MAX_IMAGES_FOR_ATMOSPHERE = 3;

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

function buildTagBasedMoodText(game: GameWithIgdb): string {
  const categorized = categorizeTags(extractSortedTags(game.steamspy_tags));
  const parts: string[] = [];

  if (categorized.moods.length > 0) {
    parts.push(`Mood tags: ${categorized.moods.slice(0, 5).join(", ")}`);
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
    parts.push(`Detected mood: ${moodWords.join(", ")}`);
  }

  return parts.join(". ");
}

function getAtmosphereImageUrls(game: GameWithIgdb): string[] {
  const urls: string[] = [];
  if (game.header_image) urls.push(game.header_image);
  urls.push(...game.screenshots.slice(0, MAX_IMAGES_FOR_ATMOSPHERE - 1));
  return urls;
}

export async function generateAtmosphereEmbedding(
  game: GameWithIgdb,
  _aestheticEmbedding?: number[]
): Promise<EmbeddingInput> {
  console.log(`Generating ATMOSPHERE embedding for ${game.title}...`);

  const imageUrls = getAtmosphereImageUrls(game);
  let visionDescriptions: string[] = [];
  let usedVision = false;

  if (imageUrls.length > 0) {
    try {
      console.log(`  Analyzing ${imageUrls.length} images for atmosphere...`);
      visionDescriptions = await describeImagesAtmosphere(imageUrls);
      usedVision = visionDescriptions.length > 0;
      console.log(`  Got ${visionDescriptions.length} atmosphere descriptions`);
    } catch (error) {
      console.warn(`  Vision analysis failed, falling back to tags:`, error);
    }
  }

  const tagMoodText = buildTagBasedMoodText(game);
  
  let atmosphereText: string;
  if (usedVision) {
    const visionText = combineAtmosphereDescriptions(visionDescriptions);
    atmosphereText = tagMoodText 
      ? `${visionText}\n\nGame metadata: ${tagMoodText}`
      : visionText;
  } else {
    atmosphereText = tagMoodText || "atmospheric indie game";
  }

  console.log(`  Embedding atmosphere text (${atmosphereText.length} chars)...`);
  const embedding = await embedTextProjected(atmosphereText);
  const normalized = normalizeEmbedding(embedding);

  return {
    appid: game.appid,
    facet: "atmosphere",
    embedding: normalized,
    source_type: usedVision ? "multimodal" : "text",
    source_data: {
      vision_descriptions: visionDescriptions,
      tag_mood_text: tagMoodText,
      combined_text: atmosphereText,
      used_vision: usedVision,
      image_count: imageUrls.length,
    },
    embedding_model: usedVision ? "moondream2+text-embedding-3-small" : "text-embedding-3-small",
  };
}

export function canGenerateAtmosphereEmbedding(game: GameWithIgdb): boolean {
  const hasImage = !!(game.header_image || game.screenshots.length > 0);
  const hasTags = extractSortedTags(game.steamspy_tags).length > 0;
  return hasImage || hasTags;
}
