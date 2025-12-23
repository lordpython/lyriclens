/**
 * Image Service
 * Handles image generation functionality using Gemini AI.
 */

import { ai, MODELS, withRetry } from "./shared/apiClient";
import { IMAGE_STYLE_MODIFIERS, DEFAULT_NEGATIVE_CONSTRAINTS } from "../constants";
import { refineImagePrompt } from "./promptService";

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
      : "Global Subject: (none)";

    const negative = DEFAULT_NEGATIVE_CONSTRAINTS.map((s) => `- ${s}`).join(
      "\n",
    );

    const finalPrompt = `
STYLE:
${modifier}

${subjectBlock}

SCENE PROMPT:
${refinedPrompt}

HARD REQUIREMENTS:
- Professional composition and clean framing.
- Maintain the same main subject identity across scenes (face, outfit, materials).
- No text, subtitles, typography, logos, watermarks, brand names.
- Avoid distorted anatomy, extra limbs, deformed hands, blurry faces.

NEGATIVE CONSTRAINTS:
${negative}
    `.trim();

    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: { parts: [{ text: finalPrompt }] },
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

    throw new Error("No image data found in response");
  });
};
