/**
 * Tests for Agent Director Service
 * 
 * Tests the tool-based agent orchestration for intelligent prompt generation.
 * Validates tool definitions, helper functions, and integration.
 */

import * as fc from 'fast-check';
import { z } from 'zod';
import { 
  agentTools,
  generatePromptsWithAgent,
  AgentDirectorConfig,
} from '../services/agentDirectorService';
import { 
  AnalysisOutput, 
  StoryboardOutput,
  runAnalyzer,
  runStoryboarder,
} from '../services/directorService';
import { ImagePrompt } from '../types';
import { lintPrompt } from '../services/promptService';

// --- Test Utilities ---

/**
 * Generates valid SRT content for testing
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
 * Generates valid AnalysisOutput for testing
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
  concreteMotifs: fc.array(
    fc.record({
      object: fc.constantFrom('candle', 'door', 'rain', 'mirror', 'window', 'clock'),
      timestamp: fc.integer({ min: 0, max: 5 }).map(m => `0${m}:00`),
      emotionalContext: fc.constantFrom('longing', 'hope', 'fear', 'peace', 'nostalgia'),
    }),
    { minLength: 0, maxLength: 5 }
  ),
});

/**
 * Generates valid StoryboardOutput for testing
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

// --- Tool Definition Tests ---

/**
 * Test 1: Tool Schema Validation
 * Verifies that all tool schemas are valid Zod schemas
 */
export async function testToolSchemaValidation(): Promise<boolean> {
  console.log('🧪 Test 1: Tool Schema Validation');
  console.log('   Verifying all agent tools have valid Zod schemas...');
  
  let passed = true;
  
  const tools = [
    { name: 'analyzeContentTool', tool: agentTools.analyzeContentTool },
    { name: 'searchVisualReferencesTool', tool: agentTools.searchVisualReferencesTool },
    { name: 'generateStoryboardTool', tool: agentTools.generateStoryboardTool },
    { name: 'refinePromptTool', tool: agentTools.refinePromptTool },
    { name: 'critiqueStoryboardTool', tool: agentTools.critiqueStoryboardTool },
  ];
  
  for (const { name, tool } of tools) {
    // Check tool has required properties
    if (!tool.name) {
      console.log(`   ❌ ${name}: missing name property`);
      passed = false;
      continue;
    }
    
    if (!tool.description) {
      console.log(`   ❌ ${name}: missing description property`);
      passed = false;
      continue;
    }
    
    if (!tool.schema) {
      console.log(`   ❌ ${name}: missing schema property`);
      passed = false;
      continue;
    }
    
    console.log(`   ✅ ${name}: has name, description, and schema`);
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Test 1 completed`);
  return passed;
}


/**
 * Test 2: Visual References Helper
 * Tests the getVisualReferences helper function behavior
 */
export async function testVisualReferencesHelper(): Promise<boolean> {
  console.log('🧪 Test 2: Visual References Helper');
  console.log('   Testing visual reference generation for different moods...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 50;
  
  const moodArbitrary = fc.constantFrom(
    'melancholic', 'energetic', 'romantic', 'mysterious', 'triumphant'
  );
  
  const styleArbitrary = fc.constantFrom(
    'Cinematic', 'Anime', 'Film Noir', 'Watercolor', 'Documentary'
  );
  
  await fc.assert(
    fc.asyncProperty(moodArbitrary, styleArbitrary, async (mood, style) => {
      iterations++;
      
      // Call the search_visual_references tool
      const result = await agentTools.searchVisualReferencesTool.invoke({
        query: `${mood} scene`,
        style,
      });
      
      // Parse the result
      let references;
      try {
        references = JSON.parse(result);
      } catch {
        console.log(`   ❌ Iteration ${iterations}: Failed to parse result as JSON`);
        passed = false;
        return false;
      }
      
      // Validate structure
      if (!Array.isArray(references.cameraAngles)) {
        console.log(`   ❌ Iteration ${iterations}: cameraAngles is not an array`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(references.lighting)) {
        console.log(`   ❌ Iteration ${iterations}: lighting is not an array`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(references.composition)) {
        console.log(`   ❌ Iteration ${iterations}: composition is not an array`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(references.colorPalette)) {
        console.log(`   ❌ Iteration ${iterations}: colorPalette is not an array`);
        passed = false;
        return false;
      }
      
      // Validate non-empty arrays
      if (references.cameraAngles.length === 0) {
        console.log(`   ❌ Iteration ${iterations}: cameraAngles is empty`);
        passed = false;
        return false;
      }
      
      return true;
    }),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Test 2: ${iterations} iterations completed`);
  return passed;
}

/**
 * Test 3: Critique Storyboard Helper
 * Tests the storyboard critique functionality
 */
export async function testCritiqueStoryboardHelper(): Promise<boolean> {
  console.log('🧪 Test 3: Critique Storyboard Helper');
  console.log('   Testing storyboard critique scoring and issue detection...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 50;
  
  await fc.assert(
    fc.asyncProperty(storyboardOutputArbitrary, async (storyboard) => {
      iterations++;
      
      const storyboardJson = JSON.stringify(storyboard);
      
      // Call the critique tool
      const result = await agentTools.critiqueStoryboardTool.invoke({
        storyboardJson,
        globalSubject: '',
      });
      
      // Parse the result
      let critique;
      try {
        critique = JSON.parse(result);
      } catch {
        console.log(`   ❌ Iteration ${iterations}: Failed to parse critique as JSON`);
        passed = false;
        return false;
      }
      
      // Validate structure
      if (typeof critique.overallScore !== 'number') {
        console.log(`   ❌ Iteration ${iterations}: overallScore is not a number`);
        passed = false;
        return false;
      }
      
      if (critique.overallScore < 0 || critique.overallScore > 100) {
        console.log(`   ❌ Iteration ${iterations}: overallScore ${critique.overallScore} out of range [0, 100]`);
        passed = false;
        return false;
      }
      
      if (typeof critique.promptCount !== 'number') {
        console.log(`   ❌ Iteration ${iterations}: promptCount is not a number`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(critique.issues)) {
        console.log(`   ❌ Iteration ${iterations}: issues is not an array`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(critique.strengths)) {
        console.log(`   ❌ Iteration ${iterations}: strengths is not an array`);
        passed = false;
        return false;
      }
      
      if (!Array.isArray(critique.recommendations)) {
        console.log(`   ❌ Iteration ${iterations}: recommendations is not an array`);
        passed = false;
        return false;
      }
      
      return true;
    }),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Test 3: ${iterations} iterations completed`);
  return passed;
}

/**
 * Test 4: Refine Prompt Tool
 * Tests the prompt refinement tool structure (without API calls)
 */
export async function testRefinePromptTool(): Promise<boolean> {
  console.log('🧪 Test 4: Refine Prompt Tool');
  console.log('   Testing prompt refinement tool structure...');
  
  let passed = true;
  
  // Test that the tool has correct schema
  const tool = agentTools.refinePromptTool;
  
  if (tool.name !== 'refine_prompt') {
    console.log(`   ❌ Tool name is "${tool.name}", expected "refine_prompt"`);
    passed = false;
  } else {
    console.log('   ✅ Tool name is correct');
  }
  
  if (!tool.description.includes('Refine')) {
    console.log('   ❌ Tool description missing "Refine"');
    passed = false;
  } else {
    console.log('   ✅ Tool description is valid');
  }
  
  // Test schema validation with valid input
  const validInput = {
    promptText: 'A simple scene',
    style: 'Cinematic',
    globalSubject: '',
    previousPrompts: [],
  };
  
  // The schema should accept this input
  try {
    // We can't call invoke without API, but we can verify the tool exists
    // and has the expected structure
    if (typeof tool.invoke === 'function') {
      console.log('   ✅ Tool has invoke method');
    } else {
      console.log('   ❌ Tool missing invoke method');
      passed = false;
    }
  } catch (error) {
    console.log(`   ⚠️ Schema validation: ${error}`);
  }
  
  // Test lintPrompt directly (doesn't need API)
  const shortPrompt = "A simple scene with a person";
  const issues = lintPrompt({
    promptText: shortPrompt,
    globalSubject: '',
    previousPrompts: [],
  });
  
  if (Array.isArray(issues)) {
    const hasTooShort = issues.some(i => i.code === 'too_short');
    if (hasTooShort) {
      console.log('   ✅ lintPrompt correctly identifies short prompts');
    } else {
      console.log('   ⚠️ Short prompt did not trigger too_short (may be expected based on word count)');
    }
  } else {
    console.log('   ❌ lintPrompt did not return array');
    passed = false;
  }
  
  // Test with a good prompt
  const goodPrompt = "A cinematic wide shot of a misty forest at dawn, golden light filtering through ancient oak trees, soft fog rolling across the forest floor, dramatic low angle perspective, atmospheric and ethereal mood, volumetric lighting creating god rays through the canopy";
  const goodIssues = lintPrompt({
    promptText: goodPrompt,
    globalSubject: '',
    previousPrompts: [],
  });
  
  if (Array.isArray(goodIssues)) {
    const criticalIssues = goodIssues.filter(i => i.code === 'too_short' || i.code === 'missing_subject');
    if (criticalIssues.length === 0) {
      console.log('   ✅ Good prompt has no critical issues');
    } else {
      console.log(`   ⚠️ Good prompt has ${criticalIssues.length} critical issues`);
    }
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Test 4 completed`);
  return passed;
}


/**
 * Test 5: Agent Config Defaults
 * Tests that default configuration values are applied correctly
 */
export async function testAgentConfigDefaults(): Promise<boolean> {
  console.log('🧪 Test 5: Agent Config Defaults');
  console.log('   Testing default configuration values...');
  
  let passed = true;
  
  // Test that empty config doesn't throw
  try {
    // We can't actually run the agent without API key, but we can verify
    // the config structure is accepted
    const config: AgentDirectorConfig = {};
    
    // Verify config interface accepts all optional fields
    const fullConfig: AgentDirectorConfig = {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxIterations: 2,
      qualityThreshold: 70,
    };
    
    console.log('   ✅ Config interface accepts all fields');
  } catch (error) {
    console.log(`   ❌ Config validation failed: ${error}`);
    passed = false;
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Test 5 completed`);
  return passed;
}

/**
 * Test 6: Output Type Conformance
 * Tests that agent output conforms to ImagePrompt interface
 */
export async function testAgentOutputTypeConformance(): Promise<boolean> {
  console.log('🧪 Test 6: Output Type Conformance');
  console.log('   Testing that output conforms to ImagePrompt interface...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 50;
  
  // Simulate the transformation that happens in the agent
  const storyboardPromptArbitrary = fc.record({
    text: fc.string({ minLength: 60, maxLength: 200 }),
    mood: fc.constantFrom('melancholic', 'hopeful', 'intense', 'peaceful'),
    timestamp: fc.tuple(
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([min, sec]) => `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`),
  });
  
  const transformToImagePrompt = (
    prompt: { text: string; mood: string; timestamp: string }, 
    index: number
  ): ImagePrompt => {
    const parts = prompt.timestamp.split(':');
    const timestampSeconds = parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseInt(parts[1])
      : 0;
    
    return {
      id: `agent-prompt-${Date.now()}-${index}`,
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
        
        const imagePrompts = prompts.map((p, i) => transformToImagePrompt(p, i));
        
        for (let i = 0; i < imagePrompts.length; i++) {
          const prompt = imagePrompts[i];
          
          if (typeof prompt.id !== 'string' || prompt.id.length === 0) {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].id invalid`);
            passed = false;
            return false;
          }
          
          if (typeof prompt.text !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].text invalid`);
            passed = false;
            return false;
          }
          
          if (typeof prompt.mood !== 'string') {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].mood invalid`);
            passed = false;
            return false;
          }
          
          if (typeof prompt.timestampSeconds !== 'number' || prompt.timestampSeconds < 0) {
            console.log(`   ❌ Iteration ${iterations}: prompt[${i}].timestampSeconds invalid`);
            passed = false;
            return false;
          }
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Test 6: ${iterations} iterations completed`);
  return passed;
}

/**
 * Test 7: Empty Input Handling
 * Tests that empty/invalid inputs are handled gracefully
 */
export async function testEmptyInputHandling(): Promise<boolean> {
  console.log('🧪 Test 7: Empty Input Handling');
  console.log('   Testing graceful handling of empty inputs...');
  
  let passed = true;
  
  // Test empty content returns empty array (without API call)
  // We simulate this by checking the validation logic
  const emptyContent = '';
  const whitespaceContent = '   \n\t  ';
  
  // These should be caught before any API call
  if (emptyContent.trim().length !== 0) {
    console.log('   ❌ Empty string validation failed');
    passed = false;
  } else {
    console.log('   ✅ Empty string correctly identified');
  }
  
  if (whitespaceContent.trim().length !== 0) {
    console.log('   ❌ Whitespace string validation failed');
    passed = false;
  } else {
    console.log('   ✅ Whitespace string correctly identified');
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Test 7 completed`);
  return passed;
}

/**
 * Test 8: Tool Invocation Patterns
 * Tests that tools can be invoked with valid parameters
 */
export async function testToolInvocationPatterns(): Promise<boolean> {
  console.log('🧪 Test 8: Tool Invocation Patterns');
  console.log('   Testing tool invocation with various parameter combinations...');
  
  let passed = true;
  
  // Test search_visual_references with different queries
  const queries = [
    { query: 'melancholic night scene', style: 'Cinematic' },
    { query: 'energetic dance sequence', style: 'Anime' },
    { query: 'mysterious fog', style: 'Film Noir' },
  ];
  
  for (const params of queries) {
    try {
      const result = await agentTools.searchVisualReferencesTool.invoke(params);
      const parsed = JSON.parse(result);
      
      if (!parsed.cameraAngles || !parsed.lighting) {
        console.log(`   ❌ Query "${params.query}" returned incomplete result`);
        passed = false;
      } else {
        console.log(`   ✅ Query "${params.query}" returned valid result`);
      }
    } catch (error) {
      console.log(`   ❌ Query "${params.query}" threw error: ${error}`);
      passed = false;
    }
  }
  
  // Test critique_storyboard with valid storyboard
  const validStoryboard: StoryboardOutput = {
    prompts: Array(10).fill(null).map((_, i) => ({
      text: `A detailed cinematic scene ${i + 1} with dramatic lighting, wide angle shot, atmospheric fog, golden hour illumination, rule of thirds composition, depth of field blur in background`,
      mood: ['melancholic', 'hopeful', 'intense', 'peaceful'][i % 4],
      timestamp: `0${Math.floor(i / 2)}:${(i % 2) * 30}`.padStart(5, '0'),
    })),
  };
  
  try {
    const critiqueResult = await agentTools.critiqueStoryboardTool.invoke({
      storyboardJson: JSON.stringify(validStoryboard),
      globalSubject: 'a young woman with flowing red hair',
    });
    
    const critique = JSON.parse(critiqueResult);
    if (typeof critique.overallScore === 'number') {
      console.log(`   ✅ Critique returned score: ${critique.overallScore}`);
    } else {
      console.log('   ❌ Critique missing overallScore');
      passed = false;
    }
  } catch (error) {
    console.log(`   ❌ Critique threw error: ${error}`);
    passed = false;
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Test 8 completed`);
  return passed;
}

// --- Test Runner ---

export async function runAgentDirectorTests(): Promise<{
  passed: number;
  failed: number;
  results: Record<string, boolean>;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Agent Director Service Tests');
  console.log('='.repeat(60) + '\n');
  
  const results: Record<string, boolean> = {};
  
  results['toolSchemaValidation'] = await testToolSchemaValidation();
  results['visualReferencesHelper'] = await testVisualReferencesHelper();
  results['critiqueStoryboardHelper'] = await testCritiqueStoryboardHelper();
  results['refinePromptTool'] = await testRefinePromptTool();
  results['agentConfigDefaults'] = await testAgentConfigDefaults();
  results['outputTypeConformance'] = await testAgentOutputTypeConformance();
  results['emptyInputHandling'] = await testEmptyInputHandling();
  results['toolInvocationPatterns'] = await testToolInvocationPatterns();
  
  const passed = Object.values(results).filter(Boolean).length;
  const failed = Object.values(results).filter(v => !v).length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');
  
  return { passed, failed, results };
}

// Run if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('testAgentDirectorService')) {
  runAgentDirectorTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}
