import { GoogleGenAI, Type } from "@google/genai";
import { ImagePrompt, SubtitleItem, WordTiming } from "../types";
import { parseSRTTimestamp } from "../utils/srtParser";

// --- Configuration ---
const API_KEY = process.env.API_KEY || '';
const MODELS = {
  TEXT: 'gemini-3-flash-preview',
  IMAGE: 'gemini-2.5-flash-image',
  TRANSCRIPTION: 'gemini-3-pro-preview',
  TRANSLATION: 'gemini-3-flash-preview'
};

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helpers ---

/**
 * retry wrapper for AI calls.
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

const getPromptGenerationInstruction = (style: string, mode: 'lyrics' | 'story', content: string) => {
  const baseInstruction = `Analyze this ${mode === 'lyrics' ? 'SRT lyrics' : 'spoken-word transcript'} to create a visual storyboard. Art Style: "${style}".`;
  
  const specificInstruction = mode === 'lyrics'
    ? `1. Identify song structure.
       2. Visual Consistency: maintain specific style without text/logos.
       3. Generate 8-12 detailed prompts (60-100 words each).
       4. Align timestamp with section start.`
    : `1. Identify narrative segments (Intro, Scene changes, Key concepts).
       2. Visual Consistency: maintain specific style. No text/logos.
       3. Generate 8-12 detailed prompts (60-100 words each).
       4. Align timestamp with the start of the concept/scene.`;

  return `${baseInstruction}
  
  Instructions:
  ${specificInstruction}

  Content:
  ${content.slice(0, 15000)} 

  Return JSON object with 'prompts' array. Each item: { text, mood, timestamp }`;
};

const generatePrompts = async (srtContent: string, style: string, mode: 'lyrics' | 'story'): Promise<ImagePrompt[]> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: getPromptGenerationInstruction(style, mode, srtContent),
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

export const generatePromptsFromLyrics = (srtContent: string, style: string = "Cinematic") => 
  generatePrompts(srtContent, style, 'lyrics');

export const generatePromptsFromStory = (srtContent: string, style: string = "Cinematic") => 
  generatePrompts(srtContent, style, 'story');

export const generateImageFromPrompt = async (promptText: string, style: string = "Cinematic", globalSubject: string = "", aspectRatio: string = "16:9"): Promise<string> => {
  return withRetry(async () => {
    const styleModifiers: Record<string, string> = {
      "Cinematic": "Cinematic movie still, 35mm film grain, anamorphic lens flare, hyper-realistic, dramatic lighting, 8k resolution",
      "Anime / Manga": "High-quality Anime style, Studio Ghibli aesthetic, vibrant colors, detailed backgrounds, cel shaded, expressive",
      "Cyberpunk": "Futuristic cyberpunk city style, neon lights, rain-slicked streets, high contrast, blade runner vibe, technological",
      "Watercolor": "Soft watercolor painting, artistic brush strokes, paper texture, bleeding colors, dreamy atmosphere",
      "Oil Painting": "Classic oil painting, thick impasto, visible brushwork, texture, rich colors, classical composition",
      "Pixel Art": "High quality pixel art, 16-bit retro game style, dithering, vibrant colors",
      "Surrealist": "Surrealist art style, dreamlike, Dali-esque, impossible geometry, symbolic, mysterious",
      "Dark Fantasy": "Dark fantasy art, grimdark, gothic atmosphere, misty, detailed textures, eldritch",
      "Commercial / Ad": "Professional product photography, studio lighting, clean background, macro details, commercial aesthetic, 4k, sharp focus, advertising standard",
      "Minimalist / Tutorial": "Clean vector illustration, flat design, isometric perspective, white background, educational style, clear visibility, infographic aesthetic",
      "Comic Book": "American comic book style, dynamic action lines, bold ink outlines, halftone patterns, vibrant superhero colors, expressive",
      "Corporate / Brand": "Modern corporate memphis style, flat vector, clean lines, professional, trustworthy, blue and white color palette, tech startup aesthetic",
      "Photorealistic": "Raw photo, hyper-realistic, DSLR, 50mm lens, depth of field, natural lighting, unedited footage style"
    };

    const modifier = styleModifiers[style] || styleModifiers["Cinematic"];
    const subjectContext = globalSubject ? `Main Subject: ${globalSubject}. ` : "";
    
    const finalPrompt = `
      Create an image with this style: ${modifier}.
      
      Scene Content: ${subjectContext}${promptText}
      
      Requirements:
      - High quality, professional composition.
      - Adhere strictly to the requested art style.
      - NO text, NO watermarks, NO logos, NO split screens.
      - NO distorted anatomy or blurry faces.
    `.trim();

    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: { parts: [{ text: finalPrompt }] },
      config: {
        // @ts-ignore
        imageConfig: { aspectRatio: aspectRatio }
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

export const translateSubtitles = async (
  subtitles: SubtitleItem[],
  targetLanguage: string
): Promise<{ id: number, translation: string }[]> => {
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
    const results = await Promise.all(chunks.map(chunk => processBatch(chunk)));
    return results.flat().sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};