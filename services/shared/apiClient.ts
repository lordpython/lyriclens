import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
// Prefer the documented env var, but keep backward compatibility.
export const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.API_KEY ||
  "";

// Debug: Log API key info (first 10 chars only for security)
console.log("[API Client] API Key loaded:", API_KEY ? `${API_KEY.substring(0, 10)}...` : "MISSING");

export const MODELS = {
  TEXT: "gemini-3-flash-preview",
  IMAGE: "imagen-4.0-fast-generate-001",
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

// --- Circuit Breaker State ---
// Tracks consecutive failures to prevent hammering a failing API
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5; // Trip after 5 consecutive failures
const CIRCUIT_COOLDOWN_MS = 30000; // 30 second cooldown when tripped
const MAX_BACKOFF_MS = 30000; // Cap backoff at 30 seconds

/**
 * Check if the circuit breaker is currently open (blocking requests).
 * @returns Time remaining in ms if open, 0 if closed
 */
export function getCircuitBreakerStatus(): number {
  const now = Date.now();
  if (now < circuitOpenUntil) {
    return circuitOpenUntil - now;
  }
  return 0;
}

/**
 * Reset the circuit breaker (for testing or manual recovery).
 */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

/**
 * Retry wrapper for AI calls.
 * Handles transient API failures (503, 429) with exponential backoff.
 * Includes circuit breaker pattern to prevent hammering failing APIs.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2,
): Promise<T> {
  // Check if circuit breaker is open
  const circuitRemaining = getCircuitBreakerStatus();
  if (circuitRemaining > 0) {
    const error = new Error(
      `Circuit breaker is open. API calls blocked for ${Math.ceil(circuitRemaining / 1000)} more seconds. ` +
      `This prevents overwhelming the API after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures.`
    );
    (error as any).code = "CIRCUIT_BREAKER_OPEN";
    throw error;
  }

  try {
    const result = await fn();
    // Success: reset failure counter
    consecutiveFailures = 0;
    return result;
  } catch (error: any) {
    // Check if this is a retryable error
    const isRetryable =
      error.status === 503 ||
      error.status === 429 ||
      error.message?.includes("fetch failed");

    if (isRetryable) {
      consecutiveFailures++;

      // Check if we should trip the circuit breaker
      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        console.error(
          `[Circuit Breaker] Tripped after ${consecutiveFailures} consecutive failures. ` +
          `Blocking API calls for ${CIRCUIT_COOLDOWN_MS / 1000}s.`
        );
      }

      if (retries > 0) {
        // Cap the delay at MAX_BACKOFF_MS
        const cappedDelay = Math.min(delayMs, MAX_BACKOFF_MS);
        console.warn(
          `API call failed. Retrying in ${cappedDelay}ms... (${retries} attempts left). Error: ${error.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, cappedDelay));
        return withRetry(
          fn,
          retries - 1,
          Math.min(delayMs * backoffFactor, MAX_BACKOFF_MS), // Cap next delay too
          backoffFactor
        );
      }
    }
    throw error;
  }
}
