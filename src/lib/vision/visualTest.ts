import { generateObject, generateText } from "ai";
import { z } from "zod";

/**
 * Schema for aesthetic extraction test results
 */
export const AestheticTestSchema = z.object({
  graphicsTech: z.object({
    fidelity: z.enum(["dated/retro", "stylized", "modern-high-fidelity"]).describe("Is it dated/retro (PS1-PS3 era, low-poly), stylized (cel-shaded, pixel art), or modern high-fidelity (UE5, photorealistic)?"),
    era: z.string().optional().describe("Specific era reference if applicable (e.g., 'PS1-era 3D', 'Source engine era', 'UE5')"),
  }),
  lighting: z.object({
    mood: z.enum(["dark-moody", "bright-vibrant", "mixed"]).describe("Overall lighting mood"),
    descriptors: z.array(z.string()).describe("2-4 lighting descriptors (e.g., 'oppressive', 'volumetric fog', 'harsh shadows', 'soft ambient')"),
  }),
  colors: z.object({
    saturation: z.enum(["desaturated", "muted", "saturated", "vibrant"]).describe("Overall color saturation"),
    palette: z.array(z.string()).describe("3-5 color descriptors (e.g., 'grey-brown', 'neon accents', 'sickly greens', 'warm oranges')"),
  }),
  artDirection: z.object({
    theme: z.array(z.string()).describe("2-4 art direction themes (e.g., 'brutalist', 'retro-futurism', 'horror', 'cozy', 'cyberpunk')"),
    style: z.array(z.string()).describe("2-4 style descriptors (e.g., 'gritty realism', 'VHS filter', 'grindhouse', 'clean minimalist')"),
  }),
  summary: z.string().describe("2-3 sentence summary of the visual aesthetic using the above terms"),
});

export type AestheticTestResult = z.infer<typeof AestheticTestSchema>;

/**
 * Test result container for multiple models
 */
export interface VisualTestResults {
  imageUrls: string[];
  gameName?: string;
  results: {
    modelId: string;
    success: boolean;
    result?: AestheticTestResult;
    rawText?: string;
    error?: string;
    latencyMs: number;
  }[];
}

/**
 * Models to test
 */
export const TEST_MODELS = [
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
];

const AESTHETIC_ANALYSIS_PROMPT = `You are a video game visual analyst. Analyze these game screenshots and extract the VISUAL AESTHETIC.

BY 2024 STANDARDS, describe:

1. GRAPHICS TECH:
   - Is this dated/retro (PS1-PS3 era, Source engine, low-poly by modern standards)?
   - Or stylized (cel-shaded, pixel art, intentionally lo-fi)?
   - Or modern high-fidelity (UE5, photorealistic, AAA graphics)?

2. LIGHTING:
   - Dark/moody/oppressive OR bright/vibrant/open?
   - Specific lighting characteristics?

3. COLORS:
   - Desaturated/muted (greys, browns) OR saturated/vibrant (colorful)?
   - What's the color palette?

4. ART DIRECTION:
   - What themes? (brutalist, retro-futurism, horror, cozy, cyberpunk, etc.)
   - What style? (gritty realism, VHS filter, clean minimalist, etc.)

CRITICAL: Judge graphics fidelity BY 2024 STANDARDS. A 2004 game looks dated NOW.

Be specific and accurate based on what you SEE in the screenshots.`;

/**
 * Test visual extraction with a specific model
 */
async function testModelStructured(
  modelId: string,
  imageUrls: string[],
  gameName?: string
): Promise<{ success: boolean; result?: AestheticTestResult; error?: string; latencyMs: number }> {
  const start = Date.now();
  
  try {
    const prompt = gameName 
      ? `${AESTHETIC_ANALYSIS_PROMPT}\n\nGame: ${gameName}`
      : AESTHETIC_ANALYSIS_PROMPT;

    const { object } = await generateObject({
      model: modelId,
      schema: AestheticTestSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageUrls.map(url => ({ type: "image" as const, image: url })),
          ],
        },
      ],
    });

    return {
      success: true,
      result: object,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Test visual extraction with raw text output (for debugging)
 */
async function testModelRaw(
  modelId: string,
  imageUrls: string[],
  gameName?: string
): Promise<{ success: boolean; rawText?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  
  try {
    const prompt = gameName 
      ? `${AESTHETIC_ANALYSIS_PROMPT}\n\nGame: ${gameName}\n\nDescribe the visual aesthetic in 3-4 sentences.`
      : `${AESTHETIC_ANALYSIS_PROMPT}\n\nDescribe the visual aesthetic in 3-4 sentences.`;

    const { text } = await generateText({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageUrls.map(url => ({ type: "image" as const, image: url })),
          ],
        },
      ],
    });

    return {
      success: true,
      rawText: text,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Run visual extraction test across multiple models
 */
export async function runVisualTest(
  imageUrls: string[],
  gameName?: string,
  modelIds?: string[],
  mode: "structured" | "raw" = "structured"
): Promise<VisualTestResults> {
  const modelsToTest = modelIds 
    ? TEST_MODELS.filter(m => modelIds.includes(m.id))
    : TEST_MODELS;

  const results = await Promise.all(
    modelsToTest.map(async (model) => {
      console.log(`[VISUAL-TEST] Testing ${model.name} (${model.id})...`);
      
      const testFn = mode === "structured" ? testModelStructured : testModelRaw;
      const result = await testFn(model.id, imageUrls, gameName);
      
      console.log(`[VISUAL-TEST] ${model.name}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.latencyMs}ms)`);
      
      return {
        modelId: model.id,
        ...result,
      };
    })
  );

  return {
    imageUrls,
    gameName,
    results,
  };
}

/**
 * Test a single model
 */
export async function testSingleModel(
  modelId: string,
  imageUrls: string[],
  gameName?: string,
  mode: "structured" | "raw" = "structured"
) {
  console.log(`[VISUAL-TEST] Testing single model: ${modelId}`);
  
  if (mode === "structured") {
    return testModelStructured(modelId, imageUrls, gameName);
  } else {
    return testModelRaw(modelId, imageUrls, gameName);
  }
}
