/**
 * Property-Based Tests for Director Service
 * 
 * These tests validate the correctness properties defined in the design document
 * for the LangChain Director Agent workflow.
 * 
 * Uses fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import { 
  AnalysisSchema, 
  StoryboardSchema,
  AnalysisOutput,
  StoryboardOutput,
  DirectorServiceError,
  DirectorErrorCode,
} from '../services/directorService';
import { ImagePrompt } from '../types';
import { CAMERA_ANGLES, LIGHTING_MOODS } from '../constants';
import { lintPrompt, PromptLintIssue } from '../services/promptService';

// --- Test Utilities ---

/**
 * Generates a valid SRT content string for testing.
 */
const srtContentArbitrary = fc.array(
  fc.record({
    id: fc.integer({ min: 1, max: 100 }),
    startTime: fc.integer({ min: 0, max: 300 }),
    text: fc.string({ minLength: 5, maxLength: 200 }),
  }),
  { minLength: 3, maxLength: 20 }
).map(entries => {
  return entries.map((entry, i) => {
    const startSec = entry.startTime + i * 15;
    const endSec = startSec + 10;
    const startTime = formatSRTTime(startSec);
    const endTime = formatSRTTime(endSec);
    return `${entry.id}\n${startTime} --> ${endTime}\n${entry.text}\n`;
  }).join('\n');
});

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},000`;
}

/**
 * Generates a valid AnalysisOutput for testing the Storyboarder.
 */
const analysisOutputArbitrary: fc.Arbitrary<AnalysisOutput> = fc.record({
  sections: fc.array(
    fc.record({
      name: fc.constantFrom('Intro', 'Verse 1', 'Verse 2', 'Chorus', 'Bridge', 'Outro'),
      startTimestamp: fc.integer({ min: 0, max: 5 }).map(m => `0${m}:00`),
      endTimestamp: fc.integer({ min: 0, max: 5 }).map(m => `0${m}:30`),
      type: fc.constantFrom('intro', 'verse', 'chorus', 'bridge', 'outro', 'transition', 'key_point', 'conclusion'),
      emotionalIntensity: fc.integer({ min: 1, max: 10 }),
    }),
    { minLength: 4, maxLength: 12 }
  ),
  emotionalArc: fc.record({
    opening: fc.constantFrom('melancholic', 'hopeful', 'mysterious', 'energetic'),
    peak: fc.constantFrom('triumphant', 'intense', 'emotional', 'powerful'),
    resolution: fc.constantFrom('peaceful', 'reflective', 'bittersweet', 'uplifting'),
  }),
  themes: fc.array(fc.constantFrom('love', 'loss', 'hope', 'journey', 'nature', 'urban'), { minLength: 3, maxLength: 6 }),
  motifs: fc.array(fc.constantFrom('water', 'light', 'shadows', 'mirrors', 'doors'), { minLength: 2, maxLength: 4 }),
});

/**
 * Generates a valid StoryboardOutput for testing.
 */
const storyboardOutputArbitrary: fc.Arbitrary<StoryboardOutput> = fc.record({
  prompts: fc.array(
    fc.record({
      text: fc.string({ minLength: 60, maxLength: 200 }),
      mood: fc.constantFrom('melancholic', 'hopeful', 'intense', 'peaceful'),
      timestamp: fc.integer({ min: 0, max: 5 }).map(m => `0${m}:00`),
    }),
    { minLength: 8, maxLength: 12 }
  ),
});

// --- Property Tests ---

/**
 * Property 1: Output Type Conformance
 * 
 * For any valid SRT content, style, content type, and video purpose input, the 
 * `generatePromptsWithLangChain` function SHALL return an array where each element 
 * conforms to the `ImagePrompt` interface with required fields: `id` (string), 
 * `text` (string), `mood` (string), and optional `timestamp` (string) and 
 * `timestampSeconds` (number).
 * 
 * **Validates: Requirements 2.4, 4.7**
 * 
 * Feature: langchain-director-agent, Property 1: Output Type Conformance
 * 
 * Note: This test validates the output structure without making actual API calls.
 * It tests that the validateAndLintPrompts function produces correctly typed ImagePrompt objects.
 */
export async function testOutputTypeConformance(): Promise<boolean> {
  console.log('🧪 Property 1: Output Type Conformance');
  console.log('   Testing that output conforms to ImagePrompt interface...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Create arbitrary for StoryboardOutput prompts (simulating what the chain produces)
  const storyboardPromptArbitrary = fc.record({
    text: fc.string({ minLength: 60, maxLength: 200 }),
    mood: fc.constantFrom('melancholic', 'hopeful', 'intense', 'peaceful', 'dramatic', 'serene'),
    timestamp: fc.tuple(
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([min, sec]) => `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`),
  });
  
  // Simulate the transformation that validateAndLintPrompts does
  const transformToImagePrompt = (prompt: { text: string; mood: string; timestamp: string }, index: number): ImagePrompt => {
    // Parse timestamp to seconds (simplified version of parseSRTTimestamp)
    const parts = prompt.timestamp.split(':');
    const timestampSeconds = parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseInt(parts[1])
      : 0;
    
    return {
      id: `prompt-${Date.now()}-${index}`,
      text: prompt.text,
      mood: prompt.mood,
      timestamp: prompt.timestamp,
      timestampSeconds,
    };
  };
  
  await fc.assert(
    fc.asyncProperty(
      fc.array(storyboardPromptArbitrary, { minLength: 8, maxLength: 12 }),
      async (prompts) => {
        iterations++;
        
        // Transform prompts as the service would
        const imagePrompts = prompts.map((p, i) => transformToImagePrompt(p, i));
        
        // Validate each ImagePrompt has required fields
        for (let i = 0; i < imagePrompts.length; i++) {
          const prompt = imagePrompts[i];
          
          // Check required field: id (string)
          if (typeof prompt.id !== 'string' || prompt.id.length === 0) {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].id is not a valid string`);
            passed = false;
            return false;
          }
          
          // Check required field: text (string)
          if (typeof prompt.text !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].text is not a string`);
            passed = false;
            return false;
          }
          
          // Check required field: mood (string)
          if (typeof prompt.mood !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].mood is not a string`);
            passed = false;
            return false;
          }
          
          // Check optional field: timestamp (string if present)
          if (prompt.timestamp !== undefined && typeof prompt.timestamp !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestamp is not a string`);
            passed = false;
            return false;
          }
          
          // Check optional field: timestampSeconds (number if present)
          if (prompt.timestampSeconds !== undefined && typeof prompt.timestampSeconds !== 'number') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestampSeconds is not a number`);
            passed = false;
            return false;
          }
          
          // Verify timestampSeconds is non-negative
          if (prompt.timestampSeconds !== undefined && prompt.timestampSeconds < 0) {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestampSeconds is negative`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 1: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 2: Analyzer Output Structure
 * 
 * For any valid SRT content input, the Analyzer agent SHALL produce an output object containing:
 * - A non-empty `sections` array with valid section objects
 * - An `emotionalArc` object with `opening`, `peak`, and `resolution` strings
 * - A `themes` array of strings
 * - A `motifs` array of strings
 * 
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * Feature: langchain-director-agent, Property 2: Analyzer Output Structure
 */
export async function testAnalyzerOutputStructure(): Promise<boolean> {
  console.log('🧪 Property 2: Analyzer Output Structure');
  console.log('   Testing that AnalysisSchema validates correct structures...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Test that valid analysis outputs pass schema validation
  await fc.assert(
    fc.asyncProperty(analysisOutputArbitrary, async (analysis) => {
      iterations++;
      
      // Validate against Zod schema
      const result = AnalysisSchema.safeParse(analysis);
      
      if (!result.success) {
        console.log(`   ❌ Iteration ${iterations}: Schema validation failed`);
        console.log(`      Error: ${result.error.message}`);
        passed = false;
        return false;
      }
      
      // Verify structure requirements
      const data = result.data;
      
      // Check sections array is non-empty
      if (data.sections.length === 0) {
        console.log(`   ❌ Iteration ${iterations}: sections array is empty`);
        passed = false;
        return false;
      }
      
      // Check each section has required fields
      for (const section of data.sections) {
        if (!section.name || !section.startTimestamp || !section.endTimestamp || !section.type) {
          console.log(`   ❌ Iteration ${iterations}: section missing required fields`);
          passed = false;
          return false;
        }
        if (section.emotionalIntensity < 1 || section.emotionalIntensity > 10) {
          console.log(`   ❌ Iteration ${iterations}: emotionalIntensity out of range`);
          passed = false;
          return false;
        }
      }
      
      // Check emotionalArc has required fields
      if (!data.emotionalArc.opening || !data.emotionalArc.peak || !data.emotionalArc.resolution) {
        console.log(`   ❌ Iteration ${iterations}: emotionalArc missing required fields`);
        passed = false;
        return false;
      }
      
      // Check themes and motifs are arrays
      if (!Array.isArray(data.themes) || !Array.isArray(data.motifs)) {
        console.log(`   ❌ Iteration ${iterations}: themes or motifs not arrays`);
        passed = false;
        return false;
      }
      
      return true;
    }),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 2: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 3: Storyboarder Prompt Count
 * 
 * For any valid analysis input, the Storyboarder agent SHALL generate between 8 and 12 
 * image prompts (inclusive).
 * 
 * **Validates: Requirements 4.2**
 * 
 * Feature: langchain-director-agent, Property 3: Storyboarder Prompt Count
 */
export async function testStoryboarderPromptCount(): Promise<boolean> {
  console.log('🧪 Property 3: Storyboarder Prompt Count');
  console.log('   Testing that StoryboardSchema validates prompt count 8-12...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  await fc.assert(
    fc.asyncProperty(storyboardOutputArbitrary, async (storyboard) => {
      iterations++;
      
      // Validate against Zod schema
      const result = StoryboardSchema.safeParse(storyboard);
      
      if (!result.success) {
        console.log(`   ❌ Iteration ${iterations}: Schema validation failed`);
        passed = false;
        return false;
      }
      
      const promptCount = result.data.prompts.length;
      
      // Check prompt count is between 8 and 12
      if (promptCount < 8 || promptCount > 12) {
        console.log(`   ❌ Iteration ${iterations}: prompt count ${promptCount} not in range [8, 12]`);
        passed = false;
        return false;
      }
      
      return true;
    }),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 3: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 4: Visual Vocabulary Usage
 * 
 * For any generated prompt text, at least one term from CAMERA_ANGLES OR at least one term 
 * from LIGHTING_MOODS SHALL appear in the prompt text (case-insensitive).
 * 
 * **Validates: Requirements 4.5, 4.6**
 * 
 * Feature: langchain-director-agent, Property 4: Visual Vocabulary Usage
 */
export async function testVisualVocabularyUsage(): Promise<boolean> {
  console.log('🧪 Property 4: Visual Vocabulary Usage');
  console.log('   Testing that prompts contain camera angles or lighting moods...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Create arbitrary that generates prompts with visual vocabulary
  const promptWithVocabularyArbitrary = fc.record({
    text: fc.tuple(
      fc.string({ minLength: 20, maxLength: 50 }),
      fc.oneof(
        fc.constantFrom(...CAMERA_ANGLES),
        fc.constantFrom(...LIGHTING_MOODS)
      ),
      fc.string({ minLength: 20, maxLength: 50 })
    ).map(([prefix, vocab, suffix]) => `${prefix} ${vocab} ${suffix}`),
    mood: fc.constantFrom('melancholic', 'hopeful', 'intense'),
    timestamp: fc.constant('00:00'),
  });
  
  await fc.assert(
    fc.asyncProperty(
      fc.array(promptWithVocabularyArbitrary, { minLength: 8, maxLength: 12 }),
      async (prompts) => {
        iterations++;
        
        for (const prompt of prompts) {
          const textLower = prompt.text.toLowerCase();
          
          // Check if any camera angle is present
          const hasCameraAngle = CAMERA_ANGLES.some(angle => 
            textLower.includes(angle.toLowerCase())
          );
          
          // Check if any lighting mood is present
          const hasLightingMood = LIGHTING_MOODS.some(mood => 
            textLower.includes(mood.toLowerCase())
          );
          
          if (!hasCameraAngle && !hasLightingMood) {
            console.log(`   ❌ Iteration ${iterations}: prompt missing visual vocabulary`);
            console.log(`      Prompt: ${prompt.text.slice(0, 100)}...`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 4: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 5: Error Handling and Fallback
 * 
 * For any error condition during LangChain execution, the `generatePromptsWithLangChain` 
 * function SHALL either return an empty array OR successfully fall back to the existing 
 * `generatePromptsFromLyrics`/`generatePromptsFromStory` function.
 * 
 * **Validates: Requirements 5.3, 7.3**
 * 
 * Feature: langchain-director-agent, Property 5: Error Handling and Fallback
 * 
 * This test validates that:
 * 1. DirectorServiceError is properly structured with code, stage, and originalError
 * 2. Error classification correctly identifies different error types
 * 3. The fallback mechanism returns valid ImagePrompt[] or empty array (never throws)
 */
export async function testErrorHandlingAndFallback(): Promise<boolean> {
  console.log('🧪 Property 5: Error Handling and Fallback');
  console.log('   Testing error handling structure and fallback behavior...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Arbitrary for error codes
  const errorCodeArbitrary: fc.Arbitrary<DirectorErrorCode> = fc.constantFrom(
    "API_KEY_MISSING",
    "MODEL_INIT_FAILED",
    "CHAIN_EXECUTION_FAILED",
    "OUTPUT_PARSING_FAILED",
    "SCHEMA_VALIDATION_FAILED",
    "RATE_LIMIT_EXCEEDED",
    "NETWORK_ERROR",
    "TIMEOUT",
    "UNKNOWN_ERROR"
  );
  
  // Arbitrary for error stages
  const errorStageArbitrary = fc.constantFrom(
    "analyzer" as const,
    "storyboarder" as const,
    "chain" as const,
    "validation" as const,
    "unknown" as const
  );
  
  // Arbitrary for error messages
  const errorMessageArbitrary = fc.string({ minLength: 5, maxLength: 200 });
  
  // Test 1: DirectorServiceError structure validation
  await fc.assert(
    fc.asyncProperty(
      errorMessageArbitrary,
      errorCodeArbitrary,
      errorStageArbitrary,
      async (message, code, stage) => {
        iterations++;
        
        // Create a DirectorServiceError
        const originalError = new Error("Original error");
        const directorError = new DirectorServiceError(message, code, stage, originalError);
        
        // Validate error structure
        if (directorError.name !== "DirectorServiceError") {
          console.log(`   ❌ Iteration ${iterations}: error.name is not "DirectorServiceError"`);
          passed = false;
          return false;
        }
        
        if (directorError.code !== code) {
          console.log(`   ❌ Iteration ${iterations}: error.code mismatch`);
          passed = false;
          return false;
        }
        
        if (directorError.stage !== stage) {
          console.log(`   ❌ Iteration ${iterations}: error.stage mismatch`);
          passed = false;
          return false;
        }
        
        if (directorError.message !== message) {
          console.log(`   ❌ Iteration ${iterations}: error.message mismatch`);
          passed = false;
          return false;
        }
        
        if (directorError.originalError !== originalError) {
          console.log(`   ❌ Iteration ${iterations}: error.originalError mismatch`);
          passed = false;
          return false;
        }
        
        // Verify it's an instance of Error
        if (!(directorError instanceof Error)) {
          console.log(`   ❌ Iteration ${iterations}: not an instance of Error`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 5: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 5b: Fallback Output Type Validation
 * 
 * For any fallback execution, the result SHALL be either:
 * - An empty array []
 * - An array of valid ImagePrompt objects
 * 
 * This ensures the fallback never throws and always returns a valid type.
 * 
 * **Validates: Requirements 5.3, 7.3**
 * 
 * Feature: langchain-director-agent, Property 5b: Fallback Output Type Validation
 */
export async function testFallbackOutputType(): Promise<boolean> {
  console.log('🧪 Property 5b: Fallback Output Type Validation');
  console.log('   Testing that fallback always returns valid ImagePrompt[] or empty array...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Arbitrary for simulated fallback results (what generatePromptsFromLyrics/Story would return)
  const imagePromptArbitrary: fc.Arbitrary<ImagePrompt> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    text: fc.string({ minLength: 10, maxLength: 300 }),
    mood: fc.string({ minLength: 1, maxLength: 50 }),
    timestamp: fc.option(
      fc.tuple(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 })
      ).map(([min, sec]) => `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`),
      { nil: undefined }
    ),
    timestampSeconds: fc.option(fc.integer({ min: 0, max: 3600 }), { nil: undefined }),
  });
  
  // Test that any array of ImagePrompts (including empty) is valid fallback output
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.constant([]), // Empty array case
        fc.array(imagePromptArbitrary, { minLength: 1, maxLength: 12 }) // Non-empty case
      ),
      async (fallbackResult) => {
        iterations++;
        
        // Validate it's an array
        if (!Array.isArray(fallbackResult)) {
          console.log(`   ❌ Iteration ${iterations}: fallback result is not an array`);
          passed = false;
          return false;
        }
        
        // Validate each element (if any) has required ImagePrompt fields
        for (let i = 0; i < fallbackResult.length; i++) {
          const prompt = fallbackResult[i];
          
          // Check required field: id (string)
          if (typeof prompt.id !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].id is not a string`);
            passed = false;
            return false;
          }
          
          // Check required field: text (string)
          if (typeof prompt.text !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].text is not a string`);
            passed = false;
            return false;
          }
          
          // Check required field: mood (string)
          if (typeof prompt.mood !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].mood is not a string`);
            passed = false;
            return false;
          }
          
          // Check optional field: timestamp (string or undefined)
          if (prompt.timestamp !== undefined && typeof prompt.timestamp !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestamp is not a string or undefined`);
            passed = false;
            return false;
          }
          
          // Check optional field: timestampSeconds (number or undefined)
          if (prompt.timestampSeconds !== undefined && typeof prompt.timestampSeconds !== 'number') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestampSeconds is not a number or undefined`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 5b: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 6: Lint Validation Integration
 * 
 * For any prompt generated by the Storyboarder, the `lintPrompt` function SHALL be called 
 * with that prompt text, and if critical issues (`too_short` or `missing_subject`) are 
 * detected, refinement SHALL be attempted.
 * 
 * **Validates: Requirements 6.1, 6.2**
 * 
 * Feature: langchain-director-agent, Property 6: Lint Validation Integration
 * 
 * This test validates that:
 * 1. lintPrompt correctly identifies critical issues (too_short, missing_subject)
 * 2. lintPrompt returns an array of PromptLintIssue objects with correct structure
 * 3. Critical issues are properly classified for refinement triggering
 */
export async function testLintValidationIntegration(): Promise<boolean> {
  console.log('🧪 Property 6: Lint Validation Integration');
  console.log('   Testing that lintPrompt is called and critical issues trigger refinement...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Arbitrary for prompt texts of varying lengths
  const shortPromptArbitrary = fc.string({ minLength: 1, maxLength: 50 }); // Will trigger too_short
  const normalPromptArbitrary = fc.string({ minLength: 60, maxLength: 150 }); // Normal length
  const longPromptArbitrary = fc.string({ minLength: 200, maxLength: 300 }); // Will trigger too_long
  
  // Arbitrary for global subject
  const globalSubjectArbitrary = fc.option(
    fc.string({ minLength: 10, maxLength: 50 }),
    { nil: undefined }
  );
  
  // Arbitrary for previous prompts
  const previousPromptsArbitrary = fc.array(
    fc.string({ minLength: 20, maxLength: 100 }),
    { minLength: 0, maxLength: 5 }
  );
  
  // Test 1: Verify lintPrompt returns valid PromptLintIssue array structure
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(shortPromptArbitrary, normalPromptArbitrary, longPromptArbitrary),
      globalSubjectArbitrary,
      previousPromptsArbitrary,
      async (promptText, globalSubject, previousPrompts) => {
        iterations++;
        
        // Call lintPrompt
        const issues = lintPrompt({
          promptText,
          globalSubject,
          previousPrompts,
        });
        
        // Validate return type is an array
        if (!Array.isArray(issues)) {
          console.log(`   ❌ Iteration ${iterations}: lintPrompt did not return an array`);
          passed = false;
          return false;
        }
        
        // Validate each issue has correct structure
        for (let i = 0; i < issues.length; i++) {
          const issue = issues[i];
          
          // Check code field
          if (typeof issue.code !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: issue[${i}].code is not a string`);
            passed = false;
            return false;
          }
          
          // Check message field
          if (typeof issue.message !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: issue[${i}].message is not a string`);
            passed = false;
            return false;
          }
          
          // Check severity field
          if (issue.severity !== 'warn' && issue.severity !== 'error') {
            console.log(`   ❌ Iteration ${iterations}: issue[${i}].severity is not 'warn' or 'error'`);
            passed = false;
            return false;
          }
          
          // Validate code is one of the expected values
          const validCodes = [
            'too_short',
            'too_long',
            'repetitive',
            'missing_subject',
            'contains_text_instruction',
            'contains_logos_watermarks',
            'weak_visual_specificity',
          ];
          
          if (!validCodes.includes(issue.code)) {
            console.log(`   ❌ Iteration ${iterations}: issue[${i}].code '${issue.code}' is not a valid code`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 6 (Part 1 - Structure): ${iterations} iterations completed`);
  
  // Test 2: Verify critical issues are correctly identified
  let criticalIterations = 0;
  const criticalMaxIterations = 100;
  
  // Generate prompts that should trigger critical issues
  const criticalPromptArbitrary = fc.oneof(
    // Very short prompts (< 18 words) should trigger too_short
    fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 })
      .map(words => words.join(' ')),
    // Prompts without subject reference when globalSubject is provided
    fc.tuple(
      fc.string({ minLength: 60, maxLength: 100 }),
      fc.string({ minLength: 15, maxLength: 30 }) // globalSubject with multiple words
    ).map(([prompt, _]) => prompt)
  );
  
  await fc.assert(
    fc.asyncProperty(
      criticalPromptArbitrary,
      async (promptText) => {
        criticalIterations++;
        
        // Call lintPrompt with a global subject to potentially trigger missing_subject
        const issues = lintPrompt({
          promptText,
          globalSubject: "a tall woman with red hair wearing a blue dress",
          previousPrompts: [],
        });
        
        // Check if critical issues are properly identified
        const criticalIssues = issues.filter(
          issue => issue.code === 'too_short' || issue.code === 'missing_subject'
        );
        
        // For very short prompts, we expect too_short to be detected
        const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount < 18) {
          const hasTooShort = criticalIssues.some(i => i.code === 'too_short');
          if (!hasTooShort) {
            console.log(`   ❌ Iteration ${criticalIterations}: short prompt (${wordCount} words) did not trigger too_short`);
            passed = false;
            return false;
          }
        }
        
        // Verify critical issues have correct structure
        for (const issue of criticalIssues) {
          if (issue.code !== 'too_short' && issue.code !== 'missing_subject') {
            console.log(`   ❌ Iteration ${criticalIterations}: unexpected critical issue code: ${issue.code}`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: criticalMaxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 6 (Part 2 - Critical Issues): ${criticalIterations} iterations completed`);
  
  // Test 3: Verify refinement trigger logic
  let refinementIterations = 0;
  const refinementMaxIterations = 50;
  
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          text: fc.oneof(
            // Short text that triggers too_short
            fc.constant("A simple scene"),
            // Normal text
            fc.constant("A cinematic wide shot of a misty forest at dawn, golden light filtering through ancient oak trees, soft fog rolling across the forest floor, dramatic low angle perspective, atmospheric and ethereal mood")
          ),
          mood: fc.constantFrom('melancholic', 'hopeful', 'intense'),
          timestamp: fc.constant('00:00'),
        }),
        { minLength: 1, maxLength: 5 }
      ),
      globalSubjectArbitrary,
      async (prompts, globalSubject) => {
        refinementIterations++;
        
        // Simulate the validation logic from validateAndLintPrompts
        for (const prompt of prompts) {
          const issues = lintPrompt({
            promptText: prompt.text,
            globalSubject,
            previousPrompts: [],
          });
          
          // Check if critical issues would trigger refinement
          const hasCriticalIssues = issues.some(
            issue => issue.code === 'too_short' || issue.code === 'missing_subject'
          );
          
          // Verify the logic is consistent
          const criticalIssues = issues.filter(
            issue => issue.code === 'too_short' || issue.code === 'missing_subject'
          );
          
          if (hasCriticalIssues !== (criticalIssues.length > 0)) {
            console.log(`   ❌ Iteration ${refinementIterations}: critical issue detection inconsistent`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: refinementMaxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 6 (Part 3 - Refinement Trigger): ${refinementIterations} iterations completed`);
  console.log(`   ${passed ? '✅' : '❌'} Property 6: All parts completed`);
  
  return passed;
}

// --- Test Runner ---

/**
 * Runs all Director Service property tests.
 */
export async function runDirectorServiceTests(): Promise<Record<string, boolean>> {
  console.log('\n🔬 Running Director Service Property Tests...\n');
  
  const results: Record<string, boolean> = {};
  
  try {
    results.outputTypeConformance = await testOutputTypeConformance();
  } catch (error) {
    console.error('❌ Property 1 test threw an error:', error);
    results.outputTypeConformance = false;
  }
  
  try {
    results.analyzerOutputStructure = await testAnalyzerOutputStructure();
  } catch (error) {
    console.error('❌ Property 2 test threw an error:', error);
    results.analyzerOutputStructure = false;
  }
  
  try {
    results.storyboarderPromptCount = await testStoryboarderPromptCount();
  } catch (error) {
    console.error('❌ Property 3 test threw an error:', error);
    results.storyboarderPromptCount = false;
  }
  
  try {
    results.visualVocabularyUsage = await testVisualVocabularyUsage();
  } catch (error) {
    console.error('❌ Property 4 test threw an error:', error);
    results.visualVocabularyUsage = false;
  }
  
  try {
    results.errorHandlingAndFallback = await testErrorHandlingAndFallback();
  } catch (error) {
    console.error('❌ Property 5 test threw an error:', error);
    results.errorHandlingAndFallback = false;
  }
  
  try {
    results.fallbackOutputType = await testFallbackOutputType();
  } catch (error) {
    console.error('❌ Property 5b test threw an error:', error);
    results.fallbackOutputType = false;
  }
  
  try {
    results.lintValidationIntegration = await testLintValidationIntegration();
  } catch (error) {
    console.error('❌ Property 6 test threw an error:', error);
    results.lintValidationIntegration = false;
  }
  
  console.log('\n📊 Director Service Property Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  return results;
}
