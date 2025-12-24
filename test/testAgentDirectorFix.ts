/**
 * Test the Agent Director Service fix
 */

import { generatePromptsWithAgent } from '../services/agentDirectorService';

// Simple test with minimal Arabic lyrics
const testLyrics = `1
00:00:23,000 --> 00:00:26,500
مضناك جفاه مرقده

2
00:00:27,000 --> 00:00:30,000
وبكاه ورحمـه عوَّده

3
00:00:31,000 --> 00:00:34,500
حيران القلب معذبه`;

async function testAgentDirectorFix() {
  console.log('Testing Agent Director Service fix...');
  
  try {
    const prompts = await generatePromptsWithAgent(
      testLyrics,
      'Cinematic',
      'lyrics',
      'music_video',
      undefined,
      {
        maxIterations: 1,
        qualityThreshold: 50, // Lower threshold for testing
      }
    );
    
    console.log('✅ Test successful!');
    console.log(`Generated ${prompts.length} prompts`);
    
    if (prompts.length > 0) {
      console.log('First prompt:', prompts[0]);
    }
    
    return prompts;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Export for manual testing
export { testAgentDirectorFix };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAgentDirectorFix().catch(console.error);
}