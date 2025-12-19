#!/usr/bin/env tsx

import { 
  testCompleteBuildPipeline, 
  testTailwindClassRendering, 
  testDevelopmentServer, 
  testCSSHotReload 
} from './testBuildPipeline.js';

console.log('🏗️  Running Build Pipeline Integration Tests...\n');

async function runBuildPipelineTests() {
  const results = {
    completeBuildPipeline: testCompleteBuildPipeline(),
    tailwindClassRendering: testTailwindClassRendering(),
    developmentServer: await testDevelopmentServer(),
    cssHotReload: testCSSHotReload()
  };
  
  console.log('\n📊 Build Pipeline Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All build pipeline tests passed!' : '⚠️  Some build pipeline tests failed'}`);
  
  return allPassed;
}

runBuildPipelineTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Build pipeline tests crashed:', error);
    process.exit(1);
  });