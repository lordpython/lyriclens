/**
 * Transcription Service
 * Handles audio transcription functionality using Gemini AI.
 */

import { Type } from "@google/genai";
import { SubtitleItem, WordTiming } from "../types";
import { ai, MODELS, withRetry } from "./shared/apiClient";

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

// --- Helper Functions ---

/**
 * Convert a File to base64 string for use with Gemini API.
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Main Services ---

/**
 * Transcribe audio to SRT format.
 */
export const transcribeAudio = async (
  base64Audio: string,
  mimeType: string,
): Promise<string> => {
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
            2. No markdown blocks. Return ONLY raw SRT text.`,
          },
        ],
      },
    });

    const text = response.text;
    if (!text) throw new Error("No transcription generated");
    return text
      .replace(/^```srt\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "");
  });
};

/**
 * Transcribe audio with word-level timing.
 * Falls back to line-level SRT transcription if word-level fails.
 */
export const transcribeAudioWithWordTiming = async (
  base64Audio: string,
  mimeType: string,
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
  4. Be precise.`,
            },
          ],
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
                          end: { type: Type.NUMBER },
                        },
                        required: ["word", "start", "end"],
                      },
                    },
                  },
                  required: ["id", "startTime", "endTime", "text", "words"],
                },
              },
            },
          },
        },
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No transcription generated");

      const parsed: TranscriptionResponse = JSON.parse(jsonStr);

      return parsed.lines.map(
        (line): SubtitleItem => ({
          id: line.id,
          startTime: line.startTime,
          endTime: line.endTime,
          text: line.text,
          words: line.words.map(
            (w): WordTiming => ({
              word: w.word,
              startTime: w.start,
              endTime: w.end,
            }),
          ),
        }),
      );
    } catch (error) {
      console.error("Word-level transcription error:", error);
      console.warn("Falling back to line-level SRT transcription...");
      const srt = await transcribeAudio(base64Audio, mimeType);
      const { parseSRT } = await import("../utils/srtParser");
      return parseSRT(srt);
    }
  });
};
