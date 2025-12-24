/**
 * Integration Tests for useLyricLens Hook with LangChain Director Service
 * 
 * These tests verify that the useLyricLens hook correctly integrates with
 * the generatePromptsWithLangChain function and handles fallback behavior.
 * 
 * **Validates: Requirements 7.2, 7.3**
 */

import * as fc from 'fast-check';
import { generatePromptsWithLangChain } from '../services/directorService';
import { generatePromptsFromLyrics, generatePromptsFromStory } from '../services/promptService';
import { ImagePrompt } from '../types';
import { VideoPurpose } from '../constants';

// --- Test Utilities ---

/**
 * Sample SRT content for testing
 */
const SAMPLE_SRT_CONTENT = `1
00:00:00,000 --> 00:00:15,000
In the quiet of the morning light

2
00:00:15,000 --> 00:00:30,000
I find myself searching for meaning

3
00:00:30,000 --> 00:00:45,000
Through shadows and dreams we wander

4
00:00:45,000 --> 00:01:00,000
Finding hope in unexpected places

5
00:01:00,000 --> 00:01:15,000
The chorus rises with emotion

6
00:01:15,000 --> 00:01:30,000
Hearts beating as one together

7
00:01:30,000 --> 00:01:45,000
A bridge between worlds we cross

8
00:01:45,000 --> 00:02:00,000
And in the end we find our way home`;

/**
 * Validates that an object conforms to the ImagePrompt interface
 */
function isValidImagePrompt(obj: unknown): obj is ImagePrompt {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const prompt = obj as Record<string, unknown>;
  
  // Required fields
  if (typeof prompt.id !== 'string' || prompt.id.length === 0) return false;
  if (typeof prompt.text !== 'string') return false;
  if (typeof prompt.mood !== 'string') return false;
  
  // Optional fields (if present, must be correct type)
  if (prompt.timestamp !== undefined && typeof prompt.timestamp !== 'string') return false;
  if (prompt.timestampSeconds !== undefined && typeof prompt.timestampSeconds !== 'number') return false;
  
  return true;
}

// --- Integration Tests ---

/**
 * Test 1: Hook Integration - Verify generatePromptsWithLangChain returns valid ImagePrompt[]
 * 
 * This test verifies that the function used by useLyricLens hook returns
 * properly structured ImagePrompt objects.
 * 
 * **Validates: Requirements 7.2**
 */
export async function testHookIntegrationPromptGeneration(): Promise<boolean> {
  console.log('🧪 Integration Test 1: Hook Prompt Generation');
  console.log('   Testing that generatePromptsWithLangChain returns valid ImagePrompt[]...');
  
  let passed = true;
  
  // Test with different content types and purposes
  const testCases: Array<{
    contentType: 'lyrics' | 'story';
    videoPurpose: VideoPurpose;
    style: string;
  }> = [
    { contentType: 'lyrics', videoPurpose: 'music_video', style: 'Cinematic' },
    { contentType: 'story', videoPurpose: 'documentary', style: 'Documentary' },
    { contentType: 'lyrics', videoPurpose: 'lyric_video', style: 'Abstract' },
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`   Testing ${testCase.contentType} with ${testCase.videoPurpose}...`);
      
      // Call the function that the hook uses
      const prompts = await generatePromptsWithLangChain(
        SAMPLE_SRT_CONTENT,
        testCase.style,
        testCase.contentType,
        testCase.videoPurpose,
        'A person walking through a forest',
      );
      
      // Verify return type is an array
      if (!Array.isArray(prompts)) {
        console.log(`   ❌ Result is not an array for ${testCase.contentType}`);
        passed = false;
        continue;
      }
      
      // Verify each element is a valid ImagePrompt
      for (let i = 0; i < prompts.length; i++) {
        if (!isValidImagePrompt(prompts[i])) {
          console.log(`   ❌ prompts[${i}] is not a valid ImagePrompt`);
          passed = false;
          break;
        }
      }
      
      console.log(`   ✅ ${testCase.contentType}/${testCase.videoPurpose}: ${prompts.length} valid prompts`);
      
    } catch (error) {
      // The function should not throw - it should return empty array or fallback
      console.log(`   ❌ Unexpected error for ${testCase.contentType}: ${error}`);
      passed = false;
    }
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Integration Test 1: ${passed ? 'PASSED' : 'FAILED'}`);
  return passed;
}

/**
 * Test 2: Fallback Behavior - Verify fallback works when LangChain fails
 * 
 * This test verifies that when the LangChain workflow encounters issues,
 * the function falls back to the original implementation gracefully.
 * 
 * **Validates: Requirements 7.3**
 */
export async function testHookIntegrationFallback(): Promise<boolean> {
  console.log('🧪 Integration Test 2: Fallback Behavior');
  console.log('   Testing that fallback works correctly...');
  
  let passed = true;
  
  // Test 1: Empty SRT content should trigger fallback and return empty or valid array
  try {
    console.log('   Testing with empty SRT content...');
    const emptyResult = await generatePromptsWithLangChain(
      '',
      'Cinematic',
      'lyrics',
      'music_video',
    );
    
    if (!Array.isArray(emptyResult)) {
      console.log('   ❌ Empty SRT did not return an array');
      passed = false;
    } else {
      console.log(`   ✅ Empty SRT returned array with ${emptyResult.length} items`);
    }
  } catch (error) {
    console.log(`   ❌ Empty SRT threw an error: ${error}`);
    passed = false;
  }
  
  // Test 2: Whitespace-only SRT content
  try {
    console.log('   Testing with whitespace-only SRT content...');
    const whitespaceResult = await generatePromptsWithLangChain(
      '   \n\n   \t   ',
      'Cinematic',
      'lyrics',
      'music_video',
    );
    
    if (!Array.isArray(whitespaceResult)) {
      console.log('   ❌ Whitespace SRT did not return an array');
      passed = false;
    } else {
      console.log(`   ✅ Whitespace SRT returned array with ${whitespaceResult.length} items`);
    }
  } catch (error) {
    console.log(`   ❌ Whitespace SRT threw an error: ${error}`);
    passed = false;
  }
  
  // Test 3: Verify original functions still work (backward compatibility)
  try {
    console.log('   Testing backward compatibility with original functions...');
    
    const lyricsResult = await generatePromptsFromLyrics(
      SAMPLE_SRT_CONTENT,
      'Cinematic',
      'A person',
      'music_video',
    );
    
    const storyResult = await generatePromptsFromStory(
      SAMPLE_SRT_CONTENT,
      'Documentary',
      'A narrator',
      'documentary',
    );
    
    if (!Array.isArray(lyricsResult)) {
      console.log('   ❌ generatePromptsFromLyrics did not return an array');
      passed = false;
    } else {
      console.log(`   ✅ generatePromptsFromLyrics returned ${lyricsResult.length} prompts`);
    }
    
    if (!Array.isArray(storyResult)) {
      console.log('   ❌ generatePromptsFromStory did not return an array');
      passed = false;
    } else {
      console.log(`   ✅ generatePromptsFromStory returned ${storyResult.length} prompts`);
    }
    
  } catch (error) {
    console.log(`   ❌ Backward compatibility test threw an error: ${error}`);
    passed = false;
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Integration Test 2: ${passed ? 'PASSED' : 'FAILED'}`);
  return passed;
}

/**
 * Test 3: Property-Based Test for Hook Integration
 * 
 * For any valid inputs, the generatePromptsWithLangChain function SHALL:
 * - Return an array (never throw)
 * - Each element (if any) SHALL be a valid ImagePrompt
 * 
 * **Validates: Requirements 7.2, 7.3**
 */
export async function testHookIntegrationProperty(): Promise<boolean> {
  console.log('🧪 Integration Test 3: Property-Based Hook Integration');
  console.log('   Testing that function always returns valid array for any input...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 20; // Reduced for integration tests (API calls are slow)
  
  // Arbitraries for test inputs
  const contentTypeArbitrary = fc.constantFrom('lyrics' as const, 'story' as const);
  const videoPurposeArbitrary: fc.Arbitrary<VideoPurpose> = fc.constantFrom(
    'music_video',
    'social_short',
    'documentary',
    'commercial',
    'podcast_visual',
    'lyric_video'
  );
  const styleArbitrary = fc.constantFrom(
    'Cinematic',
    'Abstract',
    'Documentary',
    'Anime',
    'Watercolor'
  );
  const globalSubjectArbitrary = fc.option(
    fc.string({ minLength: 5, maxLength: 50 }),
    { nil: undefined }
  );
  
  // Generate simple SRT content
  const srtContentArbitrary = fc.array(
    fc.record({
      text: fc.string({ minLength: 5, maxLength: 100 }),
    }),
    { minLength: 3, maxLength: 8 }
  ).map(entries => {
    return entries.map((entry, i) => {
      const startSec = i * 15;
      const endSec = startSec + 10;
      return `${i + 1}\n00:00:${startSec.toString().padStart(2, '0')},000 --> 00:00:${endSec.toString().padStart(2, '0')},000\n${entry.text}\n`;
    }).join('\n');
  });
  
  try {
    await fc.assert(
      fc.asyncProperty(
        srtContentArbitrary,
        styleArbitrary,
        contentTypeArbitrary,
        videoPurposeArbitrary,
        globalSubjectArbitrary,
        async (srtContent, style, contentType, videoPurpose, globalSubject) => {
          iterations++;
          
          try {
            const result = await generatePromptsWithLangChain(
              srtContent,
              style,
              contentType,
              videoPurpose,
              globalSubject,
            );
            
            // Must return an array
            if (!Array.isArray(result)) {
              console.log(`   ❌ Iteration ${iterations}: Result is not an array`);
              passed = false;
              return false;
            }
            
            // Each element must be a valid ImagePrompt
            for (let i = 0; i < result.length; i++) {
              if (!isValidImagePrompt(result[i])) {
                console.log(`   ❌ Iteration ${iterations}: result[${i}] is not a valid ImagePrompt`);
                passed = false;
                return false;
              }
            }
            
            return true;
          } catch (error) {
            // Function should never throw - this is a failure
            console.log(`   ❌ Iteration ${iterations}: Function threw an error: ${error}`);
            passed = false;
            return false;
          }
        }
      ),
      { numRuns: maxIterations }
    );
  } catch (error) {
    console.log(`   ❌ Property test failed: ${error}`);
    passed = false;
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Integration Test 3: ${iterations} iterations completed`);
  return passed;
}

// --- Test Runner ---

/**
 * Runs all hook integration tests.
 */
export async function runHookIntegrationTests(): Promise<Record<string, boolean>> {
  console.log('\n🔬 Running Hook Integration Tests...\n');
  
  const results: Record<string, boolean> = {};
  
  try {
    results.promptGeneration = await testHookIntegrationPromptGeneration();
  } catch (error) {
    console.error('❌ Integration Test 1 threw an error:', error);
    results.promptGeneration = false;
  }
  
  try {
    results.fallbackBehavior = await testHookIntegrationFallback();
  } catch (error) {
    console.error('❌ Integration Test 2 threw an error:', error);
    results.fallbackBehavior = false;
  }
  
  try {
    results.propertyBasedIntegration = await testHookIntegrationProperty();
  } catch (error) {
    console.error('❌ Integration Test 3 threw an error:', error);
    results.propertyBasedIntegration = false;
  }
  
  console.log('\n📊 Hook Integration Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  return results;
}
