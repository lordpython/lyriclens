#!/usr/bin/env tsx

import { testCSSFunctionalityPreservation, testSpecificCSSFeatures } from './testCSSFunctionality.js';

console.log('🚀 Starting CSS functionality tests...\n');

const runCSSTests = async () => {
  const results = {
    cssFunctionalityPreservation: await testCSSFunctionalityPreservation(),
    specificCSSFeatures: testSpecificCSSFeatures()
  };
  
  console.log('\n📊 CSS Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All CSS tests passed!' : '⚠️  Some CSS tests failed'}`);
  
  return allPassed;
};

runCSSTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 CSS test suite crashed:', error);
    process.exit(1);
  });