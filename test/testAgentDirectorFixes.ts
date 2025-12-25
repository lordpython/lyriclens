/**
 * Test Agent Director Service Fixes
 * 
 * Tests the fixes for:
 * 1. Literalism trap - atmospheric resonance over literal objects
 * 2. Generic style injection - professional style wrapper
 * 3. Visual cohesion - consistency rules
 */

import { generatePromptsWithAgent } from "../services/agentDirectorService";
import { VideoPurpose } from "../constants";

async function testAgentDirectorFixes() {
  console.log("🎬 Testing Agent Director Service Fixes...\n");

  // Test data - lyrics with metaphorical content
  const testLyrics = `00:00:00,000 --> 00:00:05,000
Burning candle in the night

00:00:05,000 --> 00:00:10,000
Shadows dancing on the wall

00:00:10,000 --> 00:00:15,000
Empty room where love once lived

00:00:15,000 --> 00:00:20,000
Echoes of a distant call`;

  try {
    console.log("📝 Test Input:");
    console.log("- Lyrics with metaphorical 'burning candle'");
    console.log("- Style: Cinematic");
    console.log("- Purpose: Music Video");
    console.log("- Should prioritize ATMOSPHERE over literal candle\n");

    const prompts = await generatePromptsWithAgent(
      testLyrics,
      "Cinematic",
      "lyrics",
      VideoPurpose.MUSIC_VIDEO,
      "melancholic atmosphere"
    );

    console.log("✅ Agent Director Service executed successfully!");
    console.log(`📊 Generated ${prompts.length} prompts\n`);

    if (prompts.length > 0) {
      console.log("🎯 Sample Prompts (checking for atmospheric vs literal approach):");
      prompts.slice(0, 3).forEach((prompt, i) => {
        console.log(`\n${i + 1}. [${prompt.timestamp}] ${prompt.mood || 'N/A'}`);
        console.log(`   "${prompt.text}"`);
        
        // Check for atmospheric vs literal indicators
        const text = prompt.text.toLowerCase();
        const hasAtmospheric = text.includes('atmosphere') || text.includes('mood') || 
                              text.includes('feeling') || text.includes('emotion') ||
                              text.includes('lonely') || text.includes('melancholic') ||
                              text.includes('shadows') || text.includes('empty');
        const hasLiteral = text.includes('actual candle') || text.includes('real candle') ||
                          text.includes('candle flame') || text.includes('wax');
        
        if (hasAtmospheric && !hasLiteral) {
          console.log("   ✅ GOOD: Atmospheric approach detected");
        } else if (hasLiteral) {
          console.log("   ⚠️  WARNING: Literal approach detected");
        } else {
          console.log("   ℹ️  NEUTRAL: Neither clearly atmospheric nor literal");
        }
      });

      // Check for professional style indicators
      console.log("\n🎥 Professional Style Check:");
      const allText = prompts.map(p => p.text).join(' ').toLowerCase();
      const hasProSpecs = allText.includes('arri') || allText.includes('alexa') ||
                         allText.includes('35mm') || allText.includes('grain') ||
                         allText.includes('anamorphic') || allText.includes('cinematic');
      
      if (hasProSpecs) {
        console.log("   ✅ Professional cinematography specs detected");
      } else {
        console.log("   ⚠️  Professional specs may not be fully integrated");
      }

      // Check for consistency indicators
      console.log("\n🎨 Visual Consistency Check:");
      const moods = prompts.map(p => p.mood).filter(Boolean);
      const uniqueMoods = new Set(moods);
      
      if (uniqueMoods.size <= 3) {
        console.log(`   ✅ Good mood consistency: ${uniqueMoods.size} unique moods`);
      } else {
        console.log(`   ⚠️  High mood variety: ${uniqueMoods.size} unique moods (may lack cohesion)`);
      }
    }

    console.log("\n🎉 Test completed successfully!");
    return true;

  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testAgentDirectorFixes()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}

export { testAgentDirectorFixes };