/**
 * Integration Tests for Agent Director Service
 * 
 * Tests the complete Agent Director workflow with various response formats
 * and validates end-to-end storyboard generation with fallback scenarios.
 * 
 * Feature: agent-director-json-parsing-fix
 * Requirements: All requirements
 */

import {
  extractStoryboardFromContent,
  convertToImagePrompts,
  agentLogger,
  agentMetrics,
  LogLevel,
} from '../services/agentDirectorService';
import {
  JSONExtractor,
  FallbackProcessor,
  ExtractionMethod,
} from '../services/jsonExtractor';
import {
  preprocessFormatCorrection,
  needsFormatCorrection,
  generateCompleteFormatGuidance,
} from '../services/promptFormatService';

// --- Test Data ---

/**
 * Sample valid storyboard JSON for testing.
 */
const VALID_STORYBOARD = {
  prompts: [
    {
      text: "A weathered wooden door slowly creaks open, revealing a dimly lit hallway with peeling wallpaper and dust motes floating in a single beam of afternoon light.",
      mood: "melancholic",
      timestamp: "00:15"
    },
    {
      text: "A lone figure in a vintage leather jacket stands at the edge of a rain-slicked rooftop, city lights blurring into bokeh circles below.",
      mood: "contemplative",
      timestamp: "00:45"
    },
    {
      text: "Weathered hands carefully unfold a yellowed photograph, fingers trembling slightly. Extreme close-up reveals the texture of aged paper.",
      mood: "nostalgic",
      timestamp: "01:15"
    }
  ],
  metadata: {
    style: "Cinematic",
    purpose: "music_video"
  }
};

/**
 * Sample malformed JSON responses for testing fallback scenarios.
 */
const MALFORMED_RESPONSES = {
  // JSON wrapped in markdown
  markdownWrapped: `Here's the storyboard I created:

\`\`\`json
${JSON.stringify(VALID_STORYBOARD, null, 2)}
\`\`\`

Let me know if you need any changes!`,

  // JSON with trailing commas (simpler case that can be fixed)
  trailingCommas: `{
  "prompts": [
    {
      "text": "A serene mountain landscape at dawn",
      "mood": "peaceful",
      "timestamp": "00:00"
    },
    {
      "text": "A rushing waterfall cascading down rocks",
      "mood": "energetic",
      "timestamp": "00:30"
    },
  ]
}`,

  // JSON with surrounding text
  surroundingText: `I've analyzed the content and here's the storyboard:

${JSON.stringify(VALID_STORYBOARD, null, 2)}

This should work well for your video project.`,

  // Nested storyboard (from combined tool)
  nestedStoryboard: JSON.stringify({
    analysis: {
      sectionCount: 3,
      themes: ["loss", "hope"],
      emotionalArc: { opening: "sad", peak: "intense", resolution: "hopeful" }
    },
    storyboard: VALID_STORYBOARD
  }, null, 2),

  // Plain text with visual descriptions (for fallback testing)
  plainTextDescriptions: `
Scene 1: A beautiful sunset over the ocean with golden light reflecting on the waves.
Scene 2: A silhouette of a person standing on a cliff overlooking the vast landscape.
Scene 3: Close-up of hands holding a vintage compass, the needle spinning slowly.
Scene 4: A dramatic storm approaching over rolling hills, lightning in the distance.
`,

  // Completely invalid content
  invalidContent: `This is just some random text without any JSON or visual descriptions.
It doesn't contain anything useful for storyboard generation.
Just plain text that should trigger fallback processing.`
};

// --- Integration Tests ---

/**
 * Test 1: Complete workflow with valid markdown-wrapped JSON
 * 
 * Tests that the system correctly extracts storyboard from markdown-wrapped JSON.
 * Requirements: 1.1, 1.4
 */
async function testMarkdownWrappedExtraction(): Promise<boolean> {
  console.log('🧪 Integration Test 1: Markdown-Wrapped JSON Extraction');
  
  try {
    const result = await extractStoryboardFromContent(MALFORMED_RESPONSES.markdownWrapped);
    
    if (!result) {
      console.log('   ❌ Failed: No storyboard extracted');
      return false;
    }
    
    if (!result.prompts || result.prompts.length !== 3) {
      console.log(`   ❌ Failed: Expected 3 prompts, got ${result.prompts?.length || 0}`);
      return false;
    }
    
    // Verify prompt content
    if (!result.prompts[0].text.includes('weathered wooden door')) {
      console.log('   ❌ Failed: First prompt content mismatch');
      return false;
    }
    
    console.log('   ✅ Passed: Markdown-wrapped JSON extracted successfully');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 2: Workflow with JSON containing trailing commas
 * 
 * Tests that the system handles common JSON formatting issues.
 * Note: The system may use fallback processing if the JSON cannot be fixed.
 * Requirements: 1.5, 5.4, 4.1, 4.2
 */
async function testTrailingCommaHandling(): Promise<boolean> {
  console.log('🧪 Integration Test 2: Trailing Comma Handling');
  
  try {
    const result = await extractStoryboardFromContent(MALFORMED_RESPONSES.trailingCommas);
    
    if (!result) {
      console.log('   ❌ Failed: No storyboard extracted');
      return false;
    }
    
    // The system should either fix the JSON or use fallback processing
    // Either way, we should get some prompts
    if (!result.prompts || result.prompts.length === 0) {
      console.log('   ❌ Failed: No prompts extracted');
      return false;
    }
    
    console.log(`   ✅ Passed: JSON with trailing commas handled (${result.prompts.length} prompts extracted)`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 3: Workflow with JSON surrounded by text
 * 
 * Tests regex-based extraction for JSON embedded in text.
 * Requirements: 1.2, 1.4
 */
async function testSurroundingTextExtraction(): Promise<boolean> {
  console.log('🧪 Integration Test 3: Surrounding Text Extraction');
  
  try {
    const result = await extractStoryboardFromContent(MALFORMED_RESPONSES.surroundingText);
    
    if (!result) {
      console.log('   ❌ Failed: No storyboard extracted');
      return false;
    }
    
    if (!result.prompts || result.prompts.length !== 3) {
      console.log(`   ❌ Failed: Expected 3 prompts, got ${result.prompts?.length || 0}`);
      return false;
    }
    
    console.log('   ✅ Passed: JSON with surrounding text extracted successfully');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 4: Workflow with nested storyboard structure
 * 
 * Tests extraction of storyboard from combined tool output.
 * Requirements: 1.4
 */
async function testNestedStoryboardExtraction(): Promise<boolean> {
  console.log('🧪 Integration Test 4: Nested Storyboard Extraction');
  
  try {
    const result = await extractStoryboardFromContent(MALFORMED_RESPONSES.nestedStoryboard);
    
    if (!result) {
      console.log('   ❌ Failed: No storyboard extracted');
      return false;
    }
    
    if (!result.prompts || result.prompts.length !== 3) {
      console.log(`   ❌ Failed: Expected 3 prompts, got ${result.prompts?.length || 0}`);
      return false;
    }
    
    console.log('   ✅ Passed: Nested storyboard extracted successfully');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 5: Fallback processing with plain text descriptions
 * 
 * Tests that fallback processing extracts prompts from unstructured text.
 * Requirements: 4.1, 4.2, 4.3
 */
async function testFallbackProcessing(): Promise<boolean> {
  console.log('🧪 Integration Test 5: Fallback Processing');
  
  try {
    const fallbackProcessor = new FallbackProcessor();
    const result = fallbackProcessor.processWithFallback(
      MALFORMED_RESPONSES.plainTextDescriptions,
      'No valid JSON found'
    );
    
    if (!result) {
      console.log('   ❌ Failed: No fallback storyboard generated');
      return false;
    }
    
    if (!result.prompts || result.prompts.length === 0) {
      console.log('   ❌ Failed: No prompts extracted from text');
      return false;
    }
    
    // Verify metadata indicates fallback was used
    if (result.metadata.source !== 'fallback') {
      console.log('   ❌ Failed: Metadata does not indicate fallback source');
      return false;
    }
    
    console.log(`   ✅ Passed: Fallback processing extracted ${result.prompts.length} prompts`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 6: Fallback notification system
 * 
 * Tests that fallback notifications are sent when fallback is used.
 * Requirements: 4.4
 */
async function testFallbackNotification(): Promise<boolean> {
  console.log('🧪 Integration Test 6: Fallback Notification');
  
  try {
    const fallbackProcessor = new FallbackProcessor();
    let notificationReceived = false;
    let notificationData: any = null;
    
    // Register notification callback
    fallbackProcessor.registerNotificationCallback((notification) => {
      notificationReceived = true;
      notificationData = notification;
    });
    
    // Trigger fallback processing
    fallbackProcessor.processWithFallback(
      MALFORMED_RESPONSES.plainTextDescriptions,
      'Test fallback trigger'
    );
    
    if (!notificationReceived) {
      console.log('   ❌ Failed: No notification received');
      return false;
    }
    
    if (notificationData.type !== 'fallback_used') {
      console.log('   ❌ Failed: Notification type incorrect');
      return false;
    }
    
    if (!notificationData.reducedFunctionality || !Array.isArray(notificationData.reducedFunctionality)) {
      console.log('   ❌ Failed: Reduced functionality list missing');
      return false;
    }
    
    console.log('   ✅ Passed: Fallback notification sent correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 7: Metrics tracking
 * 
 * Tests that metrics are correctly tracked during processing.
 * Requirements: 2.5, 4.5
 */
async function testMetricsTracking(): Promise<boolean> {
  console.log('🧪 Integration Test 7: Metrics Tracking');
  
  try {
    const fallbackProcessor = new FallbackProcessor();
    
    // Reset metrics
    fallbackProcessor.resetMetrics();
    
    // Process multiple items
    fallbackProcessor.processWithFallback('Test content 1', 'reason1');
    fallbackProcessor.processWithFallback('Test content 2', 'reason2');
    fallbackProcessor.processWithFallback('Test content 3', 'reason1');
    
    const metrics = fallbackProcessor.getMetrics();
    
    if (metrics.totalFallbackUsages !== 3) {
      console.log(`   ❌ Failed: Expected 3 total usages, got ${metrics.totalFallbackUsages}`);
      return false;
    }
    
    if (!metrics.lastFallbackTimestamp) {
      console.log('   ❌ Failed: Last timestamp not recorded');
      return false;
    }
    
    // Check reason tracking
    const reason1Count = metrics.fallbackReasons.get('reason1');
    if (reason1Count !== 2) {
      console.log(`   ❌ Failed: Expected 2 for reason1, got ${reason1Count}`);
      return false;
    }
    
    console.log('   ✅ Passed: Metrics tracked correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 8: JSON validation and sanitization
 * 
 * Tests that extracted JSON is validated and sanitized.
 * Requirements: 3.1, 3.5
 */
async function testValidationAndSanitization(): Promise<boolean> {
  console.log('🧪 Integration Test 8: Validation and Sanitization');
  
  try {
    const extractor = new JSONExtractor();
    
    // Test validation
    const validation = extractor.validateStoryboard(VALID_STORYBOARD);
    
    if (!validation.isValid) {
      console.log(`   ❌ Failed: Valid storyboard marked as invalid: ${validation.errors.join(', ')}`);
      return false;
    }
    
    // Test sanitization
    const storyboardWithHarmful = {
      prompts: [
        {
          text: "A scene with <script>alert('xss')</script> content",
          mood: "test",
          timestamp: "00:00"
        }
      ]
    };
    
    const sanitized = extractor.sanitizeStoryboard(storyboardWithHarmful);
    
    if (sanitized.prompts?.[0]?.text?.includes('<script>')) {
      console.log('   ❌ Failed: Script tag not removed during sanitization');
      return false;
    }
    
    console.log('   ✅ Passed: Validation and sanitization working correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 9: Format correction preprocessing
 * 
 * Tests that format correction is applied before parsing.
 * Requirements: 5.4
 */
async function testFormatCorrectionPreprocessing(): Promise<boolean> {
  console.log('🧪 Integration Test 9: Format Correction Preprocessing');
  
  try {
    // Test with markdown-wrapped JSON
    const markdownContent = '```json\n{"test": "value"}\n```';
    
    if (!needsFormatCorrection(markdownContent)) {
      console.log('   ❌ Failed: Markdown content not detected as needing correction');
      return false;
    }
    
    const correctionResult = preprocessFormatCorrection(markdownContent);
    
    if (!correctionResult.wasModified) {
      console.log('   ❌ Failed: Content was not modified');
      return false;
    }
    
    if (!correctionResult.appliedCorrections.includes('remove_markdown_json_blocks')) {
      console.log('   ❌ Failed: Markdown removal not recorded in corrections');
      return false;
    }
    
    // Verify the corrected content is valid JSON
    try {
      JSON.parse(correctionResult.corrected);
    } catch {
      console.log('   ❌ Failed: Corrected content is not valid JSON');
      return false;
    }
    
    console.log('   ✅ Passed: Format correction preprocessing working correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 10: Prompt format guidance generation
 * 
 * Tests that format guidance is generated correctly.
 * Requirements: 5.1, 5.2, 5.3
 */
async function testFormatGuidanceGeneration(): Promise<boolean> {
  console.log('🧪 Integration Test 10: Format Guidance Generation');
  
  try {
    const guidance = generateCompleteFormatGuidance('storyboard');
    
    // Check for key components
    if (!guidance.includes('OUTPUT FORMAT REQUIREMENTS')) {
      console.log('   ❌ Failed: Format requirements section missing');
      return false;
    }
    
    if (!guidance.includes('VALIDATION RULES')) {
      console.log('   ❌ Failed: Validation rules section missing');
      return false;
    }
    
    if (!guidance.includes('JSON SCHEMA')) {
      console.log('   ❌ Failed: JSON schema section missing');
      return false;
    }
    
    if (!guidance.includes('EXAMPLE')) {
      console.log('   ❌ Failed: Example section missing');
      return false;
    }
    
    console.log('   ✅ Passed: Format guidance generated correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 11: Convert to ImagePrompts
 * 
 * Tests that storyboard prompts are correctly converted to ImagePrompts.
 * Requirements: All requirements
 */
async function testConvertToImagePrompts(): Promise<boolean> {
  console.log('🧪 Integration Test 11: Convert to ImagePrompts');
  
  try {
    const imagePrompts = convertToImagePrompts(VALID_STORYBOARD.prompts);
    
    if (imagePrompts.length !== 3) {
      console.log(`   ❌ Failed: Expected 3 image prompts, got ${imagePrompts.length}`);
      return false;
    }
    
    // Verify first prompt
    const firstPrompt = imagePrompts[0];
    
    if (!firstPrompt.id || !firstPrompt.id.startsWith('agent-prompt-')) {
      console.log('   ❌ Failed: Invalid prompt ID format');
      return false;
    }
    
    if (firstPrompt.text !== VALID_STORYBOARD.prompts[0].text) {
      console.log('   ❌ Failed: Prompt text mismatch');
      return false;
    }
    
    if (firstPrompt.mood !== VALID_STORYBOARD.prompts[0].mood) {
      console.log('   ❌ Failed: Prompt mood mismatch');
      return false;
    }
    
    if (firstPrompt.timestamp !== VALID_STORYBOARD.prompts[0].timestamp) {
      console.log('   ❌ Failed: Prompt timestamp mismatch');
      return false;
    }
    
    if (typeof firstPrompt.timestampSeconds !== 'number') {
      console.log('   ❌ Failed: timestampSeconds not calculated');
      return false;
    }
    
    console.log('   ✅ Passed: ImagePrompts converted correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

/**
 * Test 12: Logging functionality
 * 
 * Tests that logging is working correctly.
 * Requirements: 1.3, 2.4
 */
async function testLoggingFunctionality(): Promise<boolean> {
  console.log('🧪 Integration Test 12: Logging Functionality');
  
  try {
    // Clear existing logs
    agentLogger.clearLogs();
    
    // Generate some log entries
    agentLogger.info('Test info message', { key: 'value' });
    agentLogger.warn('Test warning message');
    agentLogger.error('Test error message', { error: 'test error' });
    agentLogger.debug('Test debug message');
    
    const logs = agentLogger.getLogs();
    
    if (logs.length !== 4) {
      console.log(`   ❌ Failed: Expected 4 log entries, got ${logs.length}`);
      return false;
    }
    
    // Verify log structure
    const infoLog = logs.find(l => l.level === LogLevel.INFO);
    if (!infoLog) {
      console.log('   ❌ Failed: Info log not found');
      return false;
    }
    
    if (!infoLog.timestamp) {
      console.log('   ❌ Failed: Log timestamp missing');
      return false;
    }
    
    if (infoLog.message !== 'Test info message') {
      console.log('   ❌ Failed: Log message mismatch');
      return false;
    }
    
    // Test recent logs
    const recentLogs = agentLogger.getRecentLogs(2);
    if (recentLogs.length !== 2) {
      console.log(`   ❌ Failed: Expected 2 recent logs, got ${recentLogs.length}`);
      return false;
    }
    
    console.log('   ✅ Passed: Logging functionality working correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Failed with error: ${error}`);
    return false;
  }
}

// --- Test Runner ---

/**
 * Run all integration tests.
 */
export async function runIntegrationTests(): Promise<void> {
  console.log('\n========================================');
  console.log('Agent Director Integration Tests');
  console.log('Feature: agent-director-json-parsing-fix');
  console.log('========================================\n');
  
  const tests = [
    { name: 'Markdown-Wrapped Extraction', fn: testMarkdownWrappedExtraction },
    { name: 'Trailing Comma Handling', fn: testTrailingCommaHandling },
    { name: 'Surrounding Text Extraction', fn: testSurroundingTextExtraction },
    { name: 'Nested Storyboard Extraction', fn: testNestedStoryboardExtraction },
    { name: 'Fallback Processing', fn: testFallbackProcessing },
    { name: 'Fallback Notification', fn: testFallbackNotification },
    { name: 'Metrics Tracking', fn: testMetricsTracking },
    { name: 'Validation and Sanitization', fn: testValidationAndSanitization },
    { name: 'Format Correction Preprocessing', fn: testFormatCorrectionPreprocessing },
    { name: 'Format Guidance Generation', fn: testFormatGuidanceGeneration },
    { name: 'Convert to ImagePrompts', fn: testConvertToImagePrompts },
    { name: 'Logging Functionality', fn: testLoggingFunctionality },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ${test.name} threw an error: ${error}`);
      failed++;
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
runIntegrationTests().catch(console.error);
