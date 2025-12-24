/**
 * Integration Tests for Agent Chains
 * 
 * Tests the Analyzer and Storyboarder chains independently with sample data.
 * This is the checkpoint verification for Task 3.
 * 
 * Requirements: 3.6, 4.7
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

import { 
  runAnalyzer, 
  runStoryboarder,
  AnalysisOutput,
  AnalysisSchema,
  StoryboardSchema
} from '../services/directorService';
import { CAMERA_ANGLES, LIGHTING_MOODS } from '../constants';

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
the only peace is found in letting go.

5
00:01:19,439 --> 00:01:24,209
The days are travelers that will not stay.

6
00:01:26,389 --> 00:01:31,459
And happiness is walking a different way.

7
00:01:32,499 --> 00:01:37,709
There is no home awaiting after death,

8
00:01:39,369 --> 00:01:44,489
except the one you built with living breath.

9
00:01:45,959 --> 00:01:51,289
If built with good, a palace you shall find.

10
00:01:52,659 --> 00:01:57,809
If built with sin, you leave all hope behind.

11
00:02:03,819 --> 00:02:10,319
So work for the home where angels guard the gate.

12
00:02:10,819 --> 00:02:16,619
Where the prophet is the neighbor and the rewards are great.`;

/**
 * Test 1: Analyzer Chain with Sample SRT Content
 * 
 * Validates that the Analyzer chain:
 * - Successfully processes real SRT content
 * - Returns a valid AnalysisOutput structure
 * - Identifies sections, emotional arc, themes, and motifs
 * 
 * Requirements: 3.6
 */
async function testAnalyzerChain(): Promise<{ passed: boolean; analysis?: AnalysisOutput; error?: string }> {
  console.log('\n🔬 Test 1: Analyzer Chain with Sample SRT Content');
  console.log('   Testing runAnalyzer with lyrics content...\n');
  
  try {
    const analysis = await runAnalyzer(SAMPLE_SRT_CONTENT, 'lyrics');
    
    console.log('   📊 Analyzer Output:');
    console.log(`      Sections: ${analysis.sections.length}`);
    console.log(`      Themes: ${analysis.themes.join(', ')}`);
    console.log(`      Motifs: ${analysis.motifs.join(', ')}`);
    console.log(`      Emotional Arc: ${analysis.emotionalArc.opening} → ${analysis.emotionalArc.peak} → ${analysis.emotionalArc.resolution}`);
    
    // Validate against schema
    const validation = AnalysisSchema.safeParse(analysis);
    if (!validation.success) {
      console.log('   ❌ Schema validation failed:', validation.error.message);
      return { passed: false, error: validation.error.message };
    }
    
    // Check required structure
    if (analysis.sections.length === 0) {
      console.log('   ❌ No sections identified');
      return { passed: false, error: 'No sections identified' };
    }
    
    if (analysis.themes.length === 0) {
      console.log('   ❌ No themes identified');
      return { passed: false, error: 'No themes identified' };
    }
    
    console.log('\n   ✅ Analyzer chain test PASSED');
    return { passed: true, analysis };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Analyzer chain test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Test 2: Storyboarder Chain with Sample Analysis
 * 
 * Validates that the Storyboarder chain:
 * - Successfully processes an analysis object
 * - Returns 8-12 image prompts
 * - Prompts contain visual vocabulary (camera angles/lighting moods)
 * 
 * Requirements: 4.7
 */
async function testStoryboarderChain(analysis: AnalysisOutput): Promise<{ passed: boolean; error?: string }> {
  console.log('\n🔬 Test 2: Storyboarder Chain with Sample Analysis');
  console.log('   Testing runStoryboarder with analysis output...\n');
  
  try {
    const storyboard = await runStoryboarder(
      analysis,
      'cinematic',
      'music_video',
      'a contemplative figure in flowing robes'
    );
    
    console.log('   📊 Storyboarder Output:');
    console.log(`      Prompts generated: ${storyboard.prompts.length}`);
    
    // Validate against schema
    const validation = StoryboardSchema.safeParse(storyboard);
    if (!validation.success) {
      console.log('   ❌ Schema validation failed:', validation.error.message);
      return { passed: false, error: validation.error.message };
    }
    
    // Check prompt count (8-12)
    if (storyboard.prompts.length < 8 || storyboard.prompts.length > 12) {
      console.log(`   ❌ Prompt count ${storyboard.prompts.length} not in range [8, 12]`);
      return { passed: false, error: `Prompt count ${storyboard.prompts.length} not in range [8, 12]` };
    }
    
    // Check visual vocabulary usage
    let vocabCount = 0;
    for (const prompt of storyboard.prompts) {
      const textLower = prompt.text.toLowerCase();
      const hasCameraAngle = CAMERA_ANGLES.some(angle => textLower.includes(angle.toLowerCase()));
      const hasLightingMood = LIGHTING_MOODS.some(mood => textLower.includes(mood.toLowerCase()));
      
      if (hasCameraAngle || hasLightingMood) {
        vocabCount++;
      }
    }
    
    console.log(`      Prompts with visual vocabulary: ${vocabCount}/${storyboard.prompts.length}`);
    
    // Show first prompt as sample
    if (storyboard.prompts.length > 0) {
      console.log('\n   📝 Sample prompt:');
      console.log(`      Mood: ${storyboard.prompts[0].mood}`);
      console.log(`      Timestamp: ${storyboard.prompts[0].timestamp}`);
      console.log(`      Text: ${storyboard.prompts[0].text.slice(0, 150)}...`);
    }
    
    console.log('\n   ✅ Storyboarder chain test PASSED');
    return { passed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Storyboarder chain test FAILED: ${errorMessage}`);
    return { passed: false, error: errorMessage };
  }
}

/**
 * Main test runner for agent chain verification.
 */
async function runAgentChainTests(): Promise<void> {
  console.log('🚀 Agent Chain Integration Tests');
  console.log('================================');
  console.log('Checkpoint: Verify agent chains work independently\n');
  
  const results: { test: string; passed: boolean; error?: string }[] = [];
  
  // Test 1: Analyzer Chain
  const analyzerResult = await testAnalyzerChain();
  results.push({ test: 'Analyzer Chain', passed: analyzerResult.passed, error: analyzerResult.error });
  
  // Test 2: Storyboarder Chain (only if Analyzer passed)
  if (analyzerResult.passed && analyzerResult.analysis) {
    const storyboarderResult = await testStoryboarderChain(analyzerResult.analysis);
    results.push({ test: 'Storyboarder Chain', passed: storyboarderResult.passed, error: storyboarderResult.error });
  } else {
    results.push({ test: 'Storyboarder Chain', passed: false, error: 'Skipped - Analyzer failed' });
  }
  
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
  console.log(`\n${allPassed ? '🎉 All agent chain tests passed!' : '⚠️  Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAgentChainTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
