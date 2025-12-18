import { generateObject } from 'ai';
import { z } from 'zod';
import { getVisionModel } from '../ai/gateway';

const FacetSchema = z.object({
  summary: z.string().describe('A detailed description of this facet'),
  keywords: z.array(z.string()).describe('Relevant keywords for this facet'),
});

const VisionFacetsSchema = z.object({
  aesthetics: FacetSchema.describe(
    'Visual style, art direction, color palette, and visual perspective'
  ),
  gameplay: FacetSchema.describe(
    'Core mechanics, player perspective, gameplay loop, and interaction patterns'
  ),
  narrativeMood: FacetSchema.describe(
    'Theme, atmosphere, story tone, and emotional resonance'
  ),
});

export type VisionFacets = z.infer<typeof VisionFacetsSchema>;

/**
 * Extract facet descriptions from game screenshots and metadata using vision model
 */
export async function extractFacetsFromVision(
  gameName: string,
  description: string,
  genres: string[],
  tags: string[],
  screenshotUrls: string[],
  visionModelId: string
): Promise<VisionFacets> {
  const model = getVisionModel(visionModelId);

  // Build context for the vision model
  const context = [
    `Game: ${gameName}`,
    `Description: ${description || 'No description available'}`,
    `Genres: ${genres.join(', ') || 'None'}`,
    `Tags: ${tags.join(', ') || 'None'}`,
  ].join('\n');

  // Prepare image inputs (first 6 screenshots)
  const images = screenshotUrls.slice(0, 6).map((url) => ({
    type: 'image' as const,
    image: url,
  }));

  const { object } = await generateObject({
    model,
    schema: VisionFacetsSchema,
    prompt: `Analyze this Steam game and extract three distinct facets:

1. **Aesthetics**: Focus on visual style, art direction, color palette, and visual perspective. What does the game look like?

2. **Gameplay**: Focus on core mechanics, player perspective (first-person, third-person, top-down, etc.), gameplay loop, and interaction patterns. How does the player interact with the game?

3. **Narrative/Mood**: Focus on theme, atmosphere, story tone, and emotional resonance. What is the mood and narrative style?

Game context:
${context}

Analyze the screenshots and metadata to provide detailed descriptions for each facet.`,
    images: images.length > 0 ? images : undefined,
  });

  return object;
}
