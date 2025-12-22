import { GoogleGenAI, Type } from "@google/genai";
import { ImagePrompt, SubtitleItem, WordTiming } from "../types";
import { parseSRTTimestamp } from "../utils/srtParser";

// --- Configuration ---
// Prefer the documented env var, but keep backward compatibility.
const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.API_KEY ||
  "";

const MODELS = {
  TEXT: "gemini-3-flash-preview",
  IMAGE: "gemini-2.5-flash-image",
  VIDEO: "veo-3.0-fast-generate-001", // Use Veo 3 fast model for video generation
  TRANSCRIPTION: "gemini-3-flash-preview",
  TRANSLATION: "gemini-3-flash-preview",
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

type PromptRefinementIntent =
  | "auto"
  | "more_detailed"
  | "more_cinematic"
  | "more_consistent_subject"
  | "shorten"
  | "fix_repetition";

/**
 * Video purpose/platform - dramatically affects visual style and pacing
 */
export type VideoPurpose =
  | "music_video" // Cinematic, emotional, longer scenes
  | "social_short" // TikTok/Reels/Shorts - fast cuts, bold visuals, vertical-friendly
  | "documentary" // Realistic, informative, b-roll style
  | "commercial" // Product-focused, clean, persuasive
  | "podcast_visual" // Minimal, ambient, non-distracting
  | "lyric_video"; // Text-friendly spaces, typography-aware compositions

/**
 * Camera angles for visual variety
 */
const CAMERA_ANGLES = [
  "wide establishing shot",
  "medium shot",
  "close-up",
  "extreme close-up on details",
  "low angle looking up",
  "high angle looking down",
  "over-the-shoulder",
  "dutch angle",
  "tracking shot",
  "aerial/drone view",
];

/**
 * Lighting moods for emotional progression
 */
const LIGHTING_MOODS = [
  "golden hour warm lighting",
  "cool blue moonlight",
  "dramatic chiaroscuro shadows",
  "soft diffused overcast",
  "neon-lit urban glow",
  "harsh midday sun",
  "candlelit intimate warmth",
  "silhouette backlighting",
  "foggy atmospheric haze",
  "studio three-point lighting",
];

type PromptLintIssueCode =
  | "too_short"
  | "too_long"
  | "repetitive"
  | "missing_subject"
  | "contains_text_instruction"
  | "contains_logos_watermarks"
  | "weak_visual_specificity";

interface PromptLintIssue {
  code: PromptLintIssueCode;
  message: string;
  severity: "warn" | "error";
}

const DEFAULT_NEGATIVE_CONSTRAINTS = [
  "no text",
  "no subtitles",
  "no watermark",
  "no logo",
  "no brand names",
  "no split-screen",
  "no collage",
  "no UI elements",
  "no distorted anatomy",
  "no extra limbs",
  "no deformed hands",
  "no blurry face",
  "no melted faces",
];

function normalizeForSimilarity(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`"'.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function jaccardSimilarity(a: string, b: string): number {
  const sa = new Set(normalizeForSimilarity(a).split(" ").filter(Boolean));
  const sb = new Set(normalizeForSimilarity(b).split(" ").filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;

  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function lintPrompt(params: {
  promptText: string;
  globalSubject?: string;
  previousPrompts?: string[];
}): PromptLintIssue[] {
  const { promptText, globalSubject, previousPrompts } = params;
  const issues: PromptLintIssue[] = [];

  const words = countWords(promptText);

  if (words < 18) {
    issues.push({
      code: "too_short",
      message:
        "Prompt is very short; add setting, lighting, camera/composition, and mood to reduce generic outputs.",
      severity: "warn",
    });
  }

  if (words > 180) {
    issues.push({
      code: "too_long",
      message:
        "Prompt is very long; consider removing redundant adjectives to reduce model confusion.",
      severity: "warn",
    });
  }

  const norm = normalizeForSimilarity(promptText);

  if (/\btext\b|\bsubtitles\b|\bcaption\b|\btypography\b/.test(norm)) {
    issues.push({
      code: "contains_text_instruction",
      message:
        "Prompt mentions text/subtitles/typography; this often causes unwanted text in images.",
      severity: "warn",
    });
  }

  if (/\blogo\b|\bwatermark\b|\bbrand\b/.test(norm)) {
    issues.push({
      code: "contains_logos_watermarks",
      message:
        "Prompt mentions logos/watermarks/brands; this often increases unwanted marks in images.",
      severity: "warn",
    });
  }

  const hasVisualAnchors =
    /\b(lighting|lit|glow|neon|sunset|dawn|fog|mist|smoke)\b/.test(norm) ||
    /\b(close-up|wide shot|medium shot|portrait|overhead|low angle|high angle)\b/.test(
      norm,
    ) ||
    /\b(color palette|palette|monochrome|pastel|vibrant|muted)\b/.test(norm) ||
    /\b(depth of field|bokeh|lens|35mm|50mm|anamorphic)\b/.test(norm);

  if (!hasVisualAnchors) {
    issues.push({
      code: "weak_visual_specificity",
      message:
        "Prompt lacks visual anchors (camera, lighting, palette). Add at least 1–2 to improve composition consistency.",
      severity: "warn",
    });
  }

  if (globalSubject && globalSubject.trim().length > 0) {
    const subjNorm = normalizeForSimilarity(globalSubject);
    const subjectTokens = subjNorm.split(" ").filter(Boolean);
    const missingCount = subjectTokens.filter(
      (t) => t.length >= 4 && !norm.includes(t),
    ).length;

    // If the prompt doesn't echo enough of the subject, consistency tends to drift.
    if (
      subjectTokens.length >= 2 &&
      missingCount / subjectTokens.length > 0.6
    ) {
      issues.push({
        code: "missing_subject",
        message:
          "Prompt doesn’t strongly reference your Global Subject; this can cause character/object drift across scenes.",
        severity: "warn",
      });
    }
  }

  if (previousPrompts && previousPrompts.length > 0) {
    const sims = previousPrompts.map((p) => jaccardSimilarity(p, promptText));
    const maxSim = Math.max(...sims);
    if (maxSim >= 0.72) {
      issues.push({
        code: "repetitive",
        message:
          "Prompt is very similar to another scene; vary setting/camera/lighting to avoid repetitive images.",
        severity: "warn",
      });
    }
  }

  return issues;
}

async function refineImagePromptWithAI(params: {
  promptText: string;
  style: string;
  globalSubject?: string;
  aspectRatio?: string;
  intent?: PromptRefinementIntent;
  issues?: PromptLintIssue[];
}): Promise<string> {
  const {
    promptText,
    style,
    globalSubject = "",
    aspectRatio = "16:9",
    intent = "auto",
    issues = [],
  } = params;

  const issueSummary =
    issues.length > 0
      ? issues.map((i) => `- (${i.code}) ${i.message}`).join("\n")
      : "- (none)";

  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: `You are a prompt engineer for high-quality image generation.
Rewrite the user's prompt to improve visual clarity, cinematic composition, and subject consistency while preserving intent.

Global Subject (must remain consistent across scenes):
${globalSubject ? globalSubject : "(none)"}

Chosen Style Preset:
${style}

Aspect Ratio:
${aspectRatio}

User Intent:
${intent}

Detected Issues:
${issueSummary}

Requirements:
- Output ONLY a JSON object: { "prompt": string }.
- Keep it a single prompt suitable for an image model.
- Make it vivid and specific (setting, lighting, camera/composition, color palette, mood).
- Keep style consistent with the chosen preset.
- Do NOT include any text/typography/subtitles/logos/watermarks instructions.
- If Global Subject is provided, restate its key identifiers (face/outfit/materials) so the subject stays consistent.
- Avoid repeating generic phrases like "highly detailed" or "stunning" too much.
- Keep length 60–120 words.

User Prompt:
${promptText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
        },
        required: ["prompt"],
      },
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) return promptText;

  try {
    const parsed = JSON.parse(jsonStr) as { prompt: string };
    return parsed.prompt?.trim() ? parsed.prompt.trim() : promptText;
  } catch {
    return promptText;
  }
}

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
 * Get purpose-specific instructions for prompt generation
 */
const getPurposeGuidance = (purpose: VideoPurpose): string => {
  const guidance: Record<VideoPurpose, string> = {
    music_video: `
PURPOSE: Music Video (Cinematic, Emotional)
- Create dramatic, emotionally resonant scenes that amplify the music's feeling
- Use cinematic compositions with depth and layers
- Match visual intensity to musical intensity (verse=calm, chorus=dynamic)
- Aim for 4-6 second average scene duration
- Include atmospheric elements (particles, light rays, reflections)`,

    social_short: `
PURPOSE: Social Media Short (TikTok/Reels/Shorts)
- Bold, eye-catching visuals that pop on small screens
- High contrast, vibrant colors, immediate visual impact
- Fast-paced energy, dynamic compositions
- Vertical-friendly framing (subject centered, minimal side detail)
- Trendy aesthetics, modern and relatable imagery`,

    documentary: `
PURPOSE: Documentary/Educational
- Realistic, grounded visuals that inform and explain
- B-roll style imagery that supports narration
- Clear, unambiguous scenes that illustrate concepts
- Professional, trustworthy aesthetic
- Mix of wide establishing shots and detail close-ups`,

    commercial: `
PURPOSE: Commercial/Advertisement
- Clean, polished, aspirational imagery
- Product/subject should be hero of each frame
- Lifestyle-oriented scenes showing benefits/emotions
- Professional lighting, minimal distractions
- Call-to-action friendly compositions`,

    podcast_visual: `
PURPOSE: Podcast/Audio Visualization
- Ambient, non-distracting background visuals
- Abstract or environmental scenes
- Calm, steady imagery that doesn't compete with spoken content
- Subtle movement potential, meditative quality
- Longer scene durations (8-15 seconds)`,

    lyric_video: `
PURPOSE: Lyric Video
- Compositions with clear negative space for text overlay
- Avoid busy centers where lyrics will appear
- Backgrounds that provide contrast for readability
- Thematic imagery that supports but doesn't overwhelm
- Consider lower-third and center-frame text placement areas`,
  };

  return guidance[purpose] || guidance.music_video;
};

/**
 * Enhanced prompt generation instruction with visual storytelling
 */
const getPromptGenerationInstruction = (
  style: string,
  mode: "lyrics" | "story",
  content: string,
  globalSubject: string = "",
  purpose: VideoPurpose = "music_video",
) => {
  const contentType =
    mode === "lyrics" ? "song lyrics" : "spoken-word/narrative transcript";
  const purposeGuidance = getPurposeGuidance(purpose);

  const subjectBlock = globalSubject.trim()
    ? `
MAIN SUBJECT (must appear consistently in relevant scenes):
"${globalSubject}"
- Keep this subject's appearance, clothing, and key features consistent
- Reference specific visual details (hair color, outfit, distinguishing features)
- The subject should be the visual anchor across scenes`
    : `
MAIN SUBJECT: None specified
- Create cohesive scenes with consistent environmental/thematic elements
- If characters appear, maintain their appearance across scenes`;

  const structureGuidance =
    mode === "lyrics"
      ? `
SONG STRUCTURE ANALYSIS:
1. Identify sections: Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro
2. Verses = introspective, storytelling, character moments
3. Choruses = emotional peaks, dynamic visuals, wider shots
4. Bridge = visual contrast, unexpected angle or setting
5. Match energy: quiet sections → intimate close-ups; loud sections → epic wide shots`
      : `
NARRATIVE STRUCTURE ANALYSIS:
1. Identify segments: Introduction, Key Points, Transitions, Conclusion
2. Opening = establishing context, setting the scene
3. Main content = illustrating concepts, showing examples
4. Transitions = visual bridges between ideas
5. Conclusion = reinforcing main message, memorable closing image`;

  const visualVariety = `
VISUAL VARIETY REQUIREMENTS:
- Camera angles to use across scenes: ${CAMERA_ANGLES.slice(0, 6).join(", ")}
- Lighting variations: ${LIGHTING_MOODS.slice(0, 5).join(", ")}
- NEVER repeat the same camera angle in consecutive scenes
- Create an emotional arc: establish → build → climax → resolve
- Each prompt must specify: subject, action/pose, setting, lighting, camera angle, mood`;

  return `You are a professional music video director and visual storyteller creating an image storyboard.

TASK: Analyze this ${contentType} and generate a visual storyboard with detailed image prompts.

ART STYLE: "${style}"
${subjectBlock}
${purposeGuidance}
${structureGuidance}
${visualVariety}

PROMPT WRITING RULES:
1. Each prompt must be 60-120 words with SPECIFIC visual details
2. Include: subject + action + environment + lighting + camera angle + atmosphere
3. NO text, typography, subtitles, logos, watermarks, or UI elements
4. NO generic phrases like "beautiful", "stunning", "amazing" - be SPECIFIC
5. Reference the main subject by their specific features, not just "the subject"
6. Vary compositions: rule-of-thirds, centered, symmetrical, asymmetrical
7. Include sensory details: textures, materials, weather, time of day

EMOTIONAL ARC:
- Scene 1-2: Establish mood and setting (wide shots, context)
- Scene 3-5: Build intensity (medium shots, character focus)
- Scene 6-8: Peak emotion (dynamic angles, close-ups, action)
- Scene 9-12: Resolution/reflection (pull back, contemplative)

CONTENT TO ANALYZE:
${content.slice(0, 15000)}

OUTPUT: Generate 8-12 prompts as JSON with 'prompts' array.
Each item: { "text": "detailed visual prompt", "mood": "emotional tone", "timestamp": "MM:SS" }

Timestamps should align with natural section breaks in the content.`;
};

const generatePrompts = async (
  srtContent: string,
  style: string,
  mode: "lyrics" | "story",
  globalSubject: string = "",
  purpose: VideoPurpose = "music_video",
): Promise<ImagePrompt[]> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: getPromptGenerationInstruction(
          style,
          mode,
          srtContent,
          globalSubject,
          purpose,
        ),
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
                  required: ["text", "mood", "timestamp"],
                },
              },
            },
          },
        },
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No prompts generated");

      const parsed = JSON.parse(jsonStr) as { prompts: PromptResponseItem[] };

      return parsed.prompts.map((p, index: number) => ({
        text: p.text,
        mood: p.mood,
        timestamp: p.timestamp,
        id: `prompt-${Date.now()}-${index}`,
        timestampSeconds: parseSRTTimestamp(p.timestamp) ?? 0,
      }));
    } catch (error) {
      console.error("Prompt generation error:", error);
      return [];
    }
  });
};

export const generatePromptsFromLyrics = (
  srtContent: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  purpose: VideoPurpose = "music_video",
) => generatePrompts(srtContent, style, "lyrics", globalSubject, purpose);

export const generatePromptsFromStory = (
  srtContent: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  purpose: VideoPurpose = "documentary",
) => generatePrompts(srtContent, style, "story", globalSubject, purpose);

export const refineImagePrompt = async (params: {
  promptText: string;
  style?: string;
  globalSubject?: string;
  aspectRatio?: string;
  intent?: PromptRefinementIntent;
  previousPrompts?: string[];
}): Promise<{ refinedPrompt: string; issues: PromptLintIssue[] }> => {
  const {
    promptText,
    style = "Cinematic",
    globalSubject = "",
    aspectRatio = "16:9",
    intent = "auto",
    previousPrompts = [],
  } = params;

  const issues = lintPrompt({ promptText, globalSubject, previousPrompts });

  // Only run an AI rewrite if it looks low quality or the user explicitly requests a change.
  const shouldRefine =
    intent !== "auto" ||
    issues.some(
      (i) =>
        i.code === "too_short" ||
        i.code === "repetitive" ||
        i.code === "missing_subject",
    );

  if (!shouldRefine) {
    return { refinedPrompt: promptText.trim(), issues };
  }

  const refinedPrompt = await withRetry(async () => {
    return refineImagePromptWithAI({
      promptText,
      style,
      globalSubject,
      aspectRatio,
      intent,
      issues,
    });
  });

  return { refinedPrompt, issues };
};

export const generateImageFromPrompt = async (
  promptText: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  aspectRatio: string = "16:9",
  /** Skip AI refinement if the prompt was already refined upstream (e.g., bulk generation) */
  skipRefine: boolean = false,
): Promise<string> => {
  return withRetry(async () => {
    const styleModifiers: Record<string, string> = {
      Cinematic:
        "Cinematic movie still, 35mm film grain, anamorphic lens flare, hyper-realistic, dramatic lighting, 8k resolution",
      "Anime / Manga":
        "High-quality Anime style, Studio Ghibli aesthetic, vibrant colors, detailed backgrounds, cel shaded, expressive",
      Cyberpunk:
        "Futuristic cyberpunk city style, neon lights, rain-slicked streets, high contrast, blade runner vibe, technological",
      Watercolor:
        "Soft watercolor painting, artistic brush strokes, paper texture, bleeding colors, dreamy atmosphere",
      "Oil Painting":
        "Classic oil painting, thick impasto, visible brushwork, texture, rich colors, classical composition",
      "Pixel Art":
        "High quality pixel art, 16-bit retro game style, dithering, vibrant colors",
      Surrealist:
        "Surrealist art style, dreamlike, Dali-esque, impossible geometry, symbolic, mysterious",
      "Dark Fantasy":
        "Dark fantasy art, grimdark, gothic atmosphere, misty, detailed textures, eldritch",
      "Commercial / Ad":
        "Professional product photography, studio lighting, clean background, macro details, commercial aesthetic, 4k, sharp focus, advertising standard",
      "Minimalist / Tutorial":
        "Clean vector illustration, flat design, isometric perspective, white background, educational style, clear visibility, infographic aesthetic",
      "Comic Book":
        "American comic book style, dynamic action lines, bold ink outlines, halftone patterns, vibrant superhero colors, expressive",
      "Corporate / Brand":
        "Modern corporate memphis style, flat vector, clean lines, professional, trustworthy, blue and white color palette, tech startup aesthetic",
      Photorealistic:
        "Raw photo, hyper-realistic, DSLR, 50mm lens, depth of field, natural lighting, unedited footage style",
    };

    const modifier = styleModifiers[style] || styleModifiers["Cinematic"];

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
    const styleModifiers: Record<string, string> = {
      Cinematic:
        "Cinematic movie shot, slow camera movement, 35mm film grain, hyper-realistic, dramatic lighting, 8k resolution",
      "Anime / Manga":
        "High-quality Anime animation, Studio Ghibli style, moving clouds, wind effects, vibrant colors",
      Cyberpunk:
        "Futuristic cyberpunk city, neon lights flickering, rain falling, flying cars, high contrast",
      Watercolor:
        "Animated watercolor painting, flowing paint, artistic brush strokes, paper texture, bleeding colors",
      "Oil Painting":
        "Living oil painting, shifting textures, visible brushwork, classical composition",
      "Pixel Art":
        "Animated pixel art, 16-bit retro game loop, dithering, vibrant colors",
      Surrealist:
        "Surrealist dreamscape, morphing shapes, impossible geometry, mysterious atmosphere",
      "Dark Fantasy":
        "Dark fantasy atmosphere, rolling fog, flickering torches, grimdark, detailed textures",
      "Commercial / Ad":
        "Professional product b-roll, smooth slider shot, studio lighting, clean background, 4k",
      "Minimalist / Tutorial":
        "Clean motion graphics, animated vector illustration, flat design, smooth transitions",
      "Comic Book":
        "Motion comic style, dynamic action, bold ink outlines, halftone patterns",
      "Corporate / Brand":
        "Modern corporate motion graphics, kinetic typography background, clean lines, professional",
      Photorealistic:
        "Raw video footage, handheld camera, natural lighting, unedited style",
    };

    const modifier = styleModifiers[style] || styleModifiers["Cinematic"];

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
          durationSeconds: 5,
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

export const translateSubtitles = async (
  subtitles: SubtitleItem[],
  targetLanguage: string,
): Promise<{ id: number; translation: string }[]> => {
  const BATCH_SIZE = 50;
  const simplifiedSubs = subtitles.map((s) => ({ id: s.id, text: s.text }));
  const chunks = [];

  for (let i = 0; i < simplifiedSubs.length; i += BATCH_SIZE) {
    chunks.push(simplifiedSubs.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Translating ${subtitles.length} lines in ${chunks.length} batches...`,
  );

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
                    translation: { type: Type.STRING },
                  },
                  required: ["id", "translation"],
                },
              },
            },
          },
        },
      });

      const jsonStr = response.text;
      if (!jsonStr) throw new Error("No translation generated for batch");

      const parsed = JSON.parse(jsonStr) as { translations: TranslationItem[] };
      return parsed.translations;
    });
  };

  try {
    const results = await Promise.all(
      chunks.map((chunk) => processBatch(chunk)),
    );
    return results.flat().sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
