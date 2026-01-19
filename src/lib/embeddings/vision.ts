import Replicate from "replicate";

const MOONDREAM_MODEL = "lucataco/moondream2:392a53ac3f36d630d2d07ce0e78142aca956571e3b25a26e770692398ebe4c18";

let _replicate: Replicate | null = null;
function getReplicate(): Replicate {
  if (!_replicate) {
    _replicate = new Replicate();
  }
  return _replicate;
}

const ATMOSPHERE_PROMPT = `Describe the mood and atmosphere of this video game screenshot in 2-3 sentences. Focus on:
- Emotional tone (dark, cozy, tense, whimsical, melancholic, etc.)
- Visual atmosphere (lighting, color palette, weather/environment mood)
- Overall feeling it evokes

Be concise and focus on emotional qualities, not gameplay or objects.`;

const VISUAL_STYLE_PROMPT = `Describe the visual art style of this video game screenshot in 2-3 sentences. Focus on:
- Art style (pixel art, realistic 3D, anime, hand-drawn, low-poly, etc.)
- Color palette (vibrant, muted, neon, pastel, monochrome, etc.)
- Visual techniques (cel-shading, lighting style, texture quality)

Be concise and focus on visual aesthetics, not the content or gameplay.`;

export async function describeImageAtmosphere(imageUrl: string): Promise<string> {
  try {
    const output = await getReplicate().run(MOONDREAM_MODEL, {
      input: {
        image: imageUrl,
        prompt: ATMOSPHERE_PROMPT,
      },
    }) as unknown;

    if (typeof output !== "string" || !output.trim()) {
      throw new Error(`Unexpected output format from Moondream: ${typeof output}`);
    }

    return output.trim();
  } catch (error) {
    console.error(`Failed to describe image atmosphere: ${imageUrl}`, error);
    throw error;
  }
}

export async function describeImagesAtmosphere(
  imageUrls: string[],
  concurrency = 2
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => describeImageAtmosphere(url).catch(() => null))
    );
    results.push(...batchResults.filter((r): r is string => r !== null));
  }
  
  return results;
}

export function combineAtmosphereDescriptions(descriptions: string[]): string {
  if (descriptions.length === 0) {
    return "atmospheric game";
  }
  
  if (descriptions.length === 1) {
    return descriptions[0];
  }
  
  return `Game atmosphere based on multiple screenshots:\n${descriptions.map((d, i) => `Scene ${i + 1}: ${d}`).join("\n")}`;
}

export async function describeImageVisualStyle(imageUrl: string): Promise<string> {
  try {
    const output = await getReplicate().run(MOONDREAM_MODEL, {
      input: {
        image: imageUrl,
        prompt: VISUAL_STYLE_PROMPT,
      },
    }) as unknown;

    if (typeof output !== "string" || !output.trim()) {
      throw new Error(`Unexpected output format from Moondream: ${typeof output}`);
    }

    return output.trim();
  } catch (error) {
    console.error(`Failed to describe image visual style: ${imageUrl}`, error);
    throw error;
  }
}

export async function describeImagesVisualStyle(
  imageUrls: string[],
  concurrency = 2
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => describeImageVisualStyle(url).catch(() => null))
    );
    results.push(...batchResults.filter((r): r is string => r !== null));
  }
  
  return results;
}

export function combineVisualStyleDescriptions(descriptions: string[]): string {
  if (descriptions.length === 0) {
    return "indie game visual style";
  }
  
  if (descriptions.length === 1) {
    return descriptions[0];
  }
  
  return `Visual style based on multiple screenshots:\n${descriptions.map((d, i) => `Image ${i + 1}: ${d}`).join("\n")}`;
}
