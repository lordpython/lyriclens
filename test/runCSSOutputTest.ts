#!/usr/bin/env tsx

import { testCSSOutputConsistency, verifyIdenticalStyling } from './testCSSOutput.js';

console.log('🎨 Running CSS Output Tests...\n');

async function runCSSOutputTests() {
  const results = {
    cssOutputConsistency: testCSSOutputConsistency(),
    identicalStyling: verifyIdenticalStyling()
  };
  
  console.log('\n📊 CSS Output Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All CSS output tests passed!' : '⚠️  Some CSS output tests failed'}`);
  
  return allPassed;
}

runCSSOutputTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 CSS output tests crashed:', error);
    process.exit(1);
  });