/**
 * Image Service
 * Handles image generation functionality using Gemini AI.
 */

import { ai, MODELS, withRetry } from "./shared/apiClient";
import { IMAGE_STYLE_MODIFIERS, DEFAULT_NEGATIVE_CONSTRAINTS } from "../constants";
import { refineImagePrompt } from "./promptService";

/**
 * Check if the model is an Imagen model (requires generateImages API).
 */
function isImagenModel(model: string): boolean {
  return model.toLowerCase().includes("imagen");
}

/**
 * Generate an image from a prompt.
 * @param promptText - The prompt describing the image to generate
 * @param style - Art style preset (default: "Cinematic")
 * @param globalSubject - Subject to keep consistent across scenes
 * @param aspectRatio - Image aspect ratio (default: "16:9")
 * @param skipRefine - Skip AI refinement if prompt was already refined upstream
 */
export const generateImageFromPrompt = async (
  promptText: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  aspectRatio: string = "16:9",
  skipRefine: boolean = false,
): Promise<string> => {
  return withRetry(async () => {
    const modifier = IMAGE_STYLE_MODIFIERS[style] || IMAGE_STYLE_MODIFIERS["Cinematic"];

    // Run a lightweight lint + (optional) AI refinement before image generation.
    // Skip if already refined upstream (e.g., during bulk generation with cross-scene context).
    let refinedPrompt = promptText;

    if (!skipRefine) {
      const result = await refineImagePrompt({
        promptText,
        style,
        globalSubject,
        aspectRatio,
        intent: "auto",
        previousPrompts: [],
      });

      refinedPrompt = result.refinedPrompt;

      if (result.issues.length > 0) {
        console.log(
          `[prompt-lint] ${result.issues.map((i) => i.code).join(", ")} | style=${style} | aspectRatio=${aspectRatio}`,
        );
      }
    }

    const subjectBlock = globalSubject
      ? `Global Subject (keep consistent across scenes): ${globalSubject}`
      : "";

    const negative = DEFAULT_NEGATIVE_CONSTRAINTS.map((s) => `- ${s}`).join(
      "\n",
    );

    // Build the final prompt
    const finalPrompt = `
${modifier}

${subjectBlock}

${refinedPrompt}

Style: Raw photo style, 35mm film grain, high dynamic range, professional cinematography.
Avoid: Text, subtitles, typography, logos, watermarks, distorted anatomy, extra limbs.

${negative}
    `.trim();

    // Check if we're using an Imagen model (requires different API)
    if (isImagenModel(MODELS.IMAGE)) {
      return await generateWithImagenAPI(finalPrompt, aspectRatio);
    } else {
      return await generateWithGeminiAPI(finalPrompt, aspectRatio);
    }
  });
};

/**
 * Generate image using Imagen API (generateImages method).
 * Used for imagen-3.0, imagen-4.0, etc.
 */
async function generateWithImagenAPI(prompt: string, aspectRatio: string): Promise<string> {
  console.log(`[ImageService] Using Imagen API with model: ${MODELS.IMAGE}`);

  const response = await ai.models.generateImages({
    model: MODELS.IMAGE,
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: aspectRatio,
      // @ts-ignore - personGeneration may not be in types yet
      personGeneration: "allow_adult",
    },
  });

  // Check if we got generated images
  if (response.generatedImages && response.generatedImages.length > 0) {
    const img = response.generatedImages[0];

    // Check if image was filtered
    if (img.raiFilteredReason) {
      console.warn(`[ImageService] Image was filtered: ${img.raiFilteredReason}`);
      throw new Error(`Image generation was filtered by safety system: ${img.raiFilteredReason}`);
    }

    // Get the image bytes
    if (img.image?.imageBytes) {
      return `data:image/png;base64,${img.image.imageBytes}`;
    }
  }

  throw new Error("No image data found in Imagen response");
}

/**
 * Generate image using Gemini API (generateContent method).
 * Used for gemini-2.5-flash-image, gemini-3-pro-image-preview, etc.
 */
async function generateWithGeminiAPI(prompt: string, aspectRatio: string): Promise<string> {
  console.log(`[ImageService] Using Gemini API with model: ${MODELS.IMAGE}`);

  const response = await ai.models.generateContent({
    model: MODELS.IMAGE,
    contents: { parts: [{ text: prompt }] },
    config: {
      // @ts-ignore
      imageConfig: { aspectRatio: aspectRatio },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found in Gemini response");
}
