import { embedImage, weightedAverageEmbedding, normalizeEmbedding } from "./siglip";
import { embedTextProjected } from "./text";
import { describeImagesVisualStyle, combineVisualStyleDescriptions } from "./vision";
import { categorizeTags, extractSortedTags } from "./tags";
import type { GameForEmbedding, EmbeddingInput } from "./types";

const MAX_SCREENSHOTS = 4;
const HEADER_WEIGHT = 0.4;
const SCREENSHOT_WEIGHT = 0.2;

const IMAGE_EMBEDDING_WEIGHT = 0.5;
const STYLE_TEXT_WEIGHT = 0.5;

function buildVisualStyleTagsText(game: GameForEmbedding): string {
  const categorized = categorizeTags(extractSortedTags(game.steamspy_tags));
  const parts: string[] = [];

  if (categorized.visuals.length > 0) {
    parts.push(`Visual style: ${categorized.visuals.slice(0, 5).join(", ")}`);
  }

  return parts.join(". ");
}

export async function generateAestheticEmbedding(
  game: GameForEmbedding
): Promise<EmbeddingInput> {
  const imageUrls: string[] = [];
  const weights: number[] = [];

  if (game.header_image) {
    imageUrls.push(game.header_image);
    weights.push(HEADER_WEIGHT);
  }

  for (const screenshot of game.screenshots.slice(0, MAX_SCREENSHOTS - 1)) {
    imageUrls.push(screenshot);
    weights.push(SCREENSHOT_WEIGHT);
  }

  if (imageUrls.length === 0) {
    throw new Error(`No images available for game ${game.appid}`);
  }

  console.log(`Generating AESTHETIC embedding for ${game.title} using ${imageUrls.length} images...`);

  const embeddingsToMerge: number[][] = [];
  const mergeWeights: number[] = [];

  const imageEmbeddings: number[][] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      imageEmbeddings.push(await embedImage(imageUrls[i]));
    } catch (error) {
      console.warn(`Failed to embed image ${i + 1} for ${game.title}:`, error);
      weights.splice(imageEmbeddings.length, 1);
    }
  }

  if (imageEmbeddings.length > 0) {
    const clipEmbedding = weightedAverageEmbedding(imageEmbeddings, weights.slice(0, imageEmbeddings.length));
    embeddingsToMerge.push(clipEmbedding);
    mergeWeights.push(IMAGE_EMBEDDING_WEIGHT);
  }

  let styleDescriptions: string[] = [];
  let usedVision = false;
  try {
    console.log(`  Analyzing visual style from ${Math.min(2, imageUrls.length)} images...`);
    styleDescriptions = await describeImagesVisualStyle(imageUrls.slice(0, 2));
    usedVision = styleDescriptions.length > 0;
  } catch (error) {
    console.warn(`  Vision style analysis failed:`, error);
  }

  const tagStyleText = buildVisualStyleTagsText(game);
  let styleText: string;
  if (usedVision) {
    const visionText = combineVisualStyleDescriptions(styleDescriptions);
    styleText = tagStyleText ? `${visionText}\n\nTags: ${tagStyleText}` : visionText;
  } else {
    styleText = tagStyleText || "indie game visual style";
  }

  if (styleText) {
    console.log(`  Embedding style description (${styleText.length} chars)...`);
    const styleEmbedding = await embedTextProjected(styleText);
    embeddingsToMerge.push(styleEmbedding);
    mergeWeights.push(STYLE_TEXT_WEIGHT);
  }

  if (embeddingsToMerge.length === 0) {
    throw new Error(`Failed to generate any embeddings for game ${game.appid}`);
  }

  const combined = weightedAverageEmbedding(embeddingsToMerge, mergeWeights);
  const normalized = normalizeEmbedding(combined);

  return {
    appid: game.appid,
    facet: "aesthetic",
    embedding: normalized,
    source_type: usedVision ? "multimodal" : "image",
    source_data: {
      image_urls: imageUrls.slice(0, imageEmbeddings.length),
      weights: weights.slice(0, imageEmbeddings.length),
      successful_embeds: imageEmbeddings.length,
      style_descriptions: styleDescriptions,
      style_text: styleText,
      used_vision: usedVision,
    },
    embedding_model: usedVision ? "clip+moondream2+text-embedding-3-small" : "clip+text-embedding-3-small",
  };
}

export function canGenerateAestheticEmbedding(game: GameForEmbedding): boolean {
  return !!(game.header_image || game.screenshots.length > 0);
}

export function getAestheticImageUrls(game: GameForEmbedding): string[] {
  const urls: string[] = [];
  if (game.header_image) urls.push(game.header_image);
  urls.push(...game.screenshots.slice(0, MAX_SCREENSHOTS - 1));
  return urls;
}
