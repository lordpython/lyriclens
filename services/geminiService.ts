import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ImagePrompt, SubtitleItem, WordTiming } from "../types";
import { parseSRTTimestamp } from "../utils/srtParser";

// --- Configuration ---
const API_KEY = process.env.API_KEY || '';
const MODELS = {
  TEXT: 'gemini-3-flash-preview', // Updated to latest stable flash model if available, or keep preview
  IMAGE: 'gemini-2.5-flash-image', // Using flash for images if supported, or falling back to specific image model
  // Note: Using the specific models from the original file to ensure compatibility, 
  // but moved to constants for easy updates.
  TRANSCRIPTION: 'gemini-3-pro-preview',
  TRANSLATION: 'gemini-3-flash-preview'
};

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helpers ---

/**
 * retry wrapper for AI calls.
 * Retries on 503 (Service Unavailable) or 429 (Too Many Requests).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.status === 429 || error.message?.includes('fetch failed'))) {
      console.warn(`API call failed. Retrying in ${delayMs}ms... (${retries} attempts left). Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs * backoffFactor, backoffFactor);
    }
    throw error;
  }
}

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Interfaces ---

interface TranscriptionLine {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  words: { word: string; start: number; end: number }[];
}

interface TranscriptionResponse {
  lines: TranscriptionLine[];
}

interface PromptResponseItem {
  text: string;
  mood: string;
  timestamp: string;
}

interface TranslationItem {
  id: number;
  translation: string;
}

// --- Main Services ---

/**
 * Transcribe audio with word-level timing using Gemini.
 */
export const transcribeAudioWithWordTiming = async (
  base64Audio: string,
  mimeType: string
): Promise<SubtitleItem[]> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MODELS.TRANSCRIPTION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            {
              text: `Transcribe the lyrics of this audio file with precise word-level timing.
  
  Return a JSON object with this structure:
  {
    "lines": [
      {
        "id": 1, "startTime": 0.0, "endTime": 3.5, "text": "Hello from the other side",
        "words": [ {"word": "Hello", "start": 0.0, "end": 0.8}, ... ]
      }
    ]
  }
  
  Rules:
  1. Times in SECONDS (e.g. 1.5).
  2. Each line is a natural phrase.
  3. word.start/end are exact.
  4. Be precise.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    startTime: { type: Type.NUMBER },
                    endTime: { type: Type.NUMBER },
                    text: { type: Type.STRING },
                    words: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          start: { type: Type.NUMBER },
                          end: { type: Type.NUMBER }
                        },
                        required: ["word", "start", "end"]
                      }
                    }
                  },
                  required: ["id", "startTime", "endTime", "text", "words"]
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No transcription generated");

      const parsed: TranscriptionResponse = JSON.parse(jsonStr);

      return parsed.lines.map((line): SubtitleItem => ({
        id: line.id,
        startTime: line.startTime,
        endTime: line.endTime,
        text: line.text,
        words: line.words.map((w): WordTiming => ({
          word: w.word,
          startTime: w.start,
          endTime: w.end
        }))
      }));

    } catch (error) {
      console.error("Word-level transcription error:", error);
      console.warn("Falling back to line-level SRT transcription...");
      const srt = await transcribeAudio(base64Audio, mimeType);
      const { parseSRT } = await import('../utils/srtParser');
      return parseSRT(srt);
    }
  });
};

/**
 * Fallback: transcribe to SRT format.
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TRANSCRIPTION,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          {
            text: `Transcribe lyrics to SRT format.
            Rules:
            1. Format: ID [newline] HH:MM:SS,mmm --> HH:MM:SS,mmm [newline] Text
            2. No markdown blocks. Return ONLY raw SRT text.`
          }
        ]
      }
    });

    const text = response.text;
    if (!text) throw new Error("No transcription generated");
    return text.replace(/^```srt\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
  });
};

export const generatePromptsFromLyrics = async (srtContent: string, style: string = "Cinematic"): Promise<ImagePrompt[]> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: `Analyze these SRT lyrics to create a visual storyboard. Art Style: "${style}".
        
        Instructions:
        1. Identify song structure.
        2. Visual Consistency: maintain specific style without text/logos.
        3. Generate 8-12 detailed prompts (60-100 words each).
        4. Align timestamp with section start.
  
        SRT Content:
        ${srtContent.slice(0, 15000)} 
  
        Return JSON object with 'prompts' array. Each item: { text, mood, timestamp }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    mood: { type: Type.STRING },
                    timestamp: { type: Type.STRING },
                  },
                  required: ["text", "mood", "timestamp"]
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No prompts generated");

      const parsed = JSON.parse(jsonStr) as { prompts: PromptResponseItem[] };

      return parsed.prompts.map((p, index: number) => ({
        text: p.text,
        mood: p.mood,
        timestamp: p.timestamp,
        id: `prompt-${Date.now()}-${index}`,
        timestampSeconds: parseSRTTimestamp(p.timestamp) ?? 0
      }));

    } catch (error) {
      console.error("Prompt generation error:", error);
      return [];
    }
  });
};

export const generatePromptsFromStory = async (srtContent: string, style: string = "Cinematic"): Promise<ImagePrompt[]> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: `Analyze this spoken-word transcript (Story/Documentary/Ad) to create a visual storyboard. Art Style: "${style}".
        
        Instructions:
        1. Identify narrative segments (Intro, Scene changes, Key concepts).
        2. Visual Consistency: maintain specific style. No text/logos.
        3. Generate 8-12 detailed prompts (60-100 words each).
        4. Align timestamp with the start of the concept/scene.
  
        Transcript:
        ${srtContent.slice(0, 15000)} 
  
        Return JSON object with 'prompts' array. Each item: { text, mood, timestamp }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    mood: { type: Type.STRING },
                    timestamp: { type: Type.STRING },
                  },
                  required: ["text", "mood", "timestamp"]
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No prompts generated");

      const parsed = JSON.parse(jsonStr) as { prompts: PromptResponseItem[] };

      return parsed.prompts.map((p, index: number) => ({
        text: p.text,
        mood: p.mood,
        timestamp: p.timestamp,
        id: `prompt-${Date.now()}-${index}`,
        timestampSeconds: parseSRTTimestamp(p.timestamp) ?? 0
      }));

    } catch (error) {
      console.error("Story prompt generation error:", error);
      return [];
    }
  });
};

export const generateImageFromPrompt = async (promptText: string): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE, // Ensure this model supports image generation or use a specific one
      contents: {
        parts: [
          { text: `High-quality digital art: ${promptText}` }
        ]
      },
      // Note: 'imageConfig' might be specific to certain models/SDK versions. 
      // If using a generic model, we might need a different approach, but keeping consistent with previous code.
      config: {
        // @ts-ignore - SDK types might be lagging for experimental image fields
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response");
  });
};

/**
 * Translate subtitles with batching to handle long songs.
 */
export const translateSubtitles = async (
  subtitles: SubtitleItem[],
  targetLanguage: string
): Promise<{ id: number, translation: string }[]> => {

  // 1. Batching
  const BATCH_SIZE = 50;
  const simplifiedSubs = subtitles.map(s => ({ id: s.id, text: s.text }));
  const chunks = [];

  for (let i = 0; i < simplifiedSubs.length; i += BATCH_SIZE) {
    chunks.push(simplifiedSubs.slice(i, i + BATCH_SIZE));
  }

  console.log(`Translating ${subtitles.length} lines in ${chunks.length} batches...`);

  const processBatch = async (batch: typeof simplifiedSubs) => {
    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODELS.TRANSLATION,
        contents: `Translate these lyrics into ${targetLanguage}.
        Return JSON object with "translations" array [{ id, translation }].
        Keep poetic flow.
        
        Input:
        ${JSON.stringify(batch)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    translation: { type: Type.STRING }
                  },
                  required: ["id", "translation"]
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No translation generated for batch");

      const parsed = JSON.parse(jsonStr) as { translations: TranslationItem[] };
      return parsed.translations;
    });
  };

  try {
    // 2. Parallel Processing with concurrency limit could be added,
    // but simplified Promise.all is okay for small batch counts (e.g. < 10 batches)
    const results = await Promise.all(chunks.map(chunk => processBatch(chunk)));

    // 3. Flatten results
    return results.flat().sort((a, b) => a.id - b.id);

  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
