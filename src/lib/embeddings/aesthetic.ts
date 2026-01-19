import { embedImage, weightedAverageEmbedding, normalizeEmbedding } from "./siglip";
import type { GameForEmbedding, EmbeddingInput } from "./types";

const MAX_SCREENSHOTS = 4;
const HEADER_WEIGHT = 0.4;
const SCREENSHOT_WEIGHT = 0.2;

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

  const embeddings: number[][] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      embeddings.push(await embedImage(imageUrls[i]));
    } catch (error) {
      console.warn(`Failed to embed image ${i + 1} for ${game.title}:`, error);
      weights.splice(embeddings.length, 1);
    }
  }

  if (embeddings.length === 0) {
    throw new Error(`Failed to embed any images for game ${game.appid}`);
  }

  const averaged = weightedAverageEmbedding(embeddings, weights.slice(0, embeddings.length));
  const normalized = normalizeEmbedding(averaged);

  return {
    appid: game.appid,
    facet: "aesthetic",
    embedding: normalized,
    source_type: "image",
    source_data: {
      image_urls: imageUrls.slice(0, embeddings.length),
      weights: weights.slice(0, embeddings.length),
      successful_embeds: embeddings.length,
    },
    embedding_model: "siglip2-base-patch16-224",
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
