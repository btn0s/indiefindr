import { generateText } from "ai";
import Replicate from "replicate";

const MOONDREAM_MODEL = "lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31";

let _replicate: Replicate | null = null;
function getReplicate(): Replicate {
  if (!_replicate) {
    _replicate = new Replicate();
  }
  return _replicate;
}

// Atmosphere prompt asks for CONCRETE visual observations, not abstract moods
// This produces differentiating features that embed distinctly
const ATMOSPHERE_PROMPT = `Analyze this video game screenshot and describe ONLY the observable visual elements that create atmosphere. Be specific and factual.

List each element on its own line:
- Lighting: (e.g., harsh overhead fluorescent, soft golden sunset, dim candlelight, pitch black with spotlight)
- Color temperature: (warm/cool/neutral and dominant hues)
- Environment type: (e.g., cramped indoor space, vast outdoor landscape, abstract void, cluttered room)
- Time/weather: (if visible - day/night/sunset, rain/fog/clear/snow)
- Visual density: (minimal/sparse, moderate, cluttered/chaotic)
- Mood indicators: (specific visual elements that suggest mood - blood splatters, flowers, machinery, etc.)

Do NOT use generic mood words like "dark" or "cozy". Describe what you literally see.`;

const VISUAL_STYLE_PROMPT = `Analyze this video game screenshot's visual art style. List SPECIFIC observable features:

- Rendering: (pixel art with resolution estimate, cel-shaded 3D, photorealistic, hand-painted, vector, low-poly, voxel)
- Perspective: (2D side-view, top-down, isometric, first-person, third-person)
- Color scheme: (specific dominant colors, saturation level, contrast)
- Line work: (thick outlines, no outlines, sketch-like, clean vectors)
- Texture style: (flat colors, detailed textures, painterly, retro)

Be specific. "Pixel art" alone is too vague - say "16-bit pixel art with limited palette" or "HD pixel art with smooth gradients".`;

export async function describeImageAtmosphere(imageUrl: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ATMOSPHERE_PROMPT },
            { type: "image", image: imageUrl },
          ],
        },
      ],
      maxOutputTokens: 300,
    });

    if (!text?.trim()) {
      throw new Error("Empty response from GPT-4o-mini");
    }

    return text.trim();
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
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISUAL_STYLE_PROMPT },
            { type: "image", image: imageUrl },
          ],
        },
      ],
      maxOutputTokens: 300,
    });

    if (!text?.trim()) {
      throw new Error("Empty response from GPT-4o-mini");
    }

    return text.trim();
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
