/**
 * Runner for Hook Integration Tests
 * 
 * Executes the integration tests for useLyricLens hook with LangChain Director Service.
 */

import { runHookIntegrationTests } from './testHookIntegration.js';

async function main() {
  console.log('🚀 Starting Hook Integration Tests...\n');
  
  try {
    const results = await runHookIntegrationTests();
    
    const allPassed = Object.values(results).every(Boolean);
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.values(results).length;
    
    console.log(`\n📈 Summary: ${passedCount}/${totalCount} tests passed`);
    
    if (allPassed) {
      console.log('🎉 All hook integration tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some hook integration tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  }
}

main();
