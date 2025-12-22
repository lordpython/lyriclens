import { Type } from "@google/genai";

const API_BASE = "https://api.deapi.ai/api/v1/client";
const DEFAULT_MODEL = "Ltxv_13B_0_9_8_Distilled_FP8";

// Prefer the documented env var
const API_KEY =
  process.env.DEAPI_API_KEY || process.env.VITE_DEAPI_API_KEY || "";

interface DeApiError {
  status: string;
  error?: string;
  message?: string;
}

interface DeApiStatusResponse {
  data?: {
    status: "pending" | "processing" | "done" | "error";
    result_url?: string;
    result?: string;
    error?: string;
    progress?: number;
  };
}

/**
 * Check if DeAPI is configured with a valid API key.
 * Use this to conditionally show/hide DeAPI options in the UI.
 */
export const isDeApiConfigured = (): boolean => {
  return Boolean(API_KEY && API_KEY.trim().length > 0);
};

/**
 * Get a user-friendly message about DeAPI configuration status.
 */
export const getDeApiConfigMessage = (): string => {
  if (isDeApiConfigured()) {
    return "DeAPI is configured and ready to use.";
  }
  return (
    "DeAPI is not configured. To enable video animation:\n" +
    "1. Get an API key from https://deapi.ai\n" +
    "2. Add VITE_DEAPI_API_KEY=your_key to your .env.local file\n" +
    "3. Restart the development server"
  );
};

// Helper to convert Base64 to Blob/File
const base64ToBlob = async (base64Data: string): Promise<Blob> => {
  const base64Response = await fetch(base64Data);
  return await base64Response.blob();
};

async function pollRequest(requestId: string): Promise<string> {
  const maxAttempts = 120; // 4 minutes (2s interval)
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const response = await fetch(`${API_BASE}/request-status/${requestId}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Polling failed: ${response.status}`);
      continue;
    }

    const json = (await response.json()) as DeApiStatusResponse;
    const data = json.data;

    if (!data) {
      console.warn("No data in response");
      continue;
    }

    if (data.status === "done" && data.result_url) {
      return data.result_url;
    }

    if (data.status === "error") {
      throw new Error(data.error || "Generation failed at provider");
    }

    // Still pending or processing
    if (data.progress) {
      console.log(`DeAPI progress: ${data.progress}%`);
    }
  }

  throw new Error("Video generation timed out after 4 minutes");
}

// DeAPI has a max resolution of 768px on any dimension
const DEAPI_MAX_DIMENSION = 768;

/**
 * Calculate dimensions that fit within DeAPI's limits while preserving aspect ratio intent
 */
const getDeApiDimensions = (
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
): { width: number; height: number } => {
  // DeAPI requires dimensions divisible by 32 for video models
  switch (aspectRatio) {
    case "16:9":
      // Landscape: 704 x 400 (close to 16:9 ratio, divisible by 32)
      return { width: 704, height: 400 };
    case "9:16":
      // Portrait: 400 x 704 (close to 9:16 ratio, divisible by 32)
      return { width: 400, height: 704 };
    case "1:1":
      // Square: 512 x 512 (divisible by 32)
      return { width: 512, height: 512 };
    default:
      return { width: 512, height: 512 };
  }
};

export const animateImageWithDeApi = async (
  base64Image: string,
  prompt: string,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
): Promise<string> => {
  // Get dimensions that comply with DeAPI's max 768px limit
  const { width, height } = getDeApiDimensions(aspectRatio);
  if (!isDeApiConfigured()) {
    throw new Error(
      "DeAPI API key is not configured.\n\n" +
        "DeAPI is an optional video animation provider that converts still images to video loops.\n\n" +
        "To use DeAPI:\n" +
        "1. Get an API key from https://deapi.ai ($20 free credits for new accounts)\n" +
        "2. Add VITE_DEAPI_API_KEY=your_key to your .env.local file\n" +
        "3. Restart the development server (npm run dev:all)\n\n" +
        "Alternatives:\n" +
        "• Switch to 'Google Veo' as your video provider (requires paid Gemini API plan)\n" +
        "• Use 'Image' generation mode instead of video",
    );
  }

  // 1. Prepare Form Data
  const formData = new FormData();
  const imageBlob = await base64ToBlob(base64Image);

  formData.append("prompt", prompt);
  formData.append("first_frame_image", imageBlob, "frame0.png");
  formData.append("width", width.toString());
  formData.append("height", height.toString());
  formData.append("guidance", "7.5"); // Standard guidance scale
  formData.append("steps", "1"); // Distilled model (Ltxv_13B_0_9_8_Distilled_FP8) requires max 1 step
  formData.append("frames", "30"); // Minimum required by DeAPI is 30
  formData.append("fps", "30"); // Default FPS as per DeAPI docs
  formData.append("model", DEFAULT_MODEL);
  formData.append("seed", "-1"); // Use -1 for random seed as per API docs

  // 2. Submit Request
  const response = await fetch(`${API_BASE}/img2video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      // Content-Type is set automatically with boundary by fetch for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMessage = `DeAPI request failed (${response.status})`;

    try {
      const errJson = JSON.parse(errText);
      if (errJson.message) {
        errorMessage = `DeAPI: ${errJson.message}`;
      } else if (errJson.error) {
        errorMessage = `DeAPI: ${errJson.error}`;
      }
    } catch {
      if (errText) {
        errorMessage = `DeAPI: ${errText}`;
      }
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  const requestId = data.data?.request_id;

  if (!requestId) {
    throw new Error("No request_id received from DeAPI");
  }

  // 3. Poll for Result
  const videoUrl = await pollRequest(requestId);

  // 4. Download and convert to Base64 (for consistency with app architecture)
  // This avoids CORS issues in the Canvas/FFmpeg pipeline if the provider doesn't set headers.
  const vidResp = await fetch(videoUrl);

  if (!vidResp.ok) {
    throw new Error(`Failed to download generated video: ${vidResp.status}`);
  }

  const vidBlob = await vidResp.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Failed to convert video to base64"));
    reader.readAsDataURL(vidBlob);
  });
};
