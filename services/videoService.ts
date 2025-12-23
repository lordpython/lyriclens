/**
 * Video Service
 * Handles video generation functionality using Gemini Veo AI.
 */

import { ai, API_KEY, MODELS, withRetry } from "./shared/apiClient";
import { VIDEO_STYLE_MODIFIERS } from "../constants";

/**
 * Poll a Veo video generation operation until complete.
 */
async function pollVideoOperation(
  operation: any,
  maxAttempts: number = 60,
  delayMs: number = 5000,
): Promise<any> {
  let currentOp = operation;

  for (let i = 0; i < maxAttempts; i++) {
    // Check if operation is already done
    if (currentOp.done) {
      if (currentOp.error) {
        throw new Error(
          `Video generation failed: ${currentOp.error.message || JSON.stringify(currentOp.error)}`,
        );
      }
      return currentOp;
    }

    console.log(
      `Video generation in progress... (attempt ${i + 1}/${maxAttempts})`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Refresh the operation status
    // @ts-ignore - SDK types may not be complete
    currentOp = await ai.operations.get(currentOp);
  }

  throw new Error(
    "Video generation timed out after " +
    (maxAttempts * delayMs) / 1000 +
    " seconds",
  );
}

/**
 * Generate a video from a prompt using Veo.
 * @param promptText - The prompt describing the video to generate
 * @param style - Art style preset (default: "Cinematic")
 * @param globalSubject - Subject to keep consistent across scenes
 * @param aspectRatio - Video aspect ratio (default: "16:9")
 */
export const generateVideoFromPrompt = async (
  promptText: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  aspectRatio: string = "16:9",
): Promise<string> => {
  // Check API key first
  if (!API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY. Video generation requires a valid Gemini API key. " +
      "Set VITE_GEMINI_API_KEY in your .env.local file.",
    );
  }

  return withRetry(async () => {
    const modifier = VIDEO_STYLE_MODIFIERS[style] || VIDEO_STYLE_MODIFIERS["Cinematic"];

    const subjectBlock = globalSubject
      ? `Global Subject (keep consistent): ${globalSubject}`
      : "";

    const finalPrompt = `
${modifier}. ${promptText}${subjectBlock ? `. ${subjectBlock}` : ""}
Smooth camera motion. No text or watermarks.
    `.trim();

    // Use the generateVideos API which returns an async operation
    // Note: Veo video generation requires a paid Gemini API plan
    let operation;
    try {
      // @ts-ignore - generateVideos may not be in type definitions yet
      operation = await ai.models.generateVideos({
        model: MODELS.VIDEO,
        prompt: finalPrompt,
        config: {
          aspectRatio: aspectRatio,
          numberOfVideos: 1,
          durationSeconds: 8, // Must be between 4-8 seconds for Veo 3
          // personGeneration is required for some models
          personGeneration: "allow_adult",
        },
      });
    } catch (err: any) {
      // Provide helpful error messages for common issues
      if (err.status === 404 || err.message?.includes("NOT_FOUND")) {
        throw new Error(
          `Veo video generation model not available. This may require:\n` +
          `1. A paid Gemini API plan (Veo is not available on free tier)\n` +
          `2. Enabling the Generative AI API in Google Cloud Console\n` +
          `3. Accepting Veo terms of service in AI Studio\n\n` +
          `Alternative: Use "deapi" as your video provider, or switch to image-only mode.`,
        );
      }
      if (err.status === 403 || err.message?.includes("PERMISSION_DENIED")) {
        throw new Error(
          `Permission denied for Veo video generation. ` +
          `Please ensure your API key has access to video generation features.`,
        );
      }
      throw err;
    }

    // Poll until the operation is complete
    const completedOp = await pollVideoOperation(operation);

    // Get the generated video
    const generatedVideos = completedOp.response?.generatedVideos || [];
    if (generatedVideos.length === 0) {
      throw new Error("No video generated in response");
    }

    const videoFile = generatedVideos[0].video;
    if (!videoFile) {
      throw new Error("No video file in response");
    }

    // Download the video file
    // @ts-ignore - files.download may not be in type definitions yet
    const downloadResponse: any = await ai.files.download({ file: videoFile });

    // Convert to base64 data URL
    // Handle Blob response
    if (
      downloadResponse &&
      typeof downloadResponse === "object" &&
      typeof downloadResponse.arrayBuffer === "function"
    ) {
      const blob = downloadResponse as Blob;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // If it's already a string (base64 or data URL)
    if (typeof downloadResponse === "string") {
      return downloadResponse.startsWith("data:")
        ? downloadResponse
        : `data:video/mp4;base64,${downloadResponse}`;
    }

    // Handle ArrayBuffer
    if (downloadResponse instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(downloadResponse);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return `data:video/mp4;base64,${btoa(binary)}`;
    }

    throw new Error("Unexpected video download response format");
  });
};
