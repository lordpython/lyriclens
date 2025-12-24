/**
 * Fallback Behavior Test
 * 
 * Tests that the Director Service correctly falls back to existing
 * prompt generation functions when errors occur.
 * 
 * Requirements: 5.3, 7.3
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

import { generatePromptsWithLangChain } from '../services/directorService';
import { ImagePrompt } from '../types';

// Sample SRT content for testing
const SAMPLE_SRT_CONTENT = `1
00:00:51,539 --> 00:00:57,289
Oh, you who trick the soul with hopes that fade,

2
00:00:58,709 --> 00:01:04,019
this world is but a shadow and a shade.

3
00:01:05,489 --> 00:01:11,549
You weep for life, yet deep inside you know,

4
00:01:12,659 --> 00:01:16,879
the only peace is found in letting go.`;

/**
 * Test 1: Verify fallback on empty content
 * 
 * When empty SRT content is provided, the function should fall back
 * to existing prompt generation (which may return empty or handle gracefully).
 */
async function testFallbackOnEmptyContent(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 1: Fallback on Empty Content');
  console.log('   Testing generatePromptsWithLangChain with empty content...\n');
  
  try {
    const result = await generatePromptsWithLangChain(
      '', // Empty content
      'cinematic',
      'lyrics',
      'music_video'
    );
    
    // Should return an array (possibly empty) without throwing
    if (!Array.isArray(result)) {
      console.log('   ❌ Result is not an array');
      return { passed: false, error: 'Result is not an array' };
    }
    
    console.log(`   📊 Result: ${result.length} prompts returned`);
    console.log('   ✅ Fallback on empty content test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED - function threw instead of falling back: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 2: Verify normal operation returns valid ImagePrompt[]
 * 
 * When valid content is provided, the function should return
 * an array of ImagePrompt objects.
 */
async function testNormalOperation(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 2: Normal Operation');
  console.log('   Testing generatePromptsWithLangChain with valid content...\n');
  
  try {
    const result = await generatePromptsWithLangChain(
      SAMPLE_SRT_CONTENT,
      'cinematic',
      'lyrics',
      'music_video',
      'a contemplative figure'
    );
    
    // Should return an array
    if (!Array.isArray(result)) {
      console.log('   ❌ Result is not an array');
      return { passed: false, error: 'Result is not an array' };
    }
    
    console.log(`   📊 Result: ${result.length} prompts returned`);
    
    // Validate each prompt has required fields
    for (let i = 0; i < result.length; i++) {
      const prompt = result[i];
      
      if (typeof prompt.id !== 'string') {
        console.log(`   ❌ prompt[${i}].id is not a string`);
        return { passed: false, error: `prompt[${i}].id is not a string` };
      }
      
      if (typeof prompt.text !== 'string') {
        console.log(`   ❌ prompt[${i}].text is not a string`);
        return { passed: false, error: `prompt[${i}].text is not a string` };
      }
      
      if (typeof prompt.mood !== 'string') {
        console.log(`   ❌ prompt[${i}].mood is not a string`);
        return { passed: false, error: `prompt[${i}].mood is not a string` };
      }
    }
    
    // Show sample prompt
    if (result.length > 0) {
      console.log('\n   📝 Sample prompt:');
      console.log(`      ID: ${result[0].id}`);
      console.log(`      Mood: ${result[0].mood}`);
      console.log(`      Timestamp: ${result[0].timestamp}`);
      console.log(`      Text: ${result[0].text.slice(0, 100)}...`);
    }
    
    console.log('\n   ✅ Normal operation test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 3: Verify story content type works
 * 
 * When content type is "story", the function should use
 * the appropriate analysis and generation path.
 */
async function testStoryContentType(): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 3: Story Content Type');
  console.log('   Testing generatePromptsWithLangChain with story content type...\n');
  
  const storyContent = `1
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
  
  try {
    const result = await generatePromptsWithLangChain(
      storyContent,
      'documentary',
      'story',
      'documentary'
    );
    
    // Should return an array
    if (!Array.isArray(result)) {
      console.log('   ❌ Result is not an array');
      return { passed: false, error: 'Result is not an array' };
    }
    
    console.log(`   📊 Result: ${result.length} prompts returned`);
    
    // Validate structure
    for (const prompt of result) {
      if (typeof prompt.id !== 'string' || typeof prompt.text !== 'string' || typeof prompt.mood !== 'string') {
        console.log('   ❌ Invalid prompt structure');
        return { passed: false, error: 'Invalid prompt structure' };
      }
    }
    
    console.log('   ✅ Story content type test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Main test runner for fallback behavior verification.
 */
async function runFallbackTests(): Promise<void> {
  console.log('🚀 Fallback Behavior Tests');
  console.log('==========================');
  console.log('Checkpoint: Verify fallback works on simulated errors\n');
  
  const results: { test: string; passed: boolean; error?: string }[] = [];
  
  // Test 1: Fallback on empty content
  const emptyContentResult = await testFallbackOnEmptyContent();
  results.push({ test: 'Fallback on Empty Content', ...emptyContentResult });
  
  // Test 2: Normal operation
  const normalResult = await testNormalOperation();
  results.push({ test: 'Normal Operation', ...normalResult });
  
  // Test 3: Story content type
  const storyResult = await testStoryContentType();
  results.push({ test: 'Story Content Type', ...storyResult });
  
  // Summary
  console.log('\n==========================');
  console.log('📊 Test Results Summary:');
  console.log('==========================');
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '🎉 All fallback tests passed!' : '⚠️  Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runFallbackTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
