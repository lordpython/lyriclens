/**
 * Test the Agent Director Service fix for storyboard extraction
 */

import { extractStoryboardFromContent, convertToImagePrompts } from '../services/agentDirectorService';

// Mock storyboard data that matches the structure from the logs
const mockStoryboardJSON = `{
  "prompts": [
    {
      "text": "A close-up shot on a human heart, still beating faintly, resting on a cold stone altar in a dimly lit, ancient temple. Soft, diffused light filters through a high window, casting long shadows across the scene. The heart appears worn and scarred, with visible veins. Shallow depth of field emphasizes the heart. 35mm film grain visible. Atmosphere of quiet suffering. Camera angle is a low angle looking up at the heart.",
      "mood": "Longing and suffering",
      "timestamp": "00:00:31"
    },
    {
      "text": "Wide establishing shot of a desolate landscape under a star-filled night sky. A lone figure stands silhouetted against the horizon, gazing upwards. The landscape is barren and rocky, with a few twisted trees. Cool blue moonlight illuminates the scene, creating a sense of vastness and isolation. Anamorphic lens flares streak across the sky. Volumetric light rays pierce through the darkness. The camera angle is a high angle looking down. 35mm film grain.",
      "mood": "Torment and sleeplessness",
      "timestamp": "00:01:04"
    }
  ]
}`;

const mockStoryboardInCodeBlock = `\`\`\`json
${mockStoryboardJSON}
\`\`\``;

const mockResponseWithStatus = "The storyboard has a quality score of 100, which meets the quality threshold. The storyboard JSON is complete.";

async function testStoryboardExtraction() {
  console.log('🧪 Testing storyboard extraction fix...');
  
  // Test 1: Extract from plain JSON
  console.log('Test 1: Plain JSON extraction');
  const result1 = await extractStoryboardFromContent(mockStoryboardJSON);
  console.log('✅ Plain JSON:', result1 ? `${result1.prompts.length} prompts` : 'null');
  
  // Test 2: Extract from code block
  console.log('Test 2: Code block extraction');
  const result2 = await extractStoryboardFromContent(mockStoryboardInCodeBlock);
  console.log('✅ Code block:', result2 ? `${result2.prompts.length} prompts` : 'null');
  
  // Test 3: Extract from status message (should fail gracefully)
  console.log('Test 3: Status message extraction');
  const result3 = await extractStoryboardFromContent(mockResponseWithStatus);
  console.log('✅ Status message:', result3 ? `${result3.prompts.length} prompts` : 'null (expected)');
  
  // Test 4: Convert to ImagePrompts
  if (result1) {
    console.log('Test 4: Convert to ImagePrompts');
    const imagePrompts = convertToImagePrompts(result1.prompts);
    console.log('✅ ImagePrompts:', imagePrompts.length, 'prompts with IDs and timestamps');
    
    if (imagePrompts.length > 0) {
      console.log('First prompt:', {
        id: imagePrompts[0].id,
        text: imagePrompts[0].text.substring(0, 50) + '...',
        mood: imagePrompts[0].mood,
        timestamp: imagePrompts[0].timestamp,
        timestampSeconds: imagePrompts[0].timestampSeconds
      });
    }
  }
  
  console.log('🎉 Storyboard extraction tests completed!');
  
  return {
    plainJSON: !!result1,
    codeBlock: !!result2,
    statusMessage: !result3, // Should be null
    conversion: result1 ? convertToImagePrompts(result1.prompts).length > 0 : false
  };
}

// Export for manual testing
export { testStoryboardExtraction };

// Run if called directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('testAgentDirectorServiceFix')) {
  testStoryboardExtraction();
}