import { GoogleGenAI, Type } from "@google/genai";
import { ImagePrompt, SubtitleItem } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to convert blob/file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/mp3;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: `Transcribe the lyrics of this audio file into standard SRT subtitle format.
            Rules:
            1. Use the format: ID [newline] HH:MM:SS,mmm --> HH:MM:SS,mmm [newline] Text
            2. Example timestamp: 00:00:15,500 --> 00:00:20,000
            3. Ensure milliseconds are separated by a comma.
            4. Do not include markdown code blocks.
            5. Return ONLY the raw SRT text.`
          }
        ]
      }
    });

    const text = response.text;
    if (!text) throw new Error("No transcription generated");
    
    // Cleanup simple markdown if model adds it despite instructions
    return text.replace(/^```srt\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

const parseTimeStringToSeconds = (timeStr: string): number => {
  if (!timeStr) return 0;
  try {
    const clean = timeStr.trim().replace(',', '.');
    const parts = clean.split(':').map(Number);
    
    if (parts.length === 3) {
      if (parts[2] >= 60) {
        return parts[0] * 60 + parts[1] + parts[2] / 1000;
      }
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  } catch (e) {
    return 0;
  }
};

export const generatePromptsFromLyrics = async (srtContent: string, style: string = "Cinematic"): Promise<ImagePrompt[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following SRT lyrics to create a professional visual storyboard for a music video. 
      Your goal is to generate a sequence of image prompts that capture the emotional and narrative essence of the song.

      Instructions:
      1. **Song Analysis**: Identify the song's structure (Intro, Verses, Chorus, Bridge, Outro) and emotional arc.
      2. **Visual Consistency**: All images must strictly adhere to the "${style}" art style. Maintain consistent themes or motifs if the lyrics suggest a recurring subject.
      3. **Prompt Engineering**: For each section, write a highly detailed prompt (60-100 words) that includes:
          - **Subject**: What is the main focus? (e.g., a lonely figure, a bustling city, a surreal landscape).
          - **Composition**: Specify camera angle and framing (e.g., wide-angle cinematic shot, extreme close-up, low-angle perspective).
          - **Lighting & Atmosphere**: Describe the light source and mood (e.g., soft morning light, dramatic chiaroscuro, neon-drenched atmosphere, ethereal glow).
          - **Color Palette**: Mention specific colors or tones (e.g., deep blues and purples, warm sepia tones, vibrant technicolor).
          - **Details**: Add textures, weather effects, or symbolic elements (e.g., falling rain, floating embers, intricate clockwork).
      4. **Negative Constraints**: DO NOT include any text, lyrics, logos, watermarks, or signatures in the prompts. Focus purely on visual imagery.
      5. **Quantity**: Generate between 8 to 12 prompts to ensure a smooth visual transition throughout the song.
      6. **Timing**: Align the 'timestamp' with the exact start of the corresponding section in the SRT.

      SRT Content:
      ${srtContent.slice(0, 15000)} 

      Return a JSON object with a 'prompts' array. Each item should have:
      - 'text': The detailed image generation prompt.
      - 'mood': A descriptive label (e.g., 'Chorus - Epic & Uplifting').
      - 'timestamp': The timestamp string from the SRT (e.g., '00:01:20,000').
      `,
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
    
    const parsed = JSON.parse(jsonStr);
    
    // Add IDs for React keys and parse seconds
    return parsed.prompts.map((p: any, index: number) => ({
      ...p,
      id: `prompt-${Date.now()}-${index}`,
      timestampSeconds: parseTimeStringToSeconds(p.timestamp)
    }));

  } catch (error) {
    console.error("Prompt generation error:", error);
    return []; // Return empty on error to not block the UI completely
  }
};

export const generateImageFromPrompt = async (promptText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A high-quality, professional digital art piece: ${promptText}` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          // imageSize not supported for flash-image, defaults apply
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};

export const translateSubtitles = async (subtitles: SubtitleItem[], targetLanguage: string): Promise<{id: number, translation: string}[]> => {
  try {
    // Minimize payload to just ID and Text to save tokens
    const simplifiedSubs = subtitles.map(s => ({ id: s.id, text: s.text }));
    
    // Process in chunks if too large (simplified logic: take first 100 lines for safety in this demo)
    // In production, would iterate chunks.
    const chunk = simplifiedSubs.slice(0, 150); 
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following song lyrics into ${targetLanguage}.
      Return a JSON object with a "translations" array containing objects with "id" and "translation".
      Maintain the poetic flow and meaning.
      
      Input:
      ${JSON.stringify(chunk)}`,
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
    if (!jsonStr) throw new Error("No translation generated");
    
    const parsed = JSON.parse(jsonStr);
    return parsed.translations;

  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
