import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
// Prefer the documented env var, but keep backward compatibility.
export const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.API_KEY ||
  "";

export const MODELS = {
  TEXT: "gemini-3-flash-preview",
  IMAGE: "gemini-2.5-flash-image",
  VIDEO: "veo-3.0-fast-generate-001", // Use Veo 3 fast model for video generation
  TRANSCRIPTION: "gemini-3-flash-preview",
  TRANSLATION: "gemini-3-flash-preview",
};

export const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Retry Configuration ---
export interface RetryConfig {
  retries?: number;
  delayMs?: number;
  backoffFactor?: number;
}

/**
 * Retry wrapper for AI calls.
 * Handles transient API failures (503, 429) with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2,
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (
      retries > 0 &&
      (error.status === 503 ||
        error.status === 429 ||
        error.message?.includes("fetch failed"))
    ) {
      console.warn(
        `API call failed. Retrying in ${delayMs}ms... (${retries} attempts left). Error: ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs * backoffFactor, backoffFactor);
    }
    throw error;
  }
}
