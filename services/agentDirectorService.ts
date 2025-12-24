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
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ImagePrompt } from "../types";
import { VideoPurpose, CAMERA_ANGLES, LIGHTING_MOODS } from "../constants";
import { 
  lintPrompt, 
  getPurposeGuidance, 
  refineImagePrompt,
  type PromptLintIssue 
} from "./promptService";
import { parseSRTTimestamp } from "../utils/srtParser";
import { 
  type AnalysisOutput,
  type StoryboardOutput,
  runAnalyzer,
  runStoryboarder,
} from "./directorService";

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
Use this FIRST to understand the content before generating storyboards.`,
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
 * Tool: Generate Storyboard
 */
const generateStoryboardTool = tool(
  async ({ 
    analysisJson, 
    style, 
    videoPurpose, 
    globalSubject 
  }: { 
    analysisJson: string; 
    style: string; 
    videoPurpose: string;
    globalSubject: string;
  }) => {
    try {
      console.log("[AgentDirector] Generating storyboard...");
      const analysis: AnalysisOutput = JSON.parse(analysisJson);
      const storyboard = await runStoryboarder(
        analysis, 
        style, 
        videoPurpose as VideoPurpose,
        globalSubject
      );
      return JSON.stringify(storyboard, null, 2);
    } catch (error) {
      return `Storyboard generation failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "generate_storyboard",
    description: `Generate a visual storyboard with 10 detailed image prompts based on content analysis.
Use this AFTER analyzing content.`,
    schema: z.object({
      analysisJson: z.string().describe("The JSON output from analyze_content tool"),
      style: z.string().describe("Art style"),
      videoPurpose: z.string().describe("Video purpose"),
      globalSubject: z.string().default("").describe("Main subject (can be empty)"),
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
      previousPrompts: z.array(z.string()).describe("Previous prompts to avoid repetition"),
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
      const storyboard: StoryboardOutput = JSON.parse(storyboardJson);
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
    const uniqueIndices = [...new Set(errorPrompts.map(i => i.promptIndex))];
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
}

const DEFAULT_AGENT_CONFIG: Required<AgentDirectorConfig> = {
  model: "gemini-2.0-flash",
  temperature: 0.7,
  maxIterations: 2,
  qualityThreshold: 70,
};

const DIRECTOR_SYSTEM_PROMPT = `You are an expert music video director. Create compelling visual storyboards.

## Workflow
1. ANALYZE content using analyze_content tool
2. SEARCH for visual references if needed
3. GENERATE storyboard using generate_storyboard with the analysis
4. CRITIQUE your work using critique_storyboard
5. REFINE weak prompts if score < threshold

## Quality Standards
- Each prompt: 60-120 words with specific visual details
- Include: subject + action + environment + lighting + camera angle
- NO text, logos, or watermarks
- Vary camera angles across scenes
- Match visual intensity to emotional intensity

When done, output the final storyboard JSON.`;

// --- Tool Execution Helper ---

async function executeToolCall(
  toolCall: { name: string; args: Record<string, unknown> }
): Promise<string> {
  const { name, args } = toolCall;
  
  // Sanitize args to handle null values
  const sanitizedArgs = { ...args };
  for (const [key, value] of Object.entries(sanitizedArgs)) {
    if (value === null || value === undefined) {
      sanitizedArgs[key] = '';
    }
  }
  
  switch (name) {
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
  
  console.log("[AgentDirector] Starting agent workflow...");

  if (!srtContent || srtContent.trim().length === 0) {
    console.warn("[AgentDirector] Empty content provided");
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY || 
                 process.env.VITE_GEMINI_API_KEY || 
                 process.env.API_KEY || 
                 "";

  if (!apiKey) {
    console.error("[AgentDirector] No API key found");
    throw new Error("API key not configured");
  }

  try {
    // Create model with tools bound
    const model = new ChatGoogleGenerativeAI({
      model: mergedConfig.model,
      temperature: mergedConfig.temperature,
      apiKey,
    }).bindTools(allTools);

    // Initial message
    const taskMessage = `Create a visual storyboard for this ${contentType} content.

Style: ${style}
Video Purpose: ${videoPurpose}
Global Subject: ${globalSubject || "None"}
Quality Threshold: ${mergedConfig.qualityThreshold}

Content:
${srtContent}

Follow workflow: analyze → generate → critique → refine if needed.`;

    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
      new HumanMessage(DIRECTOR_SYSTEM_PROMPT + "\n\n" + taskMessage),
    ];

    let finalStoryboard: StoryboardOutput | null = null;
    let iterations = 0;
    const maxIterations = mergedConfig.maxIterations + 3; // Allow for tool calls

    // Agent loop
    while (iterations < maxIterations) {
      iterations++;
      console.log(`[AgentDirector] Iteration ${iterations}...`);

      const response = await model.invoke(messages);
      messages.push(response);

      // Check for tool calls
      const toolCalls = response.tool_calls || [];
      
      if (toolCalls.length === 0) {
        // No more tool calls - try to extract final result
        console.log("[AgentDirector] No tool calls, extracting result...");
        finalStoryboard = extractStoryboardFromContent(response.content as string);
        break;
      }

      // Execute tool calls
      for (const toolCall of toolCalls) {
        console.log(`[AgentDirector] Executing tool: ${toolCall.name}`);
        const result = await executeToolCall({
          name: toolCall.name,
          args: toolCall.args as Record<string, unknown>,
        });

        messages.push(new ToolMessage({
          content: result,
          tool_call_id: toolCall.id || `call_${Date.now()}`,
        }));

        // Track storyboard results
        if (toolCall.name === "generate_storyboard") {
          try {
            finalStoryboard = JSON.parse(result);
          } catch {
            // Will try to extract later
          }
        }
      }
    }

    // Convert to ImagePrompts
    if (finalStoryboard?.prompts) {
      const prompts = convertToImagePrompts(finalStoryboard.prompts);
      const duration = Date.now() - startTime;
      console.log(`[AgentDirector] Complete: ${prompts.length} prompts in ${duration}ms`);
      return prompts;
    }

    console.warn("[AgentDirector] No storyboard generated");
    return [];

  } catch (error) {
    console.error("[AgentDirector] Agent execution failed:", error);
    throw error;
  }
}

function extractStoryboardFromContent(content: string): StoryboardOutput | null {
  const jsonMatch = content.match(/\{[\s\S]*"prompts"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
  return null;
}

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
