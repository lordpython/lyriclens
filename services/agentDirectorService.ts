/**
 * Agent Director Service
 * 
 * Tool-based orchestration for intelligent prompt generation.
 * Uses ChatGoogleGenerativeAI with tool calling for:
 * - Content analysis
 * - Visual reference search
 * - Storyboard generation
 * - Prompt refinement
 * - Self-critique and iteration
 * 
 * This implementation uses direct tool calling instead of createAgent
 * to maintain browser compatibility.
 * 
 * Enhanced with robust JSON extraction, validation, and fallback mechanisms.
 * Feature: agent-director-json-parsing-fix
 * Requirements: All requirements
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ImagePrompt } from "../types";
import { VideoPurpose } from "../constants";
import {
  lintPrompt,
  getSystemPersona,
  refineImagePrompt,
} from "./promptService";
import { parseSRTTimestamp } from "../utils/srtParser";
import {
  type AnalysisOutput,
  type StoryboardOutput,
  runAnalyzer,
  runStoryboarder,
} from "./directorService";
import {
  JSONExtractor,
  FallbackProcessor,
  type ExtractedJSON,
  type ParseError,
  type ValidationResult,
  type ExtractionSuccess,
  type FallbackNotification,
  type BasicStoryboard,
  ExtractionMethod,
} from "./jsonExtractor";
import {
  generateCompleteFormatGuidance,
  preprocessFormatCorrection,
  needsFormatCorrection,
} from "./promptFormatService";

// --- Logging and Metrics Infrastructure ---

/**
 * Logging levels for the Agent Director Service.
 * Requirements: 1.3, 2.4
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log entry structure for detailed logging.
 * Requirements: 1.3, 2.4
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  duration?: number;
}

/**
 * Performance metrics for the Agent Director Service.
 * Requirements: 2.5, 4.5
 */
export interface AgentDirectorMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTimeMs: number;
  jsonExtractionSuccessRate: number;
  fallbackUsageRate: number;
  lastRequestTimestamp: string | null;
  extractionMethodBreakdown: Map<ExtractionMethod, number>;
}

/**
 * Logger for the Agent Director Service.
 * Requirements: 1.3, 2.4
 */
class AgentDirectorLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean = true;

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    this.logs.push(entry);
    
    // Trim old logs if necessary
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also output to console
    const prefix = `[AgentDirector] [${level.toUpperCase()}]`;
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, context || '');
        break;
      case LogLevel.INFO:
        console.log(prefix, message, context || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context || '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, context || '');
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log detailed error information for JSON extraction failures.
   * Requirements: 1.3, 2.4
   */
  logExtractionError(parseError: ParseError): void {
    this.error('JSON extraction failed', {
      type: parseError.type,
      message: parseError.message,
      contentLength: parseError.contentLength,
      contentPreview: parseError.originalContent.substring(0, 500),
      attemptedMethods: parseError.attemptedMethods,
      failureReasons: parseError.failureReasons,
      suggestions: parseError.suggestions
    });
  }

  /**
   * Log successful extraction with method tracking.
   * Requirements: 2.5
   */
  logExtractionSuccess(success: ExtractionSuccess): void {
    this.info('JSON extraction succeeded', {
      method: success.method,
      confidence: success.confidence,
      retryCount: success.retryCount,
      processingTimeMs: success.processingTimeMs
    });
  }

  /**
   * Log fallback processing usage.
   * Requirements: 4.4, 4.5
   */
  logFallbackUsage(notification: FallbackNotification): void {
    this.warn('Fallback processing used', {
      message: notification.message,
      extractedPromptCount: notification.extractedPromptCount,
      reducedFunctionality: notification.reducedFunctionality
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Metrics collector for the Agent Director Service.
 * Requirements: 2.5, 4.5
 */
class AgentDirectorMetricsCollector {
  private metrics: AgentDirectorMetrics;

  constructor() {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): AgentDirectorMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTimeMs: 0,
      jsonExtractionSuccessRate: 0,
      fallbackUsageRate: 0,
      lastRequestTimestamp: null,
      extractionMethodBreakdown: new Map()
    };
  }

  recordRequest(success: boolean, processingTimeMs: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTimestamp = new Date().toISOString();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average processing time
    const totalTime = this.metrics.averageProcessingTimeMs * (this.metrics.totalRequests - 1) + processingTimeMs;
    this.metrics.averageProcessingTimeMs = totalTime / this.metrics.totalRequests;
  }

  recordExtractionMethod(method: ExtractionMethod): void {
    const current = this.metrics.extractionMethodBreakdown.get(method) || 0;
    this.metrics.extractionMethodBreakdown.set(method, current + 1);
  }

  recordFallbackUsage(): void {
    // Update fallback usage rate
    const totalExtractions = Array.from(this.metrics.extractionMethodBreakdown.values())
      .reduce((sum, count) => sum + count, 0);
    const fallbackCount = this.metrics.extractionMethodBreakdown.get(ExtractionMethod.FALLBACK_TEXT) || 0;
    
    if (totalExtractions > 0) {
      this.metrics.fallbackUsageRate = fallbackCount / totalExtractions;
    }
  }

  updateExtractionSuccessRate(successCount: number, totalCount: number): void {
    if (totalCount > 0) {
      this.metrics.jsonExtractionSuccessRate = successCount / totalCount;
    }
  }

  getMetrics(): AgentDirectorMetrics {
    return {
      ...this.metrics,
      extractionMethodBreakdown: new Map(this.metrics.extractionMethodBreakdown)
    };
  }

  getMetricsSummary(): {
    successRate: number;
    averageTimeMs: number;
    fallbackRate: number;
    mostUsedMethod: ExtractionMethod | null;
  } {
    let mostUsedMethod: ExtractionMethod | null = null;
    let maxCount = 0;

    for (const [method, count] of this.metrics.extractionMethodBreakdown) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedMethod = method;
      }
    }

    return {
      successRate: this.metrics.totalRequests > 0 
        ? this.metrics.successfulRequests / this.metrics.totalRequests 
        : 0,
      averageTimeMs: this.metrics.averageProcessingTimeMs,
      fallbackRate: this.metrics.fallbackUsageRate,
      mostUsedMethod
    };
  }

  reset(): void {
    this.metrics = this.initializeMetrics();
  }
}

// Create singleton instances
const agentLogger = new AgentDirectorLogger();
const agentMetrics = new AgentDirectorMetricsCollector();
const jsonExtractor = new JSONExtractor();
const fallbackProcessor = new FallbackProcessor();

// Register fallback notification callback
fallbackProcessor.registerNotificationCallback((notification) => {
  agentLogger.logFallbackUsage(notification);
  agentMetrics.recordFallbackUsage();
});

// --- Tool Definitions ---

/**
 * Tool: Analyze Content
 */
const analyzeContentTool = tool(
  async ({ content, contentType }: { content: string; contentType: "lyrics" | "story" }) => {
    try {
      console.log("[AgentDirector] Running content analysis...");
      const analysis = await runAnalyzer(content, contentType);
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      return `Analysis failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "analyze_content",
    description: `Analyze lyrics or story content to identify structure, emotional arc, themes, and motifs.
Use this FIRST before generating storyboards.
RETURNS: A JSON object with sections, emotionalArc, themes, motifs, and concreteMotifs.
IMPORTANT: Copy the EXACT output of this tool and pass it directly to generate_storyboard's analysisJson parameter.`,
    schema: z.object({
      content: z.string().describe("The SRT/lyrics/story content to analyze"),
      contentType: z.enum(["lyrics", "story"]).describe("Type of content"),
    }),
  }
);

/**
 * Tool: Search Visual References
 */
const searchVisualReferencesTool = tool(
  async ({ query, style }: { query: string; style: string }) => {
    const references = getVisualReferences(query, style);
    return JSON.stringify(references, null, 2);
  },
  {
    name: "search_visual_references",
    description: `Search for visual references, cinematography techniques, and art style guidance.`,
    schema: z.object({
      query: z.string().describe("What to search for (e.g., 'melancholic night scene')"),
      style: z.string().describe("The art style context"),
    }),
  }
);

/**
 * Tool: Analyze and Generate Storyboard (Combined)
 * This tool combines analysis and storyboard generation to avoid JSON passing issues.
 */
const analyzeAndGenerateStoryboardTool = tool(
  async ({
    content,
    contentType,
    style,
    videoPurpose,
    globalSubject,
    targetAssetCount,
  }: {
    content: string;
    contentType: "lyrics" | "story";
    style: string;
    videoPurpose: string;
    globalSubject: string;
    targetAssetCount?: number;
  }) => {
    try {
      console.log("[AgentDirector] Running combined analysis + storyboard generation...");

      // Step 1: Analyze content
      console.log("[AgentDirector] Step 1: Analyzing content...");
      const analysis = await runAnalyzer(content, contentType);
      console.log(`[AgentDirector] Analysis complete: ${analysis.sections.length} sections, ${analysis.concreteMotifs?.length || 0} motifs`);

      // Step 2: Generate storyboard from analysis
      console.log("[AgentDirector] Step 2: Generating storyboard...");
      const storyboard = await runStoryboarder(
        analysis,
        style,
        videoPurpose as VideoPurpose,
        globalSubject,
        {
          targetAssetCount: typeof targetAssetCount === "number" ? targetAssetCount : 10,
        }
      );

      // Validate the storyboard
      if (!storyboard || !storyboard.prompts || !Array.isArray(storyboard.prompts)) {
        throw new Error("Invalid storyboard structure: missing prompts array");
      }

      if (storyboard.prompts.length === 0) {
        throw new Error("Storyboard contains no prompts");
      }

      console.log(`[AgentDirector] Storyboard generated: ${storyboard.prompts.length} prompts`);

      // Return combined result
      return JSON.stringify({
        analysis: {
          sectionCount: analysis.sections.length,
          themes: analysis.themes,
          emotionalArc: analysis.emotionalArc,
          concreteMotifs: analysis.concreteMotifs,
        },
        storyboard: storyboard,
      }, null, 2);
    } catch (error) {
      const errorMsg = `Combined analysis + storyboard failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[AgentDirector]", errorMsg);
      return errorMsg;
    }
  },
  {
    name: "analyze_and_generate_storyboard",
    description: `RECOMMENDED: Analyze content AND generate storyboard in one step.
This is the most reliable way to create a storyboard - use this instead of calling analyze_content and generate_storyboard separately.
Returns both the analysis summary and the complete storyboard with all prompts.`,
    schema: z.object({
      content: z.string().describe("The SRT/lyrics/story content to analyze"),
      contentType: z.enum(["lyrics", "story"]).describe("Type of content"),
      style: z.string().describe("Art style (e.g., 'Cinematic', 'Anime', 'Watercolor')"),
      videoPurpose: z.string().describe("Video purpose (e.g., 'music_video', 'commercial', 'documentary')"),
      globalSubject: z.string().default("").describe("Main subject for visual consistency (optional)"),
      targetAssetCount: z.number().optional().describe("Target number of prompts to generate (default: 10)"),
    }),
  }
);



/**
 * Tool: Generate Storyboard
 */

/**
 * Sanitizes a JSON string by replacing unescaped control characters.
 * AI models sometimes return JSON with raw newlines/tabs inside string values.
 * 
 * Enhanced to use format correction preprocessing when needed.
 * Requirements: 5.4
 */
function sanitizeJsonString(jsonStr: string): string {
  // First, try to parse as-is - only sanitize if needed
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    // Continue with sanitization
  }

  // Try format correction preprocessing first
  if (needsFormatCorrection(jsonStr)) {
    const correctionResult = preprocessFormatCorrection(jsonStr);
    if (correctionResult.wasModified) {
      try {
        JSON.parse(correctionResult.corrected);
        agentLogger.debug('Format correction applied successfully', {
          appliedCorrections: correctionResult.appliedCorrections
        });
        return correctionResult.corrected;
      } catch {
        // Continue with manual sanitization
      }
    }
  }

  // Replace control characters that are not properly escaped
  // This regex finds unescaped control characters within string values
  let sanitized = jsonStr;

  // Replace literal newlines, carriage returns, and tabs with their escaped versions
  // But only within string values (after a colon and quote, before closing quote)
  sanitized = sanitized
    .replace(/[\x00-\x1F\x7F]/g, (char) => {
      switch (char) {
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '\t': return '\\t';
        default: return ''; // Remove other control characters
      }
    });

  return sanitized;
}

/**
 * Extracts valid AnalysisOutput JSON from potentially malformed AI responses.
 * Handles cases where the AI wraps JSON in {"result": "..."} or uses nested escaping.
 * 
 * Enhanced to use JSONExtractor for robust multi-strategy extraction.
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */
async function extractAnalysisJson(input: string): Promise<AnalysisOutput> {
  agentLogger.debug('Extracting analysis JSON', { inputLength: input.length });

  // Strategy 0: Use JSONExtractor for robust extraction
  const extracted = await jsonExtractor.extractJSON(input);
  if (extracted) {
    const data = extracted.data as Record<string, unknown>;
    
    // Check if it's already a valid AnalysisOutput
    if (data.sections && Array.isArray(data.sections)) {
      agentLogger.logExtractionSuccess(jsonExtractor.getLastSuccess()!);
      agentMetrics.recordExtractionMethod(extracted.method);
      return data as AnalysisOutput;
    }
    
    // Check if it's wrapped in a "result" field
    if (data.result) {
      const innerData = typeof data.result === 'string'
        ? JSON.parse(data.result)
        : data.result;
      if (innerData.sections && Array.isArray(innerData.sections)) {
        agentLogger.logExtractionSuccess(jsonExtractor.getLastSuccess()!);
        agentMetrics.recordExtractionMethod(extracted.method);
        return innerData as AnalysisOutput;
      }
    }
  }

  // Strategy 1: Direct parse (legacy fallback)
  try {
    const parsed = JSON.parse(input);
    // Check if it's already a valid AnalysisOutput
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed as AnalysisOutput;
    }
    // Check if it's wrapped in a "result" field
    if (parsed.result) {
      const innerParsed = typeof parsed.result === 'string'
        ? JSON.parse(parsed.result)
        : parsed.result;
      if (innerParsed.sections && Array.isArray(innerParsed.sections)) {
        return innerParsed as AnalysisOutput;
      }
    }
  } catch {
    // Continue with other strategies
  }

  // Strategy 2: Extract JSON from markdown code blocks
  const codeBlockMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed.sections && Array.isArray(parsed.sections)) {
        return parsed as AnalysisOutput;
      }
    } catch {
      // Continue
    }
  }

  // Strategy 3: Find JSON object with "sections" array
  const sectionsMatch = input.match(/\{[\s\S]*"sections"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (sectionsMatch) {
    try {
      const sanitized = sanitizeJsonString(sectionsMatch[0]);
      const parsed = JSON.parse(sanitized);
      if (parsed.sections && Array.isArray(parsed.sections)) {
        return parsed as AnalysisOutput;
      }
    } catch {
      // Continue
    }
  }

  // Strategy 4: Handle double-escaped JSON (AI sometimes returns escaped JSON strings)
  try {
    // Remove outer wrapper if present
    let cleaned = input;

    // Check for pattern: {"result": "{\"sections\": ...}"}
    const wrappedMatch = input.match(/\{\s*"result"\s*:\s*"(.*)"\s*\}$/s);
    if (wrappedMatch) {
      // Unescape the inner JSON string
      cleaned = wrappedMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }

    const parsed = JSON.parse(cleaned);
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed as AnalysisOutput;
    }
  } catch {
    // Continue
  }

  // Strategy 5: Build minimal valid structure if we can find sections array
  try {
    const sectionsArrayMatch = input.match(/"sections"\s*:\s*(\[[\s\S]*?\])/);
    if (sectionsArrayMatch) {
      const sectionsArray = JSON.parse(sectionsArrayMatch[1]);
      return {
        sections: sectionsArray,
        emotionalArc: { opening: "Unknown", peak: "Unknown", resolution: "Unknown" },
        themes: [],
        motifs: [],
        concreteMotifs: [],
      } as AnalysisOutput;
    }
  } catch {
    // Continue
  }

  // Log detailed error for debugging
  const parseError = jsonExtractor.createParseError(input);
  agentLogger.logExtractionError(parseError);

  throw new Error(`Failed to extract valid analysis JSON from input: ${input.substring(0, 200)}...`);
}

const generateStoryboardTool = tool(
  async ({
    analysisJson,
    style,
    videoPurpose,
    globalSubject,
    targetAssetCount
  }: {
    analysisJson: string;
    style: string;
    videoPurpose: string;
    globalSubject: string;
    targetAssetCount?: number;
  }) => {
    try {
      agentLogger.info('Generating storyboard', { style, videoPurpose, targetAssetCount });

      // Use enhanced extraction to handle malformed AI responses
      const analysis = await extractAnalysisJson(analysisJson);
      agentLogger.debug('Analysis extracted', { sectionCount: analysis.sections.length });

      const storyboard = await runStoryboarder(
        analysis,
        style,
        videoPurpose as VideoPurpose,
        globalSubject,
        {
          targetAssetCount: typeof targetAssetCount === "number" ? targetAssetCount : 10,
        }
      );

      // Validate the storyboard structure using JSONExtractor
      const validation = jsonExtractor.validateStoryboard(storyboard);
      if (!validation.isValid) {
        agentLogger.warn('Storyboard validation failed', {
          errors: validation.errors,
          warnings: validation.warnings
        });
        
        // Attempt reconstruction if validation failed
        const reconstructed = jsonExtractor.attemptReconstruction(storyboard, validation);
        if (reconstructed.fixedData) {
          agentLogger.info('Storyboard reconstructed successfully');
          return JSON.stringify(reconstructed.fixedData, null, 2);
        }
        
        throw new Error(`Invalid storyboard structure: ${validation.errors.join(', ')}`);
      }

      if (!storyboard || !storyboard.prompts || !Array.isArray(storyboard.prompts)) {
        throw new Error("Invalid storyboard structure: missing prompts array");
      }

      if (storyboard.prompts.length === 0) {
        throw new Error("Storyboard contains no prompts");
      }

      // Validate each prompt has required fields
      for (let i = 0; i < storyboard.prompts.length; i++) {
        const prompt = storyboard.prompts[i];
        if (!prompt.text || typeof prompt.text !== 'string') {
          throw new Error(`Prompt ${i} missing or invalid text field`);
        }
        if (!prompt.timestamp || typeof prompt.timestamp !== 'string') {
          throw new Error(`Prompt ${i} missing or invalid timestamp field`);
        }
      }

      // Sanitize the storyboard before returning
      const sanitizedStoryboard = jsonExtractor.sanitizeStoryboard(storyboard);

      agentLogger.info('Storyboard generated and validated', { 
        promptCount: sanitizedStoryboard.prompts?.length || 0 
      });
      return JSON.stringify(sanitizedStoryboard, null, 2);
    } catch (error) {
      const errorMsg = `Storyboard generation failed: ${error instanceof Error ? error.message : String(error)}`;
      agentLogger.error('Storyboard generation failed', { error: errorMsg });
      
      // Attempt fallback processing
      agentLogger.info('Attempting fallback processing for storyboard generation');
      const fallbackStoryboard = fallbackProcessor.processWithFallback(
        analysisJson,
        error instanceof Error ? error.message : String(error)
      );
      
      if (fallbackStoryboard && fallbackStoryboard.prompts.length > 0) {
        agentLogger.info('Fallback storyboard generated', {
          promptCount: fallbackStoryboard.prompts.length,
          confidence: fallbackStoryboard.metadata.confidence
        });
        agentMetrics.recordExtractionMethod(ExtractionMethod.FALLBACK_TEXT);
        return JSON.stringify(fallbackStoryboard, null, 2);
      }
      
      return errorMsg;
    }
  },
  {
    name: "generate_storyboard",
    description: `Generate a visual storyboard with detailed image prompts based on content analysis.
CRITICAL: All prompts must share the same visual universe.
Use this AFTER analyze_content.`,
    schema: z.object({
      analysisJson: z.string().describe("IMPORTANT: Pass the EXACT raw JSON string output from analyze_content here. Do NOT wrap it in another object. Do NOT add 'result:' prefix. Just copy the JSON as-is."),
      style: z.string().describe("Art style (e.g., 'Cinematic', 'Anime', 'Watercolor')"),
      videoPurpose: z.string().describe("Video purpose (e.g., 'music_video', 'commercial', 'documentary')"),
      globalSubject: z.string().default("").describe("Main subject for consistency (can be empty string)"),
      targetAssetCount: z.number().optional().describe("Target number of prompts to generate (default: 10)"),
    }),
  }
);

/**
 * Tool: Refine Prompt
 */
const refinePromptTool = tool(
  async ({
    promptText,
    style,
    globalSubject,
    previousPrompts
  }: {
    promptText: string;
    style: string;
    globalSubject: string;
    previousPrompts: string[];
  }) => {
    try {
      console.log("[AgentDirector] Refining prompt...");
      const result = await refineImagePrompt({
        promptText,
        style,
        globalSubject,
        intent: "auto",
        previousPrompts,
      });
      return JSON.stringify({
        refinedPrompt: result.refinedPrompt,
        issues: result.issues.map(i => ({ code: i.code, message: i.message })),
        wasRefined: result.refinedPrompt !== promptText,
      }, null, 2);
    } catch (error) {
      return `Refinement failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "refine_prompt",
    description: `Refine and improve a single image prompt.`,
    schema: z.object({
      promptText: z.string().describe("The prompt text to refine"),
      style: z.string().describe("Art style for context"),
      globalSubject: z.string().default("").describe("Main subject (can be empty)"),
      previousPrompts: z.array(z.string()).default([]).describe("Previous prompts to avoid repetition (optional)"),
    }),
  }
);

/**
 * Tool: Critique Storyboard
 */
const critiqueStoryboardTool = tool(
  async ({
    storyboardJson,
    globalSubject
  }: {
    storyboardJson: string;
    globalSubject: string;
  }) => {
    try {
      console.log("[AgentDirector] Critiquing storyboard...");
      const sanitizedJson = sanitizeJsonString(storyboardJson);
      const storyboard: StoryboardOutput = JSON.parse(sanitizedJson);
      const critique = critiqueStoryboard(storyboard, globalSubject);
      return JSON.stringify(critique, null, 2);
    } catch (error) {
      return `Critique failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "critique_storyboard",
    description: `Evaluate the quality of a generated storyboard.
Returns a quality score and list of issues to fix.`,
    schema: z.object({
      storyboardJson: z.string().describe("The JSON output from generate_storyboard tool"),
      globalSubject: z.string().default("").describe("Main subject (can be empty)"),
    }),
  }
);

// All tools for binding
const allTools = [
  analyzeAndGenerateStoryboardTool, // Primary - use this for most reliable results
  analyzeContentTool,
  searchVisualReferencesTool,
  generateStoryboardTool,
  refinePromptTool,
  critiqueStoryboardTool,
];


// --- Helper Functions ---

function getVisualReferences(query: string, style: string): {
  cameraAngles: string[];
  lighting: string[];
  composition: string[];
  colorPalette: string[];
} {
  const queryLower = query.toLowerCase();

  const moodSuggestions: Record<string, { camera: string[]; lighting: string[]; colors: string[] }> = {
    melancholic: {
      camera: ["slow dolly out", "static wide shot", "low angle looking up"],
      lighting: ["blue hour", "overcast diffused", "single source dramatic"],
      colors: ["desaturated blues", "muted grays", "cold tones"],
    },
    energetic: {
      camera: ["dynamic tracking", "quick cuts", "dutch angle", "crane shot"],
      lighting: ["high contrast", "strobe effects", "rim lighting"],
      colors: ["vibrant saturated", "warm oranges", "electric blues"],
    },
    romantic: {
      camera: ["soft focus close-up", "two-shot", "slow pan"],
      lighting: ["golden hour", "candlelight", "soft diffused"],
      colors: ["warm pastels", "rose gold", "soft pinks"],
    },
    mysterious: {
      camera: ["obscured framing", "silhouette shot", "slow reveal"],
      lighting: ["chiaroscuro", "backlit", "fog/haze"],
      colors: ["deep shadows", "teal and orange", "noir palette"],
    },
    triumphant: {
      camera: ["hero shot low angle", "crane up", "epic wide"],
      lighting: ["dramatic rim light", "god rays", "golden backlight"],
      colors: ["rich golds", "deep reds", "royal blues"],
    },
  };

  const styleComposition: Record<string, string[]> = {
    cinematic: ["rule of thirds", "leading lines", "depth layers", "negative space"],
    anime: ["dynamic poses", "speed lines", "dramatic angles", "expressive lighting"],
    "film noir": ["high contrast shadows", "venetian blind lighting", "dutch angles"],
    watercolor: ["soft edges", "color bleeding", "organic shapes"],
    documentary: ["natural framing", "candid composition", "environmental context"],
  };

  let selectedMood = "energetic";
  for (const mood of Object.keys(moodSuggestions)) {
    if (queryLower.includes(mood) || queryLower.includes(mood.slice(0, 5))) {
      selectedMood = mood;
      break;
    }
  }

  const moodData = moodSuggestions[selectedMood] || moodSuggestions.energetic;
  const styleLower = style.toLowerCase();
  const composition = styleComposition[styleLower] || styleComposition.cinematic;

  return {
    cameraAngles: moodData.camera,
    lighting: moodData.lighting,
    composition,
    colorPalette: moodData.colors,
  };
}

function critiqueStoryboard(
  storyboard: StoryboardOutput,
  globalSubject: string
): {
  overallScore: number;
  promptCount: number;
  issues: Array<{ promptIndex: number; code: string; message: string }>;
  strengths: string[];
  recommendations: string[];
} {
  const issues: Array<{ promptIndex: number; code: string; message: string }> = [];
  const strengths: string[] = [];
  let totalScore = 100;

  const prompts = storyboard.prompts || [];

  if (prompts.length < 8) {
    issues.push({ promptIndex: -1, code: "too_few_prompts", message: `Only ${prompts.length} prompts` });
    totalScore -= 15;
  } else if (prompts.length >= 10) {
    strengths.push("Complete set of 10 prompts");
  }

  const previousPrompts: string[] = [];
  const moods = new Set<string>();

  prompts.forEach((prompt, index) => {
    const lintIssues = lintPrompt({
      promptText: prompt.text,
      globalSubject,
      previousPrompts,
    });

    lintIssues.forEach(issue => {
      issues.push({ promptIndex: index, code: issue.code, message: issue.message });
      totalScore -= issue.severity === "error" ? 5 : 2;
    });

    previousPrompts.push(prompt.text);
    moods.add(prompt.mood?.toLowerCase() || "unknown");
  });

  if (moods.size >= 4) {
    strengths.push(`Good emotional variety with ${moods.size} moods`);
  } else if (moods.size < 3) {
    issues.push({ promptIndex: -1, code: "low_variety", message: "Limited mood variety" });
    totalScore -= 10;
  }

  const recommendations: string[] = [];
  const errorPrompts = issues.filter(i => i.promptIndex >= 0);

  if (errorPrompts.length > 0) {
    const uniqueIndices = Array.from(new Set(errorPrompts.map(i => i.promptIndex)));
    recommendations.push(`Refine prompts at indices: ${uniqueIndices.join(", ")}`);
  }

  return {
    overallScore: Math.max(0, Math.min(100, totalScore)),
    promptCount: prompts.length,
    issues,
    strengths,
    recommendations,
  };
}


// --- Agent Configuration ---

export interface AgentDirectorConfig {
  model?: string;
  temperature?: number;
  maxIterations?: number;
  qualityThreshold?: number;
  targetAssetCount?: number; // NEW: Dynamic asset count from calculator
}

const DEFAULT_AGENT_CONFIG: Required<AgentDirectorConfig> = {
  model: "gemini-2.0-flash",
  temperature: 0.7,
  maxIterations: 2,
  qualityThreshold: 70,
  targetAssetCount: 10, // Default fallback if not provided
};

/**
 * Enable verbose mode for LangChain debugging.
 * Set to true to see detailed chain execution logs.
 */
const LANGCHAIN_VERBOSE = true;

/**
 * Generates a dynamic system prompt based on video purpose.
 * Each purpose gets a specialized persona with specific rules.
 */
function getAgentSystemPrompt(purpose: VideoPurpose): string {
  const persona = getSystemPersona(purpose);

  return `You are ${persona.name}, a Visionary Film Director known for atmospheric, non-linear storytelling (Style: Christopher Nolan meets A24).

## Your Identity & Core Rule
ATMOSPHERIC RESONANCE: Do NOT just visualize the nouns in the lyrics. Visualize the *feeling*. If lyrics say "candle", do NOT just show a candle. Show a lonely room where a candle has just burned out, implying absence. The object is a prop; the EMOTION is the subject.

## Quality Standards
- CRITICAL: Every shot must look like it belongs to the SAME high-budget movie.
- UNIFYING THREAD: Use a consistent visual motif in every scene (e.g., "cold blue fog" or "warm dust particles").
- AVOID: Isolated objects on plain backgrounds. Always place objects in a rich, textured environment.

## Your Visual Principles
${persona.visualPrinciples.map(p => `- ${p}`).join('\n')}

## What to AVOID
${persona.avoidList.map(a => `- ${a}`).join('\n')}

## WORKFLOW (USE THIS EXACT APPROACH)
**STEP 1: Use the analyze_and_generate_storyboard tool**
This is the ONLY tool you need to call first. It handles both analysis AND storyboard generation in one call.
Pass the content, contentType, style, videoPurpose, globalSubject, and targetAssetCount directly.

**STEP 2: Extract the storyboard from the result**
The tool returns a JSON object with both "analysis" and "storyboard" fields.
Use the "storyboard" object as your final output.

**STEP 3 (Optional): Critique and refine**
If needed, use critique_storyboard on the storyboard JSON.
Use refine_prompt on individual weak prompts if the score is below threshold.

## Quality Standards for Prompts
- Each prompt: 60-120 words with specific visual details
- Include: subject + action + environment + lighting + camera angle
- NO text, logos, or watermarks
- Vary camera angles across scenes
- Match visual intensity to emotional intensity

When done, output the final storyboard JSON.`;
}

// --- Tool Execution Helper ---

async function executeToolCall(
  toolCall: { name: string; args: Record<string, unknown> }
): Promise<string> {
  const { name, args } = toolCall;

  // Sanitize args to handle null/undefined values with appropriate defaults
  const sanitizedArgs = { ...args };
  for (const [key, value] of Object.entries(sanitizedArgs)) {
    if (value === null || value === undefined) {
      // Use empty array for array-type fields, empty string for others
      if (key === 'previousPrompts') {
        sanitizedArgs[key] = [];
      } else {
        sanitizedArgs[key] = '';
      }
    }
  }

  switch (name) {
    case "analyze_and_generate_storyboard":
      return analyzeAndGenerateStoryboardTool.invoke(sanitizedArgs as {
        content: string;
        contentType: "lyrics" | "story";
        style: string;
        videoPurpose: string;
        globalSubject: string;
        targetAssetCount?: number;
      });
    case "analyze_content":
      return analyzeContentTool.invoke(sanitizedArgs as { content: string; contentType: "lyrics" | "story" });
    case "search_visual_references":
      return searchVisualReferencesTool.invoke(sanitizedArgs as { query: string; style: string });
    case "generate_storyboard":
      return generateStoryboardTool.invoke(sanitizedArgs as { analysisJson: string; style: string; videoPurpose: string; globalSubject: string });
    case "refine_prompt":
      return refinePromptTool.invoke(sanitizedArgs as { promptText: string; style: string; globalSubject: string; previousPrompts: string[] });
    case "critique_storyboard":
      return critiqueStoryboardTool.invoke(sanitizedArgs as { storyboardJson: string; globalSubject: string });
    default:
      return `Unknown tool: ${name}`;
  }
}

// --- Main Agent Function ---

/**
 * Main agent function for generating image prompts.
 * 
 * Enhanced with comprehensive logging, metrics collection, and fallback mechanisms.
 * Requirements: All requirements
 */
export async function generatePromptsWithAgent(
  srtContent: string,
  style: string,
  contentType: "lyrics" | "story",
  videoPurpose: VideoPurpose,
  globalSubject?: string,
  config?: AgentDirectorConfig
): Promise<ImagePrompt[]> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_AGENT_CONFIG, ...config };

  agentLogger.info('Starting agent workflow', {
    contentType,
    videoPurpose,
    style,
    targetAssetCount: mergedConfig.targetAssetCount
  });

  if (!srtContent || srtContent.trim().length === 0) {
    agentLogger.warn('Empty content provided');
    agentMetrics.recordRequest(false, Date.now() - startTime);
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    "";

  if (!apiKey) {
    agentLogger.error('No API key found');
    agentMetrics.recordRequest(false, Date.now() - startTime);
    throw new Error("API key not configured");
  }

  try {
    // Create model with tools bound (verbose mode enabled)
    const model = new ChatGoogleGenerativeAI({
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      apiKey,
      verbose: LANGCHAIN_VERBOSE,
    }).bindTools(allTools);

    // Initial message with persona-driven system prompt
    const systemPrompt = getAgentSystemPrompt(videoPurpose);

    // Add format guidance to encourage consistent JSON output (Requirements: 5.1, 5.2, 5.3)
    const formatGuidance = generateCompleteFormatGuidance('storyboard');

    // Professional style wrapper to enforce high-end cinematic look
    const PRO_STYLE_WRAPPER = `GLOBAL VISUAL SIGNATURE (Apply to ALL prompts):
- Camera: Arri Alexa 65, Panavision 70mm lenses
- Color Grading: Teal & Orange, low contrast shadows, slightly desaturated
- Texture: Fine 35mm film grain, atmospheric haze/volumetric lighting
- Aspect Ratio: 2.39:1 Anamorphic`;

    // Consistency rule to enforce visual cohesion
    const consistencyRule = `CONSISTENCY CHECK:
You must pick ONE specific lighting condition and ONE specific environment texture and use it in EVERY single prompt.
Example: If Scene 1 is "rainy window at night", Scene 5 cannot be "bright sunny field". All prompts must share the same "visual universe".`;

    const targetCount = mergedConfig.targetAssetCount || 10;
    const taskMessage = `Create a visual storyboard for this ${contentType} content.

${PRO_STYLE_WRAPPER}

Style Context: ${style}
Video Purpose: ${videoPurpose}
Global Subject: ${globalSubject || "None"}
Quality Threshold: ${mergedConfig.qualityThreshold}
Target Asset Count: ${targetCount}

${consistencyRule}

${formatGuidance}

Content:
${srtContent}

Follow workflow: analyze → generate → critique → refine if needed.`;

    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
      new HumanMessage(systemPrompt + "\n\n" + taskMessage),
    ];

    let finalStoryboard: StoryboardOutput | null = null;
    let lastCritiqueScore = 0;
    let iterations = 0;
    const maxIterations = mergedConfig.maxIterations + 3; // Allow for tool calls

    // Agent loop
    while (iterations < maxIterations) {
      iterations++;
      agentLogger.debug(`Iteration ${iterations}`, { maxIterations });

      const response = await model.invoke(messages);
      messages.push(response);

      // Check for tool calls
      const toolCalls = response.tool_calls || [];

      if (toolCalls.length === 0) {
        // No more tool calls - check if we have a valid storyboard
        agentLogger.debug('No tool calls, checking final storyboard');

        // Try to extract from response content first (now async)
        const extractedStoryboard = await extractStoryboardFromContent(response.content as string);
        if (extractedStoryboard) {
          finalStoryboard = extractedStoryboard;
        }

        // If we have a storyboard and it meets quality threshold, we're done
        if (finalStoryboard && lastCritiqueScore >= mergedConfig.qualityThreshold) {
          agentLogger.info('Storyboard meets quality threshold', { score: lastCritiqueScore });
          break;
        }

        // If we have a storyboard but no critique score, accept it anyway
        if (finalStoryboard && lastCritiqueScore === 0) {
          agentLogger.info('Storyboard found without critique, accepting');
          break;
        }

        // If no storyboard found, break anyway to avoid infinite loop
        if (!finalStoryboard) {
          agentLogger.warn('No storyboard found in final response');
        }
        break;
      }

      // Execute tool calls
      for (const toolCall of toolCalls) {
        agentLogger.debug(`Executing tool: ${toolCall.name}`);

        // Pass targetAssetCount to storyboard generation tools
        const toolArgs = { ...toolCall.args as Record<string, unknown> };
        if ((toolCall.name === "generate_storyboard" || toolCall.name === "analyze_and_generate_storyboard") && !toolArgs.targetAssetCount) {
          toolArgs.targetAssetCount = targetCount;
        }

        const result = await executeToolCall({
          name: toolCall.name,
          args: toolArgs,
        });

        messages.push(new ToolMessage({
          content: result,
          tool_call_id: toolCall.id || `call_${Date.now()}`,
        }));

        // Track storyboard results from both tools
        if (toolCall.name === "generate_storyboard" || toolCall.name === "analyze_and_generate_storyboard") {
          try {
            // Use JSONExtractor for robust parsing
            const extracted = await jsonExtractor.extractJSON(result);
            if (extracted) {
              const parsed = extracted.data as Record<string, unknown>;
              
              // Handle combined tool output (has nested storyboard)
              const storyboard = (parsed.storyboard || parsed) as StoryboardOutput;

              if (storyboard.prompts && storyboard.prompts.length > 0) {
                // Validate and sanitize
                const validation = jsonExtractor.validateStoryboard(storyboard);
                if (validation.isValid) {
                  finalStoryboard = jsonExtractor.sanitizeStoryboard(storyboard as StoryboardData) as StoryboardOutput;
                  agentLogger.info('Storyboard captured', { 
                    promptCount: finalStoryboard.prompts?.length || 0,
                    method: extracted.method
                  });
                  agentMetrics.recordExtractionMethod(extracted.method);
                } else {
                  // Try reconstruction
                  const reconstructed = jsonExtractor.attemptReconstruction(storyboard, validation);
                  if (reconstructed.fixedData) {
                    finalStoryboard = reconstructed.fixedData as StoryboardOutput;
                    agentLogger.info('Storyboard reconstructed', {
                      promptCount: finalStoryboard.prompts?.length || 0
                    });
                  }
                }
              }
            } else {
              // Fallback to legacy parsing
              const parsed = JSON.parse(sanitizeJsonString(result));
              const storyboard = parsed.storyboard || parsed;
              if (storyboard.prompts && storyboard.prompts.length > 0) {
                finalStoryboard = storyboard;
                agentLogger.info('Storyboard captured via legacy parsing', {
                  promptCount: storyboard.prompts.length
                });
              }
            }
          } catch (error) {
            agentLogger.warn('Failed to parse storyboard result', { error: String(error) });
            
            // Attempt fallback processing
            const fallbackStoryboard = fallbackProcessor.processWithFallback(
              result,
              error instanceof Error ? error.message : String(error)
            );
            
            if (fallbackStoryboard && fallbackStoryboard.prompts.length > 0) {
              finalStoryboard = {
                prompts: fallbackStoryboard.prompts.map((p, i) => ({
                  text: p.prompt || '',
                  mood: p.mood || 'neutral',
                  timestamp: p.timestamp || `00:${String(i * 10).padStart(2, '0')}`,
                }))
              } as StoryboardOutput;
              agentLogger.info('Fallback storyboard used', {
                promptCount: finalStoryboard.prompts.length
              });
              agentMetrics.recordExtractionMethod(ExtractionMethod.FALLBACK_TEXT);
            }
          }
        }

        // Track critique scores
        if (toolCall.name === "critique_storyboard") {
          try {
            const extracted = await jsonExtractor.extractJSON(result);
            if (extracted) {
              const critique = extracted.data as Record<string, unknown>;
              lastCritiqueScore = (critique.overallScore as number) || 0;
            } else {
              const critique = JSON.parse(sanitizeJsonString(result));
              lastCritiqueScore = critique.overallScore || 0;
            }
            agentLogger.debug('Critique score received', { score: lastCritiqueScore });
          } catch (error) {
            agentLogger.warn('Failed to parse critique result', { error: String(error) });
          }
        }
      }
    }

    // Convert to ImagePrompts
    if (finalStoryboard?.prompts) {
      const prompts = convertToImagePrompts(finalStoryboard.prompts);
      const duration = Date.now() - startTime;
      
      agentLogger.info('Agent workflow complete', {
        promptCount: prompts.length,
        durationMs: duration,
        iterations
      });
      agentMetrics.recordRequest(true, duration);
      
      return prompts;
    }

    // Enhanced debugging for failed cases
    agentLogger.error('No storyboard generated', {
      finalStoryboard,
      lastCritiqueScore,
      iterations
    });

    // Log the last few messages for debugging
    const lastMessages = messages.slice(-3);
    agentLogger.debug('Last messages', {
      messages: lastMessages.map(m => ({
        type: m.constructor.name,
        content: typeof m.content === 'string' ? m.content.substring(0, 200) : m.content
      }))
    });

    agentMetrics.recordRequest(false, Date.now() - startTime);
    return [];

  } catch (error) {
    const duration = Date.now() - startTime;
    agentLogger.error('Agent execution failed', { 
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration
    });
    agentMetrics.recordRequest(false, duration);
    throw error;
  }
}

/**
 * Extract storyboard from content using enhanced JSONExtractor.
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5, 4.1, 4.2
 */
async function extractStoryboardFromContent(content: string): Promise<StoryboardOutput | null> {
  if (!content || typeof content !== 'string') {
    return null;
  }

  agentLogger.debug('Extracting storyboard from content', { contentLength: content.length });

  // Strategy 1: Use JSONExtractor for robust extraction
  const extracted = await jsonExtractor.extractJSON(content);
  if (extracted) {
    const data = extracted.data as Record<string, unknown>;
    
    // Check for storyboard structure
    if (data.prompts && Array.isArray(data.prompts)) {
      // Validate and sanitize
      const validation = jsonExtractor.validateStoryboard(data);
      if (validation.isValid) {
        const sanitized = jsonExtractor.sanitizeStoryboard(data as StoryboardData);
        agentLogger.info('Storyboard extracted via JSONExtractor', {
          method: extracted.method,
          promptCount: sanitized.prompts?.length || 0
        });
        agentMetrics.recordExtractionMethod(extracted.method);
        return sanitized as StoryboardOutput;
      } else {
        // Try reconstruction
        const reconstructed = jsonExtractor.attemptReconstruction(data, validation);
        if (reconstructed.fixedData) {
          agentLogger.info('Storyboard reconstructed', {
            promptCount: (reconstructed.fixedData as StoryboardData).prompts?.length || 0
          });
          return reconstructed.fixedData as StoryboardOutput;
        }
      }
    }
    
    // Check for nested storyboard (from combined tool)
    if (data.storyboard && typeof data.storyboard === 'object') {
      const storyboard = data.storyboard as Record<string, unknown>;
      if (storyboard.prompts && Array.isArray(storyboard.prompts)) {
        const sanitized = jsonExtractor.sanitizeStoryboard(storyboard as StoryboardData);
        agentLogger.info('Nested storyboard extracted', {
          promptCount: sanitized.prompts?.length || 0
        });
        return sanitized as StoryboardOutput;
      }
    }
  }

  // Strategy 2: Legacy pattern matching (fallback)
  const patterns = [
    /\{[\s\S]*"prompts"[\s\S]*\}/,  // Original pattern
    /```json\s*(\{[\s\S]*?\})\s*```/,  // JSON in code blocks
    /(\{[\s\S]*?\})/,  // Any JSON-like structure
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const jsonStr = match[1] || match[0];
      try {
        const sanitized = sanitizeJsonString(jsonStr);
        const parsed = JSON.parse(sanitized);
        // Validate it has the expected structure
        if (parsed && parsed.prompts && Array.isArray(parsed.prompts)) {
          agentLogger.info('Storyboard extracted via legacy pattern', {
            promptCount: parsed.prompts.length
          });
          return parsed;
        }
      } catch (error) {
        agentLogger.warn('Failed to parse extracted JSON', { error: String(error) });
        continue;
      }
    }
  }

  // Strategy 3: Fallback processing
  agentLogger.info('Attempting fallback processing for storyboard extraction');
  const fallbackStoryboard = fallbackProcessor.processWithFallback(
    content,
    'No valid storyboard JSON found in content'
  );
  
  if (fallbackStoryboard && fallbackStoryboard.prompts.length > 0) {
    agentLogger.info('Fallback storyboard generated', {
      promptCount: fallbackStoryboard.prompts.length,
      confidence: fallbackStoryboard.metadata.confidence
    });
    agentMetrics.recordExtractionMethod(ExtractionMethod.FALLBACK_TEXT);
    
    // Convert BasicStoryboard to StoryboardOutput format
    return {
      prompts: fallbackStoryboard.prompts.map((p, i) => ({
        text: p.prompt || '',
        mood: p.mood || 'neutral',
        timestamp: p.timestamp || `00:${String(i * 10).padStart(2, '0')}`,
      }))
    } as StoryboardOutput;
  }

  agentLogger.warn('No valid storyboard JSON found in content');
  return null;
}

// Import StoryboardData type for internal use
import type { StoryboardData } from './jsonExtractor';

function convertToImagePrompts(prompts: StoryboardOutput["prompts"]): ImagePrompt[] {
  return prompts.map((p, i) => ({
    id: `agent-prompt-${Date.now()}-${i}`,
    text: p.text,
    mood: p.mood,
    timestamp: p.timestamp,
    timestampSeconds: parseSRTTimestamp(p.timestamp) ?? 0,
  }));
}

// Export tools for testing
export const agentTools = {
  analyzeContentTool,
  searchVisualReferencesTool,
  generateStoryboardTool,
  refinePromptTool,
  critiqueStoryboardTool,
};

// Export helper functions for testing
export { extractStoryboardFromContent, convertToImagePrompts };

// Export logging and metrics for monitoring
export { agentLogger, agentMetrics };
