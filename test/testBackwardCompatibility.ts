/**
 * Backward Compatibility Tests
 * 
 * Verifies that existing generatePromptsFromLyrics and generatePromptsFromStory
 * functions continue to work correctly after the LangChain Director Agent integration.
 * 
 * **Validates: Requirements 7.1**
 * 
 * Task 9.1: Verify backward compatibility
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

import { generatePromptsFromLyrics, generatePromptsFromStory } from '../services/promptService';
import { ImagePrompt } from '../types';

// Sample SRT content for testing
const SAMPLE_LYRICS_SRT = `1
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
Finding hope in unexpected places`;

const SAMPLE_STORY_SRT = `1
00:00:00,000 --> 00:00:10,000
Welcome to our presentation on climate change.

2
00:00:10,000 --> 00:00:20,000
Today we will explore the key factors affecting our planet.

3
00:00:20,000 --> 00:00:30,000
First, let's look at rising temperatures globally.

4
00:00:30,000 --> 00:00:40,000
In conclusion, we must act now to protect our future.`;

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

/**
 * Test 1: Verify generatePromptsFromLyrics still works
 */
async function testGeneratePromptsFromLyrics(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 1: generatePromptsFromLyrics Backward Compatibility');
  console.log('   Testing that existing lyrics prompt generation still works...\n');
  
  try {
    const result = await generatePromptsFromLyrics(
      SAMPLE_LYRICS_SRT,
      'Cinematic',
      'A contemplative figure',
      'music_video'
    );
    
    // Should return an array
    if (!Array.isArray(result)) {
      console.log('   ❌ Result is not an array');
      return { passed: false, error: 'Result is not an array' };
    }
    
    console.log(`   📊 Result: ${result.length} prompts returned`);
    
    // Validate each prompt has required fields
    for (let i = 0; i < result.length; i++) {
      if (!isValidImagePrompt(result[i])) {
        console.log(`   ❌ prompt[${i}] is not a valid ImagePrompt`);
        return { passed: false, error: `prompt[${i}] is not a valid ImagePrompt` };
      }
    }
    
    // Show sample prompt if available
    if (result.length > 0) {
      console.log('\n   📝 Sample prompt:');
      console.log(`      ID: ${result[0].id}`);
      console.log(`      Mood: ${result[0].mood}`);
      console.log(`      Timestamp: ${result[0].timestamp}`);
      console.log(`      Text: ${result[0].text.slice(0, 100)}...`);
    }
    
    console.log('\n   ✅ generatePromptsFromLyrics test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 2: Verify generatePromptsFromStory still works
 */
async function testGeneratePromptsFromStory(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 2: generatePromptsFromStory Backward Compatibility');
  console.log('   Testing that existing story prompt generation still works...\n');
  
  try {
    const result = await generatePromptsFromStory(
      SAMPLE_STORY_SRT,
      'Documentary',
      'A narrator',
      'documentary'
    );
    
    // Should return an array
    if (!Array.isArray(result)) {
      console.log('   ❌ Result is not an array');
      return { passed: false, error: 'Result is not an array' };
    }
    
    console.log(`   📊 Result: ${result.length} prompts returned`);
    
    // Validate each prompt has required fields
    for (let i = 0; i < result.length; i++) {
      if (!isValidImagePrompt(result[i])) {
        console.log(`   ❌ prompt[${i}] is not a valid ImagePrompt`);
        return { passed: false, error: `prompt[${i}] is not a valid ImagePrompt` };
      }
    }
    
    // Show sample prompt if available
    if (result.length > 0) {
      console.log('\n   📝 Sample prompt:');
      console.log(`      ID: ${result[0].id}`);
      console.log(`      Mood: ${result[0].mood}`);
      console.log(`      Timestamp: ${result[0].timestamp}`);
      console.log(`      Text: ${result[0].text.slice(0, 100)}...`);
    }
    
    console.log('\n   ✅ generatePromptsFromStory test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 3: Verify functions work with different video purposes
 */
async function testDifferentVideoPurposes(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 3: Different Video Purposes');
  console.log('   Testing that functions work with various video purposes...\n');
  
  const purposes = ['music_video', 'social_short', 'lyric_video'] as const;
  
  try {
    for (const purpose of purposes) {
      console.log(`   Testing with purpose: ${purpose}...`);
      
      const result = await generatePromptsFromLyrics(
        SAMPLE_LYRICS_SRT,
        'Cinematic',
        '',
        purpose
      );
      
      if (!Array.isArray(result)) {
        console.log(`   ❌ Result for ${purpose} is not an array`);
        return { passed: false, error: `Result for ${purpose} is not an array` };
      }
      
      console.log(`   ✅ ${purpose}: ${result.length} prompts`);
    }
    
    console.log('\n   ✅ Different video purposes test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 4: Verify functions work without optional parameters
 */
async function testWithoutOptionalParams(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 4: Without Optional Parameters');
  console.log('   Testing that functions work with minimal parameters...\n');
  
  try {
    // Test generatePromptsFromLyrics with minimal params
    console.log('   Testing generatePromptsFromLyrics with minimal params...');
    const lyricsResult = await generatePromptsFromLyrics(SAMPLE_LYRICS_SRT);
    
    if (!Array.isArray(lyricsResult)) {
      console.log('   ❌ Lyrics result is not an array');
      return { passed: false, error: 'Lyrics result is not an array' };
    }
    console.log(`   ✅ Lyrics: ${lyricsResult.length} prompts`);
    
    // Test generatePromptsFromStory with minimal params
    console.log('   Testing generatePromptsFromStory with minimal params...');
    const storyResult = await generatePromptsFromStory(SAMPLE_STORY_SRT);
    
    if (!Array.isArray(storyResult)) {
      console.log('   ❌ Story result is not an array');
      return { passed: false, error: 'Story result is not an array' };
    }
    console.log(`   ✅ Story: ${storyResult.length} prompts`);
    
    console.log('\n   ✅ Without optional parameters test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Main test runner for backward compatibility verification.
 */
async function runBackwardCompatibilityTests(): Promise<void> {
  console.log('🚀 Backward Compatibility Tests');
  console.log('================================');
  console.log('Task 9.1: Verify backward compatibility');
  console.log('Requirements: 7.1 - Existing functions SHALL remain unchanged\n');
  
  const results: { test: string; passed: boolean; error?: string }[] = [];
  
  // Test 1: generatePromptsFromLyrics
  const lyricsResult = await testGeneratePromptsFromLyrics();
  results.push({ test: 'generatePromptsFromLyrics', ...lyricsResult });
  
  // Test 2: generatePromptsFromStory
  const storyResult = await testGeneratePromptsFromStory();
  results.push({ test: 'generatePromptsFromStory', ...storyResult });
  
  // Test 3: Different video purposes
  const purposesResult = await testDifferentVideoPurposes();
  results.push({ test: 'Different Video Purposes', ...purposesResult });
  
  // Test 4: Without optional parameters
  const optionalResult = await testWithoutOptionalParams();
  results.push({ test: 'Without Optional Parameters', ...optionalResult });
  
  // Summary
  console.log('\n================================');
  console.log('📊 Test Results Summary:');
  console.log('================================');
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '🎉 All backward compatibility tests passed!' : '⚠️  Some tests failed'}`);
  console.log('\nRequirement 7.1 verification: ' + (allPassed ? 'SATISFIED ✅' : 'NOT SATISFIED ❌'));
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runBackwardCompatibilityTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
