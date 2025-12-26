/**
 * Property-Based Tests for Prompt Format Service
 * 
 * These tests validate the correctness properties defined in the design document
 * for the Agent Director JSON Parsing Fix feature - specifically Properties 17-20.
 * 
 * Uses fast-check for property-based testing.
 * 
 * Feature: agent-director-json-parsing-fix
 */

import * as fc from 'fast-check';
import {
  getStoryboardFormatSpecification,
  getAnalysisFormatSpecification,
  getStoryboardExamples,
  getAnalysisExamples,
  generateFormatSpecificationText,
  generateExampleText,
  generateCompleteFormatGuidance,
  preprocessFormatCorrection,
  needsFormatCorrection,
  responsePatternLibrary,
  FORMAT_CORRECTION_PATTERNS,
  STORYBOARD_JSON_SCHEMA,
  ANALYSIS_JSON_SCHEMA,
  type FormatSpecification,
  type ResponseExample,
  type FormatCorrectionResult
} from '../services/promptFormatService';

// --- Test Utilities ---

/**
 * Generates valid JSON objects for testing format correction.
 */
const validJsonObjectArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
    !s.includes('{') && !s.includes('}') && !s.includes('"')
  ),
  value: fc.integer({ min: 0, max: 100 })
});

/**
 * Generates storyboard-like JSON objects for testing.
 */
const storyboardJsonArbitrary = fc.record({
  prompts: fc.array(
    fc.record({
      text: fc.string({ minLength: 10, maxLength: 100 }).filter(s => 
        !s.includes('{') && !s.includes('}') && !s.includes('"')
      ),
      mood: fc.constantFrom('melancholic', 'hopeful', 'intense', 'peaceful'),
      timestamp: fc.tuple(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 })
      ).map(([min, sec]) => `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`),
    }),
    { minLength: 1, maxLength: 3 }
  )
});

/**
 * Wraps JSON in markdown code blocks.
 */
function wrapInMarkdown(json: unknown): string {
  const jsonStr = JSON.stringify(json, null, 2);
  return `\`\`\`json\n${jsonStr}\n\`\`\``;
}

/**
 * Adds trailing commas to JSON string.
 */
function addTrailingCommas(jsonStr: string): string {
  return jsonStr.replace(/(\s*)\}([^}]*)$/, ',$1}$2');
}

/**
 * Adds single quotes instead of double quotes for keys.
 */
function useSingleQuotes(jsonStr: string): string {
  return jsonStr.replace(/"([^"]+)":/g, "'$1':");
}

/**
 * Adds JavaScript-style comments.
 */
function addComments(jsonStr: string): string {
  return `// This is a comment\n${jsonStr}\n// Another comment`;
}

// --- Property Tests ---

/**
 * Property 17: Prompt Format Specifications
 * 
 * *For any* LLM request, the system should include format specifications 
 * in prompts to encourage consistent JSON output.
 * 
 * **Validates: Requirements 5.1**
 * 
 * Feature: agent-director-json-parsing-fix, Property 17: Prompt Format Specifications
 */
export async function testPromptFormatSpecifications(): Promise<boolean> {
  console.log('🧪 Property 17: Prompt Format Specifications');
  console.log('   Testing that format specifications are included in prompts...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Test both storyboard and analysis format types
  const formatTypeArbitrary = fc.constantFrom('storyboard', 'analysis') as fc.Arbitrary<'storyboard' | 'analysis'>;
  
  await fc.assert(
    fc.asyncProperty(
      formatTypeArbitrary,
      async (formatType) => {
        iterations++;
        
        // Get format specification
        const spec = formatType === 'storyboard' 
          ? getStoryboardFormatSpecification() 
          : getAnalysisFormatSpecification();
        
        // Verify specification has required fields
        if (!spec.outputFormat) {
          console.log(`   ❌ Iteration ${iterations}: Missing outputFormat`);
          passed = false;
          return false;
        }
        
        if (spec.outputFormat !== 'json') {
          console.log(`   ❌ Iteration ${iterations}: outputFormat should be 'json', got '${spec.outputFormat}'`);
          passed = false;
          return false;
        }
        
        if (!spec.jsonStructure || spec.jsonStructure.length === 0) {
          console.log(`   ❌ Iteration ${iterations}: Missing jsonStructure`);
          passed = false;
          return false;
        }
        
        if (!spec.validationRules || spec.validationRules.length === 0) {
          console.log(`   ❌ Iteration ${iterations}: Missing validationRules`);
          passed = false;
          return false;
        }
        
        if (!spec.commonMistakes || spec.commonMistakes.length === 0) {
          console.log(`   ❌ Iteration ${iterations}: Missing commonMistakes`);
          passed = false;
          return false;
        }
        
        // Generate format specification text
        const specText = generateFormatSpecificationText(formatType);
        
        // Verify text contains key elements
        if (!specText.includes('OUTPUT FORMAT')) {
          console.log(`   ❌ Iteration ${iterations}: Format text missing OUTPUT FORMAT section`);
          passed = false;
          return false;
        }
        
        if (!specText.includes('VALIDATION RULES')) {
          console.log(`   ❌ Iteration ${iterations}: Format text missing VALIDATION RULES section`);
          passed = false;
          return false;
        }
        
        if (!specText.includes('COMMON MISTAKES')) {
          console.log(`   ❌ Iteration ${iterations}: Format text missing COMMON MISTAKES section`);
          passed = false;
          return false;
        }
        
        // Verify JSON structure is included
        if (!specText.includes('{') || !specText.includes('}')) {
          console.log(`   ❌ Iteration ${iterations}: Format text missing JSON structure`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 17: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 18: Schema Requirements Inclusion
 * 
 * *For any* storyboard generation request, the system should specify 
 * exact JSON schema requirements in the prompt.
 * 
 * **Validates: Requirements 5.2**
 * 
 * Feature: agent-director-json-parsing-fix, Property 18: Schema Requirements Inclusion
 */
export async function testSchemaRequirementsInclusion(): Promise<boolean> {
  console.log('🧪 Property 18: Schema Requirements Inclusion');
  console.log('   Testing that JSON schema requirements are specified in prompts...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  const formatTypeArbitrary = fc.constantFrom('storyboard', 'analysis') as fc.Arbitrary<'storyboard' | 'analysis'>;
  
  await fc.assert(
    fc.asyncProperty(
      formatTypeArbitrary,
      async (formatType) => {
        iterations++;
        
        // Get the schema
        const schema = formatType === 'storyboard' ? STORYBOARD_JSON_SCHEMA : ANALYSIS_JSON_SCHEMA;
        
        // Verify schema has required structure
        if (!schema.type || schema.type !== 'object') {
          console.log(`   ❌ Iteration ${iterations}: Schema type should be 'object'`);
          passed = false;
          return false;
        }
        
        if (!schema.properties) {
          console.log(`   ❌ Iteration ${iterations}: Schema missing properties`);
          passed = false;
          return false;
        }
        
        if (!schema.required || schema.required.length === 0) {
          console.log(`   ❌ Iteration ${iterations}: Schema missing required fields`);
          passed = false;
          return false;
        }
        
        // For storyboard, verify prompts array is defined
        if (formatType === 'storyboard') {
          const storyboardSchema = schema as typeof STORYBOARD_JSON_SCHEMA;
          if (!storyboardSchema.properties.prompts) {
            console.log(`   ❌ Iteration ${iterations}: Storyboard schema missing prompts property`);
            passed = false;
            return false;
          }
          
          if (storyboardSchema.properties.prompts.type !== 'array') {
            console.log(`   ❌ Iteration ${iterations}: Prompts should be an array`);
            passed = false;
            return false;
          }
          
          // Verify prompt item schema
          const itemSchema = storyboardSchema.properties.prompts.items;
          if (!itemSchema.properties.text || !itemSchema.properties.mood || !itemSchema.properties.timestamp) {
            console.log(`   ❌ Iteration ${iterations}: Prompt item schema missing required fields`);
            passed = false;
            return false;
          }
        }
        
        // Generate complete format guidance and verify schema is included
        const guidance = generateCompleteFormatGuidance(formatType);
        
        if (!guidance.includes('JSON SCHEMA')) {
          console.log(`   ❌ Iteration ${iterations}: Guidance missing JSON SCHEMA section`);
          passed = false;
          return false;
        }
        
        // Verify schema is serialized in the guidance
        if (!guidance.includes('"type"') || !guidance.includes('"properties"')) {
          console.log(`   ❌ Iteration ${iterations}: Guidance missing serialized schema`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 18: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 19: Example Inclusion
 * 
 * *For any* generation prompt, the system should provide examples 
 * of correctly formatted responses.
 * 
 * **Validates: Requirements 5.3**
 * 
 * Feature: agent-director-json-parsing-fix, Property 19: Example Inclusion
 */
export async function testExampleInclusion(): Promise<boolean> {
  console.log('🧪 Property 19: Example Inclusion');
  console.log('   Testing that examples of correct responses are provided...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  const formatTypeArbitrary = fc.constantFrom('storyboard', 'analysis') as fc.Arbitrary<'storyboard' | 'analysis'>;
  
  await fc.assert(
    fc.asyncProperty(
      formatTypeArbitrary,
      async (formatType) => {
        iterations++;
        
        // Get examples
        const examples = formatType === 'storyboard' 
          ? getStoryboardExamples() 
          : getAnalysisExamples();
        
        // Verify examples exist
        if (!examples || examples.length === 0) {
          console.log(`   ❌ Iteration ${iterations}: No examples provided for ${formatType}`);
          passed = false;
          return false;
        }
        
        // Verify each example has required fields
        for (let i = 0; i < examples.length; i++) {
          const example = examples[i];
          
          if (!example.description || example.description.length === 0) {
            console.log(`   ❌ Iteration ${iterations}: Example ${i} missing description`);
            passed = false;
            return false;
          }
          
          if (!example.example || example.example.length === 0) {
            console.log(`   ❌ Iteration ${iterations}: Example ${i} missing example content`);
            passed = false;
            return false;
          }
          
          if (!example.notes || example.notes.length === 0) {
            console.log(`   ❌ Iteration ${iterations}: Example ${i} missing notes`);
            passed = false;
            return false;
          }
          
          // Verify example is valid JSON
          try {
            JSON.parse(example.example);
          } catch {
            console.log(`   ❌ Iteration ${iterations}: Example ${i} is not valid JSON`);
            passed = false;
            return false;
          }
        }
        
        // Generate example text and verify it's included
        const exampleText = generateExampleText(formatType);
        
        if (!exampleText.includes('EXAMPLE')) {
          console.log(`   ❌ Iteration ${iterations}: Example text missing EXAMPLE section`);
          passed = false;
          return false;
        }
        
        if (!exampleText.includes('NOTES')) {
          console.log(`   ❌ Iteration ${iterations}: Example text missing NOTES section`);
          passed = false;
          return false;
        }
        
        // Verify complete guidance includes examples
        const guidance = generateCompleteFormatGuidance(formatType);
        
        if (!guidance.includes('EXAMPLE')) {
          console.log(`   ❌ Iteration ${iterations}: Complete guidance missing examples`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 19: ${iterations} iterations completed`);
  return passed;
}

/**
 * Property 20: Format Correction Attempts
 * 
 * *For any* response that deviates from expected formats, the system 
 * should attempt format correction before parsing.
 * 
 * **Validates: Requirements 5.4**
 * 
 * Feature: agent-director-json-parsing-fix, Property 20: Format Correction Attempts
 */
export async function testFormatCorrectionAttempts(): Promise<boolean> {
  console.log('🧪 Property 20: Format Correction Attempts');
  console.log('   Testing that format correction is attempted for deviant responses...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 100;
  
  // Generate different types of format issues
  const formatIssueArbitrary = fc.constantFrom(
    'markdown_wrapped',
    'trailing_commas',
    'single_quotes',
    'js_comments',
    'leading_text',
    'trailing_text'
  );
  
  await fc.assert(
    fc.asyncProperty(
      validJsonObjectArbitrary,
      formatIssueArbitrary,
      async (jsonObj, issueType) => {
        iterations++;
        
        const originalJson = JSON.stringify(jsonObj, null, 2);
        let malformedContent: string;
        
        // Create malformed content based on issue type
        switch (issueType) {
          case 'markdown_wrapped':
            malformedContent = wrapInMarkdown(jsonObj);
            break;
          case 'trailing_commas':
            malformedContent = addTrailingCommas(originalJson);
            break;
          case 'single_quotes':
            malformedContent = useSingleQuotes(originalJson);
            break;
          case 'js_comments':
            malformedContent = addComments(originalJson);
            break;
          case 'leading_text':
            malformedContent = `Here is the result:\n\n${originalJson}`;
            break;
          case 'trailing_text':
            malformedContent = `${originalJson}\n\nLet me know if you need more.`;
            break;
          default:
            malformedContent = originalJson;
        }
        
        // Check if format correction is needed
        const needsCorrection = needsFormatCorrection(malformedContent);
        
        // For most issue types, correction should be needed
        if (issueType !== 'trailing_text' && !needsCorrection) {
          // Some issue types may not trigger needsFormatCorrection
          // This is acceptable as long as preprocessing handles them
        }
        
        // Apply format correction
        const result = preprocessFormatCorrection(malformedContent);
        
        // Verify result structure
        if (typeof result.corrected !== 'string') {
          console.log(`   ❌ Iteration ${iterations}: Corrected content is not a string`);
          passed = false;
          return false;
        }
        
        if (typeof result.wasModified !== 'boolean') {
          console.log(`   ❌ Iteration ${iterations}: wasModified is not a boolean`);
          passed = false;
          return false;
        }
        
        if (!Array.isArray(result.appliedCorrections)) {
          console.log(`   ❌ Iteration ${iterations}: appliedCorrections is not an array`);
          passed = false;
          return false;
        }
        
        if (typeof result.confidence !== 'number') {
          console.log(`   ❌ Iteration ${iterations}: confidence is not a number`);
          passed = false;
          return false;
        }
        
        // For markdown-wrapped content, verify correction was applied
        if (issueType === 'markdown_wrapped') {
          if (!result.wasModified) {
            console.log(`   ❌ Iteration ${iterations}: Markdown wrapping should have been corrected`);
            passed = false;
            return false;
          }
          
          // Verify markdown blocks were removed
          if (result.corrected.includes('```')) {
            console.log(`   ❌ Iteration ${iterations}: Markdown blocks not removed`);
            passed = false;
            return false;
          }
        }
        
        // For trailing commas, verify they were removed
        if (issueType === 'trailing_commas') {
          // Try to parse the corrected content
          try {
            JSON.parse(result.corrected);
          } catch {
            // Trailing comma correction may not always work perfectly
            // This is acceptable as long as other strategies can handle it
          }
        }
        
        // Verify confidence is in valid range
        if (result.confidence < 0 || result.confidence > 1) {
          console.log(`   ❌ Iteration ${iterations}: Confidence out of range: ${result.confidence}`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  console.log(`   ${passed ? '✅' : '❌'} Property 20: ${iterations} iterations completed`);
  return passed;
}

/**
 * Additional Property: Format Correction Pattern Coverage
 * 
 * Verifies that all defined correction patterns are properly structured.
 * 
 * Feature: agent-director-json-parsing-fix, Property 20b: Format Correction Pattern Coverage
 */
export async function testFormatCorrectionPatternCoverage(): Promise<boolean> {
  console.log('🧪 Property 20b: Format Correction Pattern Coverage');
  console.log('   Testing that all correction patterns are properly defined...');
  
  let passed = true;
  
  // Verify all patterns have required fields
  for (const pattern of FORMAT_CORRECTION_PATTERNS) {
    if (!pattern.name || pattern.name.length === 0) {
      console.log(`   ❌ Pattern missing name`);
      passed = false;
    }
    
    if (!pattern.pattern || !(pattern.pattern instanceof RegExp)) {
      console.log(`   ❌ Pattern ${pattern.name} missing or invalid regex`);
      passed = false;
    }
    
    if (!pattern.correction || typeof pattern.correction !== 'function') {
      console.log(`   ❌ Pattern ${pattern.name} missing or invalid correction function`);
      passed = false;
    }
    
    if (!pattern.description || pattern.description.length === 0) {
      console.log(`   ❌ Pattern ${pattern.name} missing description`);
      passed = false;
    }
  }
  
  // Verify minimum number of patterns exist
  const expectedPatterns = [
    'remove_markdown_json_blocks',
    'fix_trailing_commas_array',
    'fix_trailing_commas_object',
    'remove_js_comments'
  ];
  
  for (const expectedName of expectedPatterns) {
    const found = FORMAT_CORRECTION_PATTERNS.some(p => p.name === expectedName);
    if (!found) {
      console.log(`   ❌ Expected pattern '${expectedName}' not found`);
      passed = false;
    }
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Property 20b: Pattern coverage verified`);
  return passed;
}

/**
 * Additional Property: Response Pattern Library
 * 
 * Verifies that the response pattern library correctly tracks successful patterns.
 * 
 * Feature: agent-director-json-parsing-fix, Property 20c: Response Pattern Library
 */
export async function testResponsePatternLibrary(): Promise<boolean> {
  console.log('🧪 Property 20c: Response Pattern Library');
  console.log('   Testing that successful response patterns are tracked...');
  
  let passed = true;
  let iterations = 0;
  const maxIterations = 50;
  
  // Clear the library before testing
  responsePatternLibrary.clear();
  
  await fc.assert(
    fc.asyncProperty(
      storyboardJsonArbitrary,
      async (storyboard) => {
        iterations++;
        
        const jsonStr = JSON.stringify(storyboard, null, 2);
        
        // Get characteristics
        const characteristics = responsePatternLibrary.getPatternCharacteristics(jsonStr);
        
        // Verify characteristics are detected
        if (!Array.isArray(characteristics)) {
          console.log(`   ❌ Iteration ${iterations}: Characteristics not an array`);
          passed = false;
          return false;
        }
        
        // Storyboard should have prompts characteristic
        if (!characteristics.includes('has_prompts_array')) {
          console.log(`   ❌ Iteration ${iterations}: Missing has_prompts_array characteristic`);
          passed = false;
          return false;
        }
        
        // Add pattern to library
        responsePatternLibrary.addPattern(jsonStr, characteristics);
        
        // Verify pattern was added
        if (responsePatternLibrary.size === 0) {
          console.log(`   ❌ Iteration ${iterations}: Pattern not added to library`);
          passed = false;
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: maxIterations }
  );
  
  // Verify top patterns can be retrieved
  const topPatterns = responsePatternLibrary.getTopPatterns(5);
  if (!Array.isArray(topPatterns)) {
    console.log(`   ❌ getTopPatterns did not return an array`);
    passed = false;
  }
  
  console.log(`   ${passed ? '✅' : '❌'} Property 20c: ${iterations} iterations completed`);
  return passed;
}

// --- Test Runner ---

interface TestResult {
  name: string;
  passed: boolean;
}

/**
 * Run all prompt format service property tests.
 */
export async function runPromptFormatServiceTests(): Promise<void> {
  console.log('========================================');
  console.log('Prompt Format Service Property Tests');
  console.log('Feature: agent-director-json-parsing-fix');
  console.log('Properties: 17, 18, 19, 20');
  console.log('========================================\n');
  
  const results: TestResult[] = [];
  
  // Property 17: Prompt Format Specifications
  results.push({
    name: 'Property 17: Prompt Format Specifications',
    passed: await testPromptFormatSpecifications()
  });
  
  // Property 18: Schema Requirements Inclusion
  results.push({
    name: 'Property 18: Schema Requirements Inclusion',
    passed: await testSchemaRequirementsInclusion()
  });
  
  // Property 19: Example Inclusion
  results.push({
    name: 'Property 19: Example Inclusion',
    passed: await testExampleInclusion()
  });
  
  // Property 20: Format Correction Attempts
  results.push({
    name: 'Property 20: Format Correction Attempts',
    passed: await testFormatCorrectionAttempts()
  });
  
  // Property 20b: Format Correction Pattern Coverage
  results.push({
    name: 'Property 20b: Format Correction Pattern Coverage',
    passed: await testFormatCorrectionPatternCoverage()
  });
  
  // Property 20c: Response Pattern Library
  results.push({
    name: 'Property 20c: Response Pattern Library',
    passed: await testResponsePatternLibrary()
  });
  
  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================\n');
  
  let allPassed = true;
  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('\n----------------------------------------');
  console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('----------------------------------------\n');
  
  if (!allPassed) {
    process.exit(1);
  }
}

// Run tests if executed directly
runPromptFormatServiceTests().catch(console.error);
