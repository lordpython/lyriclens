/**
 * Prompt Service
 * Handles prompt generation and refinement for image/video generation.
 */

import { Type } from "@google/genai";
import { ImagePrompt } from "../types";
import { parseSRTTimestamp } from "../utils/srtParser";
import { ai, MODELS, withRetry } from "./shared/apiClient";
import { CAMERA_ANGLES, LIGHTING_MOODS, VideoPurpose } from "../constants";

// --- Types ---

export type PromptRefinementIntent =
  | "auto"
  | "more_detailed"
  | "more_cinematic"
  | "more_consistent_subject"
  | "shorten"
  | "fix_repetition";

// --- Persona System Types ---

export type PersonaType = "brand_specialist" | "visual_poet" | "historian" | "viral_creator";

export interface Persona {
  type: PersonaType;
  name: string;
  role: string;
  coreRule: string;
  visualPrinciples: string[];
  avoidList: string[];
}

// --- Lint Issue Types ---

export type PromptLintIssueCode =
  | "too_short"
  | "too_long"
  | "repetitive"
  | "missing_subject"
  | "contains_text_instruction"
  | "contains_logos_watermarks"
  | "weak_visual_specificity"
  | "generic_conflict";

export interface PromptLintIssue {
  code: PromptLintIssueCode;
  message: string;
  severity: "warn" | "error";
}

interface PromptResponseItem {
  text: string;
  mood: string;
  timestamp: string;
}

// --- Helper Functions ---

/**
 * Normalize a string for similarity comparison.
 */
export function normalizeForSimilarity(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`"'.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Count words in a string.
 */
export function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Calculate Jaccard similarity between two strings.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const sa = new Set(normalizeForSimilarity(a).split(" ").filter(Boolean));
  const sb = new Set(normalizeForSimilarity(b).split(" ").filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;

  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// --- Persona System ---

/**
 * Get the AI persona based on video purpose.
 * Each persona has specific rules for visual interpretation.
 */
export function getSystemPersona(purpose: VideoPurpose): Persona {
  const personas: Record<VideoPurpose, Persona> = {
    commercial: {
      type: "brand_specialist",
      name: "Brand Specialist",
      role: "Commercial Visual Director",
      coreRule: "Show products and subjects with clean, aspirational visuals. No metaphors - literal product shots only.",
      visualPrinciples: [
        "Hero product shots with professional lighting",
        "Clean, uncluttered compositions",
        "Lifestyle context showing benefits",
        "High production value aesthetic",
        "Call-to-action friendly framing",
      ],
      avoidList: [
        "Abstract metaphors",
        "Artistic interpretations that obscure the product",
        "Dark or moody lighting that hides details",
        "Busy backgrounds that distract from subject",
      ],
    },
    music_video: {
      type: "visual_poet",
      name: "Visual Poet",
      role: "Music Video Director",
      coreRule: "METAPHOR LITERALISM: If the lyrics say 'candle', show an actual candle. If they say 'fire', show real fire. The object IS the metaphor - do not replace concrete objects with abstract interpretations.",
      visualPrinciples: [
        "Literal visualization of mentioned objects",
        "Emotional resonance through cinematography",
        "Deep atmospheric compositions",
        "Symbolic objects shown as physical reality",
        "Visual rhythm matching musical structure",
      ],
      avoidList: [
        "Replacing concrete objects with generic scenes",
        "Showing 'sad person' when lyrics mention 'candle'",
        "Abstract interpretations that ignore specific imagery",
        "Generic couple scenes for emotional content",
      ],
    },
    documentary: {
      type: "historian",
      name: "Historian",
      role: "Documentary Visualizer",
      coreRule: "Prioritize realism and accuracy. Every visual must be grounded in reality and support the factual narrative.",
      visualPrinciples: [
        "Realistic, documentary-style imagery",
        "Historical accuracy when applicable",
        "Educational clarity",
        "B-roll style supporting visuals",
        "Professional, trustworthy aesthetic",
      ],
      avoidList: [
        "Stylized or fantastical interpretations",
        "Emotional manipulation through unrealistic imagery",
        "Artistic license that distorts facts",
        "Dramatic embellishments",
      ],
    },
    social_short: {
      type: "viral_creator",
      name: "Viral Creator",
      role: "Social Media Visual Specialist",
      coreRule: "Create scroll-stopping visuals with immediate impact. First frame must hook the viewer.",
      visualPrinciples: [
        "Bold, high-contrast visuals",
        "Trending aesthetic references",
        "Vertical-friendly compositions",
        "Dynamic, energetic framing",
        "Relatable, shareable moments",
      ],
      avoidList: [
        "Slow-building subtle imagery",
        "Complex compositions that don't read on small screens",
        "Muted color palettes",
        "Overly artistic or conceptual visuals",
      ],
    },
    podcast_visual: {
      type: "visual_poet",
      name: "Visual Poet",
      role: "Ambient Visual Designer",
      coreRule: "Create calming, non-distracting backgrounds that complement spoken content without competing for attention.",
      visualPrinciples: [
        "Ambient, atmospheric scenes",
        "Subtle movement and gentle transitions",
        "Meditative, contemplative imagery",
        "Abstract or environmental focus",
        "Long-duration friendly visuals",
      ],
      avoidList: [
        "Busy, attention-grabbing scenes",
        "Fast movement or dramatic action",
        "Strong narrative elements",
        "Visuals that demand interpretation",
      ],
    },
    lyric_video: {
      type: "visual_poet",
      name: "Visual Poet",
      role: "Lyric Video Designer",
      coreRule: "Create backgrounds with clear negative space for text overlay. Visuals support lyrics without overwhelming them.",
      visualPrinciples: [
        "Compositions with text-safe zones",
        "Lower-third and center-frame clearance",
        "Thematic imagery that supports mood",
        "Contrast-friendly backgrounds",
        "Rhythmic visual flow matching lyrics",
      ],
      avoidList: [
        "Busy center compositions",
        "Complex patterns that interfere with text",
        "Dramatic lighting changes that affect readability",
        "Visuals that compete with lyrics for attention",
      ],
    },
  };

  return personas[purpose] || personas.music_video;
}

// --- Style Enhancement ---

/**
 * Get style-specific technique keywords to inject into prompts.
 * Prevents AI from applying styles as mere "filters" and forces authentic medium representation.
 * Covers all 13 art styles available in the application.
 */
export function getStyleEnhancement(style: string): {
  keywords: string[];
  mediumDescription: string;
} {
  const styleLower = style.toLowerCase();

  // Cinematic
  if (styleLower.includes("cinematic")) {
    return {
      keywords: [
        "35mm film grain",
        "anamorphic lens flare",
        "shallow depth of field",
        "professional color grading",
        "dramatic three-point lighting",
        "cinematic aspect ratio",
        "volumetric light rays",
      ],
      mediumDescription: "cinematic movie still with professional cinematography, anamorphic lens characteristics, and dramatic lighting",
    };
  }

  // Anime / Manga
  if (styleLower.includes("anime") || styleLower.includes("manga")) {
    return {
      keywords: [
        "screentone shading",
        "speed lines",
        "expressive oversized eyes",
        "dynamic action poses",
        "cel-shaded flat colors",
        "clean ink linework",
        "shoujo sparkle effects",
        "dramatic wind hair movement",
      ],
      mediumDescription: "high-quality Japanese animation style with clean linework, cel shading, and Studio Ghibli-inspired aesthetic",
    };
  }

  // Cyberpunk
  if (styleLower.includes("cyberpunk")) {
    return {
      keywords: [
        "neon tube lighting",
        "holographic displays",
        "rain-slicked reflective streets",
        "chromatic aberration",
        "glitch artifacts",
        "teal and magenta color palette",
        "high contrast noir shadows",
        "retrofuturistic technology",
      ],
      mediumDescription: "futuristic cyberpunk aesthetic with neon-drenched cityscapes, rain effects, and Blade Runner-inspired atmosphere",
    };
  }

  // Watercolor
  if (styleLower.includes("watercolor") || styleLower.includes("aquarelle")) {
    return {
      keywords: [
        "bleeding color edges",
        "wet-on-wet technique",
        "cold-pressed Arches paper texture",
        "pigment granulation",
        "transparent color washes",
        "soft diffused edges",
        "visible water bloom effects",
        "raw paper white highlights",
      ],
      mediumDescription: "authentic watercolor painting on textured paper with visible pigment flow, soft bleeding edges, and transparent washes",
    };
  }

  // Oil Painting
  if (styleLower.includes("oil")) {
    return {
      keywords: [
        "impasto knife texture",
        "linseed oil sheen",
        "canvas weave texture",
        "thick paint ridges",
        "visible brushstroke direction",
        "rich saturated pigments",
        "chiaroscuro modeling",
        "glazed translucent layers",
      ],
      mediumDescription: "traditional oil painting on stretched canvas with visible impasto brushwork, rich pigment saturation, and classical technique",
    };
  }

  // Pixel Art
  if (styleLower.includes("pixel")) {
    return {
      keywords: [
        "limited color palette",
        "dithering patterns",
        "aliased hard edges",
        "sprite-based characters",
        "8-bit or 16-bit aesthetic",
        "tile-based backgrounds",
        "scanline overlay",
        "CRT screen curvature",
      ],
      mediumDescription: "authentic retro pixel art with limited palette, dithering techniques, and nostalgic 16-bit video game aesthetic",
    };
  }

  // Surrealist
  if (styleLower.includes("surreal")) {
    return {
      keywords: [
        "impossible geometry",
        "melting clocks motif",
        "dreamlike distortion",
        "juxtaposed scale",
        "floating objects",
        "Dalí-esque symbolism",
        "Magritte-style paradox",
        "uncanny valley atmosphere",
      ],
      mediumDescription: "surrealist art style with dreamlike impossible imagery, symbolic juxtapositions, and Dalí/Magritte-inspired composition",
    };
  }

  // Dark Fantasy
  if (styleLower.includes("dark fantasy") || styleLower.includes("fantasy") && styleLower.includes("dark")) {
    return {
      keywords: [
        "grimdark atmosphere",
        "gothic architecture",
        "volumetric fog and mist",
        "flickering torchlight",
        "eldritch horror elements",
        "weathered stone textures",
        "blood moon lighting",
        "chiaroscuro shadows",
      ],
      mediumDescription: "dark fantasy art with gothic atmosphere, grimdark aesthetic, detailed textures, and ominous eldritch mood",
    };
  }

  // Commercial / Ad
  if (styleLower.includes("commercial") || styleLower.includes("ad")) {
    return {
      keywords: [
        "studio softbox lighting",
        "infinity curve background",
        "product hero shot",
        "macro detail focus",
        "clean negative space",
        "aspirational lifestyle context",
        "high-key professional lighting",
        "advertisement composition",
      ],
      mediumDescription: "professional commercial photography with studio lighting, clean backgrounds, and product-focused hero composition",
    };
  }

  // Minimalist / Tutorial
  if (styleLower.includes("minimalist") || styleLower.includes("tutorial")) {
    return {
      keywords: [
        "flat vector shapes",
        "isometric perspective",
        "clean white background",
        "limited color palette",
        "geometric simplification",
        "infographic clarity",
        "sans-serif aesthetic",
        "educational diagram style",
      ],
      mediumDescription: "clean minimalist illustration with flat design, isometric elements, and educational infographic clarity",
    };
  }

  // Comic Book
  if (styleLower.includes("comic")) {
    return {
      keywords: [
        "bold ink outlines",
        "halftone dot patterns",
        "dynamic action lines",
        "Ben-Day dots shading",
        "vibrant superhero colors",
        "dramatic foreshortening",
        "Kirby crackle energy",
        "word balloon composition space",
      ],
      mediumDescription: "American comic book style with bold ink outlines, halftone patterns, dynamic action poses, and vibrant superhero aesthetic",
    };
  }

  // Corporate / Brand
  if (styleLower.includes("corporate") || styleLower.includes("brand")) {
    return {
      keywords: [
        "Memphis design elements",
        "flat vector illustration",
        "professional blue tones",
        "clean geometric shapes",
        "tech startup aesthetic",
        "trustworthy composition",
        "modern sans-serif style",
        "abstract blob backgrounds",
      ],
      mediumDescription: "modern corporate design with Memphis style elements, flat vectors, and professional tech-startup aesthetic",
    };
  }

  // Photorealistic
  if (styleLower.includes("photo") || styleLower.includes("realistic")) {
    return {
      keywords: [
        "DSLR 50mm lens",
        "natural ambient lighting",
        "shallow depth of field bokeh",
        "raw unedited appearance",
        "realistic skin texture",
        "natural color temperature",
        "documentary photography style",
        "candid moment capture",
      ],
      mediumDescription: "hyper-realistic photography with DSLR quality, natural lighting, and authentic documentary-style capture",
    };
  }

  // Noir (bonus style)
  if (styleLower.includes("noir")) {
    return {
      keywords: [
        "chiaroscuro lighting",
        "venetian blind shadows",
        "high contrast black and white",
        "cigarette smoke wisps",
        "rain-slicked streets",
        "fedora silhouettes",
        "1940s detective aesthetic",
        "expressionist angles",
      ],
      mediumDescription: "classic film noir cinematography with dramatic shadows, high contrast, and 1940s detective atmosphere",
    };
  }

  // Charcoal/Sketch (bonus style)
  if (styleLower.includes("charcoal") || styleLower.includes("sketch") || styleLower.includes("pencil")) {
    return {
      keywords: [
        "paper grain texture",
        "smudged graphite gradients",
        "gestural mark-making",
        "tonal value range",
        "cross-hatching technique",
        "erased highlights",
        "vine charcoal softness",
        "fixative spray texture",
      ],
      mediumDescription: "hand-drawn sketch with visible paper texture, smudged charcoal gradients, and natural media characteristics",
    };
  }

  // Default fallback - cinematic
  return {
    keywords: [
      "cinematic depth of field",
      "professional color grading",
      "anamorphic lens characteristics",
      "dramatic atmospheric lighting",
    ],
    mediumDescription: "cinematic visual style with professional cinematography and dramatic composition",
  };
}

/**
 * Lint a prompt for common issues.
 */
export function lintPrompt(params: {
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
          "Prompt doesn't strongly reference your Global Subject; this can cause character/object drift across scenes.",
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

  // Generic conflict detection - flag common cliche tropes
  const conflictPatterns = /\b(arguing|slamming|yelling|fighting|screaming\s+at|shouting\s+match|couple\s+fighting|heated\s+argument|angry\s+confrontation)\b/i;
  if (conflictPatterns.test(norm)) {
    issues.push({
      code: "generic_conflict",
      message:
        "Generic conflict imagery detected (arguing, fighting). Consider visual metaphors: glass breaking, door closing, wilting flower, fading photograph, storm clouds gathering.",
      severity: "warn",
    });
  }

  return issues;
}

/**
 * Get purpose-specific instructions for prompt generation.
 */
export const getPurposeGuidance = (purpose: VideoPurpose): string => {
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
 * Enhanced prompt generation instruction with visual storytelling.
 */
export const getPromptGenerationInstruction = (
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

/**
 * Refine an image prompt using AI.
 */
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


// --- Main Services ---

/**
 * Internal function to generate prompts from content.
 */
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

/**
 * Generate image prompts from song lyrics.
 */
export const generatePromptsFromLyrics = (
  srtContent: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  purpose: VideoPurpose = "music_video",
) => generatePrompts(srtContent, style, "lyrics", globalSubject, purpose);

/**
 * Generate image prompts from story/narrative content.
 */
export const generatePromptsFromStory = (
  srtContent: string,
  style: string = "Cinematic",
  globalSubject: string = "",
  purpose: VideoPurpose = "documentary",
) => generatePrompts(srtContent, style, "story", globalSubject, purpose);

/**
 * Refine an image prompt with linting and optional AI enhancement.
 */
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

/**
 * Generate a motion-optimized prompt for video animation.
 * Transforms a static image description into an animation-focused prompt
 * that specifies camera movements, environmental effects, and subtle animations.
 */
export const generateMotionPrompt = async (
  imagePrompt: string,
  mood: string = "cinematic",
  globalSubject: string = "",
): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: `You are a professional video director creating motion instructions for animating a still image.

STATIC IMAGE DESCRIPTION:
${imagePrompt}

MOOD: ${mood}

${globalSubject ? `MAIN SUBJECT (keep stationary/subtle movement only): ${globalSubject}` : ""}

TASK: Generate a SHORT motion prompt (2-3 sentences max) describing:
1. Camera movement (slow zoom, pan, dolly, static with parallax)
2. Environmental motion (wind, particles, light rays, clouds, water ripples)
3. Atmospheric effects (fog drift, light flicker, dust motes)

RULES:
- Keep the main subject relatively static (subtle breathing, blinking, hair movement only)
- Focus on ENVIRONMENT and CAMERA movement, not subject action
- The animation is only 1-2 seconds, so describe subtle, looping motion
- NO scene changes, NO new elements, NO action sequences
- Use present continuous tense ("camera slowly zooms", "leaves are gently swaying")
- Keep it under 50 words

OUTPUT: Return JSON with single field "motion"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            motion: { type: Type.STRING },
          },
          required: ["motion"],
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) {
      // Fallback: generate a generic motion prompt
      return `Slow cinematic camera push-in with subtle atmospheric movement. ${mood} lighting with gentle environmental motion.`;
    }

    try {
      const parsed = JSON.parse(jsonStr) as { motion: string };
      return parsed.motion || `Slow camera movement with subtle ${mood} atmosphere.`;
    } catch {
      return `Slow cinematic camera movement with ${mood} ambiance.`;
    }
  });
};
