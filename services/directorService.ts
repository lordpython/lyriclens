/**
 * Director Service
 * LangChain-based orchestration for prompt generation using a two-stage pipeline:
 * 1. Analyzer Agent: Interprets content structure, emotional arcs, and key themes
 * 2. Storyboarder Agent: Generates detailed visual prompts based on the analysis
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser, StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { ImagePrompt } from "../types";
import { VideoPurpose, CAMERA_ANGLES, LIGHTING_MOODS } from "../constants";
import { lintPrompt, getPurposeGuidance, getSystemPersona, getStyleEnhancement, generatePromptsFromLyrics, generatePromptsFromStory, refineImagePrompt } from "./promptService";
import { parseSRTTimestamp } from "../utils/srtParser";

// --- Zod Schemas ---

/**
 * Schema for Analyzer output validation.
 * Defines the structure of content analysis including sections, emotional arc, themes, and motifs.
 */
export const AnalysisSchema = z.object({
  sections: z.array(z.object({
    name: z.string().describe("Section name (e.g., Intro, Verse 1, Chorus)"),
    startTimestamp: z.string().describe("Start timestamp in MM:SS format"),
    endTimestamp: z.string().describe("End timestamp in MM:SS format"),
    type: z.enum(["intro", "verse", "chorus", "bridge", "outro", "transition", "key_point", "conclusion"]),
    emotionalIntensity: z.number().min(1).max(10).describe("Emotional intensity 1-10"),
  })),
  emotionalArc: z.object({
    opening: z.string().describe("Opening emotional tone"),
    peak: z.string().describe("Peak emotional moment"),
    resolution: z.string().describe("Resolution/closing tone"),
  }),
  themes: z.array(z.string()).describe("Key visual themes extracted from content"),
  motifs: z.array(z.string()).describe("Recurring visual motifs to maintain consistency"),
  // NEW: Concrete motifs for literal visualization (the "candle" fix)
  concreteMotifs: z.array(z.object({
    object: z.string().describe("Physical object mentioned (e.g., 'candle', 'door', 'rain', 'mirror')"),
    timestamp: z.string().describe("When it first appears (MM:SS format)"),
    emotionalContext: z.string().describe("What emotion/meaning it represents"),
  })).describe("CRITICAL: Concrete physical objects from the text that MUST appear LITERALLY in visuals"),
});

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

/**
 * Schema for Storyboarder output validation.
 * Defines the structure of generated image prompts.
 */
export const StoryboardSchema = z.object({
  prompts: z.array(z.object({
    text: z.string().describe("Detailed visual prompt 60-120 words"),
    mood: z.string().describe("Emotional tone of the scene"),
    timestamp: z.string().describe("Timestamp in MM:SS format"),
  })),
});

export type StoryboardOutput = z.infer<typeof StoryboardSchema>;

// --- Configuration Interface ---

/**
 * Configuration options for the Director Service.
 */
export interface DirectorConfig {
  /** Model name to use (defaults to gemini-1.5-flash) */
  model?: string;
  /** Temperature for generation (0-1, defaults to 0.7) */
  temperature?: number;
  /** Maximum retry attempts on failure (defaults to 2) */
  maxRetries?: number;
}

// --- Default Configuration ---

const DEFAULT_CONFIG: Required<DirectorConfig> = {
  model: "gemini-2.0-flash",
  temperature: 0.7,
  maxRetries: 2,
};

// --- Error Types ---

/**
 * Custom error class for Director Service errors.
 * Provides structured error information for debugging and fallback decisions.
 */
export class DirectorServiceError extends Error {
  public readonly code: DirectorErrorCode;
  public readonly stage: "analyzer" | "storyboarder" | "chain" | "validation" | "unknown";
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: DirectorErrorCode,
    stage: "analyzer" | "storyboarder" | "chain" | "validation" | "unknown",
    originalError?: Error
  ) {
    super(message);
    this.name = "DirectorServiceError";
    this.code = code;
    this.stage = stage;
    this.originalError = originalError;
  }
}

/**
 * Error codes for Director Service failures.
 */
export type DirectorErrorCode =
  | "API_KEY_MISSING"
  | "MODEL_INIT_FAILED"
  | "CHAIN_EXECUTION_FAILED"
  | "OUTPUT_PARSING_FAILED"
  | "SCHEMA_VALIDATION_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";


// --- LangChain Verbose Configuration ---

/**
 * Enable verbose mode for LangChain debugging.
 * Set to true to see detailed chain execution logs.
 */
const LANGCHAIN_VERBOSE = true;

// --- Model Initialization ---

/**
 * Creates a configured ChatGoogleGenerativeAI model instance.
 */
function createModel(config: DirectorConfig = {}): ChatGoogleGenerativeAI {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Use the same API key resolution as apiClient.ts
  const apiKey = process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    "";

  return new ChatGoogleGenerativeAI({
    model: mergedConfig.model,
    temperature: mergedConfig.temperature,
    apiKey,
    verbose: LANGCHAIN_VERBOSE,
  });
}

// --- Analyzer Agent ---

/**
 * Creates the Analyzer prompt template.
 * Handles both "lyrics" and "story" content types.
 */
function createAnalyzerTemplate(contentType: "lyrics" | "story"): ChatPromptTemplate {
  const contentTypeGuidance = contentType === "lyrics"
    ? `For song lyrics, identify:
- Song sections: Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro
- Emotional intensity per section (1-10 scale)
- Transitions between sections`
    : `For narrative/story content, identify:
- Narrative segments: Introduction, Key Points, Transitions, Conclusion
- Emotional intensity per segment (1-10 scale)
- Topic transitions`;

  const validTypes = contentType === "lyrics"
    ? '"intro", "verse", "chorus", "bridge", "outro", "transition"'
    : '"intro", "key_point", "transition", "conclusion"';

  return ChatPromptTemplate.fromMessages([
    ["system", `You are a professional content analyst specializing in ${contentType} analysis.
Your task is to analyze the provided content and identify its structure, emotional arc, key themes, and CONCRETE VISUAL MOTIFS.

CONTENT TYPE: ${contentType}
${contentTypeGuidance}

ANALYSIS REQUIREMENTS:
1. Identify 4-12 distinct sections with timestamps
2. Determine emotional intensity (1-10) for each section
3. Extract the overall emotional arc (opening → peak → resolution)
4. Identify 3-6 key visual themes
5. Identify 2-4 recurring visual motifs for consistency

CONCRETE MOTIF EXTRACTION (CRITICAL - THE "CANDLE FIX"):
Hunt for EVERY physical object mentioned in the text. These MUST be visualized LITERALLY:
- Objects: candle, door, window, rain, fire, mirror, clock, rose, stars, moon, ocean, etc.
- Actions: falling, burning, breaking, opening, closing, fading, melting
- Settings: beach, city, bedroom, forest, rooftop, highway

For EACH concrete object/action found:
- Record the exact object name
- Note when it first appears (timestamp)
- Describe what emotion it represents

These concrete motifs MUST be passed to the Storyboarder and shown AS LITERAL OBJECTS.
If lyrics say "the candle flickers", the visual MUST show an actual candle - NOT a "sad person" or "lonely scene".
The object IS the metaphor. Show the object.

OUTPUT FORMAT:
Return a valid JSON object (no markdown code blocks) with these fields:
- "sections": array of objects, each with "name" (string), "startTimestamp" (MM:SS), "endTimestamp" (MM:SS), "type" (lowercase enum), "emotionalIntensity" (1-10)
- "emotionalArc": object with "opening", "peak", "resolution" strings
- "themes": array of theme strings (3-6 items)
- "motifs": array of motif strings (2-4 items)
- "concreteMotifs": array of objects with "object" (the physical thing), "timestamp" (MM:SS), "emotionalContext" (what it represents)

CRITICAL: The "type" field MUST be one of these exact lowercase values: ${validTypes}
Do NOT use capitalized values like "Verse" - use lowercase "verse" instead.
Timestamps should be in MM:SS format (e.g., "01:30").`],
    ["human", `Analyze this content:

{content}`],
  ]);
}

/**
 * Creates the Analyzer chain that processes content and outputs structured analysis.
 */
export function createAnalyzerChain(contentType: "lyrics" | "story", config?: DirectorConfig) {
  const model = createModel(config);
  const template = createAnalyzerTemplate(contentType);
  const parser = StructuredOutputParser.fromZodSchema(AnalysisSchema);

  return template.pipe(model).pipe(parser);
}

/**
 * Runs the Analyzer agent on the provided content.
 */
export async function runAnalyzer(
  content: string,
  contentType: "lyrics" | "story",
  config?: DirectorConfig
): Promise<AnalysisOutput> {
  const chain = createAnalyzerChain(contentType, config);

  const result = await chain.invoke({
    content,
  });

  return result;
}


// --- Storyboarder Agent ---

/**
 * Creates the Storyboarder prompt template.
 * Generates detailed visual prompts based on the Analyzer's output and persona rules.
 */
function createStoryboarderTemplate(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ["system", `{personaInstructions}

ART STYLE: {style}
{styleEnhancement}

{purposeGuidance}

GLOBAL SUBJECT: {globalSubject}
{subjectGuidance}

CONCRETE MOTIFS (MUST INCLUDE LITERALLY):
{concreteMotifs}

CRITICAL RULE - METAPHOR LITERALISM:
For each concrete motif listed above, you MUST show the actual physical object.
- If lyrics say "candle" → show a real candle
- If lyrics say "door closing" → show a door physically closing
- If lyrics say "rain" → show actual rain falling
Do NOT replace concrete objects with abstract interpretations.
Do NOT show "sad person" when lyrics mention "candle".
The object IS the metaphor. Show the object itself.

AVAILABLE CAMERA ANGLES: {cameraAngles}
AVAILABLE LIGHTING MOODS: {lightingMoods}

CONTENT ANALYSIS:
{analysis}

PROMPT WRITING RULES:
1. Each prompt must be 60-120 words with SPECIFIC visual details
2. Include: subject + action + environment + lighting + camera angle + atmosphere
3. NO text, typography, subtitles, logos, watermarks, or UI elements
4. NO generic phrases like "beautiful", "stunning", "amazing" - be SPECIFIC
5. Reference the main subject by their specific features, not just "the subject"
6. Vary compositions: rule-of-thirds, centered, symmetrical, asymmetrical
7. Include sensory details: textures, materials, weather, time of day
8. NEVER repeat the same camera angle in consecutive scenes
9. Match visual intensity to emotional intensity from analysis
10. INCLUDE at least one concrete motif from the list in each relevant scene

AVOID GENERIC CONFLICT TROPES:
- NO "couple arguing" or "heated argument" scenes
- NO generic "people fighting" imagery
- Instead, use visual metaphors: glass breaking, door closing, wilting flower, fading photograph

EMOTIONAL ARC GUIDANCE:
- Opening scenes: Establish mood and setting (wide shots, context)
- Building scenes: Increase intensity (medium shots, character focus)
- Peak scenes: Maximum emotion (dynamic angles, close-ups, action)
- Resolution scenes: Wind down (pull back, contemplative)

CRITICAL REQUIREMENT: You MUST generate EXACTLY 10 prompts. Not 7, not 6, but exactly 10 prompts that follow the emotional arc from the analysis.

OUTPUT FORMAT:
Return a valid JSON object (no markdown code blocks) with a "prompts" array containing exactly 10 objects.
Each prompt object must have:
- "text": detailed visual prompt (60-120 words)
- "mood": emotional tone of the scene
- "timestamp": timestamp in MM:SS format matching the analysis sections`],
    ["human", `Create the visual storyboard based on the analysis provided. Remember to generate exactly 10 prompts that follow the persona rules and include the concrete motifs literally.`],
  ]);
}

/**
 * Creates the Storyboarder chain that generates image prompts from analysis.
 */
export function createStoryboarderChain(config?: DirectorConfig) {
  const model = createModel(config);
  const template = createStoryboarderTemplate();
  const parser = new JsonOutputParser<StoryboardOutput>();

  return template.pipe(model).pipe(parser);
}

/**
 * Runs the Storyboarder agent on the provided analysis.
 */
export async function runStoryboarder(
  analysis: AnalysisOutput,
  style: string,
  videoPurpose: VideoPurpose,
  globalSubject: string = "",
  config?: DirectorConfig
): Promise<StoryboardOutput> {
  const chain = createStoryboarderChain(config);

  // Get persona for this video purpose
  const persona = getSystemPersona(videoPurpose);
  const personaInstructions = `You are ${persona.name}, a ${persona.role}.

YOUR CORE RULE:
${persona.coreRule}

YOUR VISUAL PRINCIPLES:
${persona.visualPrinciples.map(p => `- ${p}`).join('\n')}

WHAT TO AVOID:
${persona.avoidList.map(a => `- ${a}`).join('\n')}`;

  // Get style enhancement
  const styleData = getStyleEnhancement(style);
  const styleEnhancement = `MEDIUM AUTHENTICITY (apply these characteristics):
${styleData.keywords.map(k => `- ${k}`).join('\n')}
Overall: ${styleData.mediumDescription}`;

  // Get purpose guidance
  const purposeGuidance = getPurposeGuidance(videoPurpose);
  const subjectGuidance = globalSubject.trim()
    ? `Keep this subject's appearance consistent across scenes.`
    : `Create cohesive scenes with consistent environmental elements.`;

  // Format concrete motifs from analysis
  const concreteMotifs = analysis.concreteMotifs && analysis.concreteMotifs.length > 0
    ? analysis.concreteMotifs.map(m => `- "${m.object}" (at ${m.timestamp}): ${m.emotionalContext}`).join('\n')
    : "No specific objects mentioned - create appropriate visual elements based on themes.";

  const result = await chain.invoke({
    style,
    personaInstructions,
    styleEnhancement,
    purposeGuidance,
    globalSubject: globalSubject || "None specified",
    subjectGuidance,
    concreteMotifs,
    cameraAngles: CAMERA_ANGLES.join(", "),
    lightingMoods: LIGHTING_MOODS.join(", "),
    analysis: JSON.stringify(analysis, null, 2),
  });

  return result;
}


// --- LCEL Director Chain Composition ---

/**
 * Creates the complete Director chain using LCEL.
 * Chains Analyzer → Storyboarder in a single pipeline.
 */
export function createDirectorChain(
  contentType: "lyrics" | "story",
  config?: DirectorConfig
) {
  const analyzerChain = createAnalyzerChain(contentType, config);
  const storyboarderChain = createStoryboarderChain(config);

  return RunnableSequence.from([
    // Stage 1: Analyze content
    async (input: {
      content: string;
      style: string;
      videoPurpose: VideoPurpose;
      globalSubject: string;
    }) => {
      const analysis = await analyzerChain.invoke({ content: input.content });
      console.log("[Director] Analysis complete:", JSON.stringify(analysis, null, 2));

      return {
        analysis,
        style: input.style,
        videoPurpose: input.videoPurpose,
        globalSubject: input.globalSubject,
      };
    },
    // Stage 2: Generate storyboard with persona and style enhancements
    async (input: {
      analysis: AnalysisOutput;
      style: string;
      videoPurpose: VideoPurpose;
      globalSubject: string;
    }) => {
      // Get persona for this video purpose
      const persona = getSystemPersona(input.videoPurpose);
      const personaInstructions = `You are ${persona.name}, a ${persona.role}.

YOUR CORE RULE:
${persona.coreRule}

YOUR VISUAL PRINCIPLES:
${persona.visualPrinciples.map(p => `- ${p}`).join('\n')}

WHAT TO AVOID:
${persona.avoidList.map(a => `- ${a}`).join('\n')}`;

      // Get style enhancement
      const styleData = getStyleEnhancement(input.style);
      const styleEnhancement = `MEDIUM AUTHENTICITY (apply these characteristics):
${styleData.keywords.map(k => `- ${k}`).join('\n')}
Overall: ${styleData.mediumDescription}`;

      const purposeGuidance = getPurposeGuidance(input.videoPurpose);
      const subjectGuidance = input.globalSubject.trim()
        ? `Keep this subject's appearance consistent across scenes.`
        : `Create cohesive scenes with consistent environmental elements.`;

      // Format concrete motifs from analysis
      const concreteMotifs = input.analysis.concreteMotifs && input.analysis.concreteMotifs.length > 0
        ? input.analysis.concreteMotifs.map(m => `- "${m.object}" (at ${m.timestamp}): ${m.emotionalContext}`).join('\n')
        : "No specific objects mentioned - create appropriate visual elements based on themes.";

      const result = await storyboarderChain.invoke({
        style: input.style,
        personaInstructions,
        styleEnhancement,
        purposeGuidance,
        globalSubject: input.globalSubject || "None specified",
        subjectGuidance,
        concreteMotifs,
        cameraAngles: CAMERA_ANGLES.join(", "),
        lightingMoods: LIGHTING_MOODS.join(", "),
        analysis: JSON.stringify(input.analysis, null, 2),
      });

      console.log("[Director] Storyboard complete:", result.prompts?.length, "prompts generated");
      return result;
    },
  ]);
}

// --- Lint Validation ---

/**
 * Classifies an error and returns the appropriate DirectorErrorCode.
 */
function classifyError(error: unknown): DirectorErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // API key issues
    if (message.includes("api key") || message.includes("apikey") || message.includes("unauthorized")) {
      return "API_KEY_MISSING";
    }

    // Rate limiting
    if (message.includes("rate limit") || message.includes("quota") || message.includes("429")) {
      return "RATE_LIMIT_EXCEEDED";
    }

    // Network errors
    if (message.includes("network") || message.includes("fetch") || message.includes("econnrefused") || message.includes("enotfound")) {
      return "NETWORK_ERROR";
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return "TIMEOUT";
    }

    // Parsing errors
    if (message.includes("parse") || message.includes("json") || message.includes("unexpected token")) {
      return "OUTPUT_PARSING_FAILED";
    }

    // Validation errors
    if (message.includes("validation") || message.includes("schema") || message.includes("zod")) {
      return "SCHEMA_VALIDATION_FAILED";
    }

    // Model initialization
    if (message.includes("model") && (message.includes("init") || message.includes("create"))) {
      return "MODEL_INIT_FAILED";
    }
  }

  return "UNKNOWN_ERROR";
}

/**
 * Logs error details for debugging purposes.
 */
function logError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorCode = classifyError(error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[Director] Error in ${stage}:`);
  console.error(`  Code: ${errorCode}`);
  console.error(`  Message: ${errorMessage}`);
  if (context) {
    console.error(`  Context:`, JSON.stringify(context, null, 2));
  }
  if (errorStack) {
    console.error(`  Stack: ${errorStack}`);
  }
}

/**
 * Validates and optionally refines generated prompts using lintPrompt.
 * When critical issues (too_short, missing_subject) are detected, attempts refinement.
 */
async function validateAndLintPrompts(
  prompts: StoryboardOutput["prompts"],
  globalSubject?: string,
  style: string = "Cinematic"
): Promise<ImagePrompt[]> {
  const validatedPrompts: ImagePrompt[] = [];
  const previousPrompts: string[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    // Run lint validation
    const issues = lintPrompt({
      promptText: prompt.text,
      globalSubject,
      previousPrompts,
    });

    // Log any warnings
    if (issues.length > 0) {
      console.log(`[Director] Lint issues for prompt ${i + 1}:`, issues.map(issue => issue.code).join(", "));
    }

    // Check for critical issues that need refinement
    const criticalIssues = issues.filter(
      issue => issue.code === "too_short" || issue.code === "missing_subject"
    );
    const hasCriticalIssues = criticalIssues.length > 0;

    let finalText = prompt.text;

    // Attempt refinement for critical issues
    if (hasCriticalIssues) {
      console.log(`[Director] Critical issues detected for prompt ${i + 1}, attempting refinement...`);

      try {
        const refinementResult = await refineImagePrompt({
          promptText: prompt.text,
          style,
          globalSubject,
          intent: "auto",
          previousPrompts,
        });

        finalText = refinementResult.refinedPrompt;
        console.log(`[Director] Prompt ${i + 1} refined successfully`);

        // Re-lint the refined prompt to verify improvement
        const postRefinementIssues = lintPrompt({
          promptText: finalText,
          globalSubject,
          previousPrompts,
        });

        const stillHasCriticalIssues = postRefinementIssues.some(
          issue => issue.code === "too_short" || issue.code === "missing_subject"
        );

        if (stillHasCriticalIssues) {
          console.log(`[Director] Prompt ${i + 1} still has critical issues after refinement`);
        }
      } catch (refinementError) {
        console.error(`[Director] Refinement failed for prompt ${i + 1}:`, refinementError);
        // Keep original text if refinement fails
      }
    }

    // Create ImagePrompt object
    const imagePrompt: ImagePrompt = {
      id: `prompt-${Date.now()}-${i}`,
      text: finalText,
      mood: prompt.mood,
      timestamp: prompt.timestamp,
      timestampSeconds: parseSRTTimestamp(prompt.timestamp) ?? 0,
    };

    validatedPrompts.push(imagePrompt);
    previousPrompts.push(finalText);
  }

  return validatedPrompts;
}

// --- Main Export Function ---

/**
 * Generates image prompts using the LangChain Director workflow.
 * 
 * This function orchestrates a two-stage AI pipeline:
 * 1. Analyzer: Interprets content structure and emotional arcs
 * 2. Storyboarder: Generates detailed visual prompts
 * 
 * Falls back to existing prompt generation on errors.
 * 
 * @param srtContent - The SRT content to analyze
 * @param style - Art style preset for generation
 * @param contentType - "lyrics" or "story"
 * @param videoPurpose - Purpose of the video (affects visual style)
 * @param globalSubject - Optional consistent subject across scenes
 * @param config - Optional configuration overrides
 * @returns Array of ImagePrompt objects
 */
export async function generatePromptsWithLangChain(
  srtContent: string,
  style: string,
  contentType: "lyrics" | "story",
  videoPurpose: VideoPurpose,
  globalSubject?: string,
  config?: DirectorConfig
): Promise<ImagePrompt[]> {
  const startTime = Date.now();

  try {
    console.log("[Director] Starting LangChain workflow...");
    console.log("[Director] Content type:", contentType);
    console.log("[Director] Style:", style);
    console.log("[Director] Purpose:", videoPurpose);

    // Validate inputs before proceeding
    if (!srtContent || srtContent.trim().length === 0) {
      console.warn("[Director] Empty SRT content provided, falling back to existing implementation");
      return executeFallback(srtContent, style, contentType, videoPurpose, globalSubject);
    }

    // Check for API key availability
    const apiKey = process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.API_KEY ||
      "";

    if (!apiKey) {
      console.warn("[Director] No API key found, falling back to existing implementation");
      logError("initialization", new Error("API key not configured"), {
        contentType,
        style
      });
      return executeFallback(srtContent, style, contentType, videoPurpose, globalSubject);
    }

    // Create and run the director chain
    const directorChain = createDirectorChain(contentType, config);

    let result;
    try {
      result = await directorChain.invoke({
        content: srtContent,
        style,
        videoPurpose,
        globalSubject: globalSubject || "",
      });
    } catch (chainError) {
      // Log the chain execution error
      logError("chain execution", chainError, {
        contentType,
        style,
        videoPurpose,
        srtContentLength: srtContent.length,
      });

      // Throw a structured error for the outer catch to handle
      throw new DirectorServiceError(
        `Chain execution failed: ${chainError instanceof Error ? chainError.message : String(chainError)}`,
        classifyError(chainError),
        "chain",
        chainError instanceof Error ? chainError : undefined
      );
    }

    // Validate the result structure
    if (!result || !result.prompts || !Array.isArray(result.prompts)) {
      console.warn("[Director] Invalid result structure, falling back");
      logError("validation", new Error("Invalid result structure"), {
        resultType: typeof result,
        hasPrompts: result ? "prompts" in result : false,
      });
      return executeFallback(srtContent, style, contentType, videoPurpose, globalSubject);
    }

    // Check if we got any prompts
    if (result.prompts.length === 0) {
      console.warn("[Director] No prompts generated, falling back");
      return executeFallback(srtContent, style, contentType, videoPurpose, globalSubject);
    }

    // Validate and lint the generated prompts
    let validatedPrompts: ImagePrompt[];
    try {
      validatedPrompts = await validateAndLintPrompts(
        result.prompts,
        globalSubject,
        style
      );
    } catch (validationError) {
      logError("validation", validationError, {
        promptCount: result.prompts.length,
      });

      // If validation fails, still try to return the raw prompts with basic transformation
      validatedPrompts = result.prompts.map((p, i) => ({
        id: `prompt-${Date.now()}-${i}`,
        text: p.text || "",
        mood: p.mood || "neutral",
        timestamp: p.timestamp,
        timestampSeconds: parseSRTTimestamp(p.timestamp) ?? 0,
      }));
    }

    const duration = Date.now() - startTime;
    console.log(`[Director] Workflow complete: ${validatedPrompts.length} prompts generated in ${duration}ms`);
    return validatedPrompts;

  } catch (error) {
    const duration = Date.now() - startTime;

    // Log the error with full context
    logError("workflow", error, {
      contentType,
      style,
      videoPurpose,
      duration,
      srtContentLength: srtContent?.length || 0,
    });

    // Execute fallback
    console.log("[Director] Executing fallback to existing prompt generation...");
    return executeFallback(srtContent, style, contentType, videoPurpose, globalSubject);
  }
}

/**
 * Executes the fallback to existing prompt generation functions.
 * This is called when the LangChain workflow fails or encounters errors.
 * 
 * @param srtContent - The SRT content to process
 * @param style - Art style preset
 * @param contentType - "lyrics" or "story"
 * @param videoPurpose - Purpose of the video
 * @param globalSubject - Optional consistent subject
 * @returns Array of ImagePrompt objects from fallback implementation
 */
async function executeFallback(
  srtContent: string,
  style: string,
  contentType: "lyrics" | "story",
  videoPurpose: VideoPurpose,
  globalSubject?: string
): Promise<ImagePrompt[]> {
  try {
    console.log(`[Director] Fallback: Using ${contentType === "story" ? "generatePromptsFromStory" : "generatePromptsFromLyrics"}`);

    if (contentType === "story") {
      return await generatePromptsFromStory(srtContent, style, globalSubject, videoPurpose);
    }
    return await generatePromptsFromLyrics(srtContent, style, globalSubject, videoPurpose);
  } catch (fallbackError) {
    // If even the fallback fails, log and return empty array
    logError("fallback", fallbackError, {
      contentType,
      style,
    });
    console.error("[Director] Fallback also failed, returning empty array");
    return [];
  }
}
