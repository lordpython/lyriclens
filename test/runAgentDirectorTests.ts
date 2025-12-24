/**
 * Runner for Agent Director Service Tests
 * 
 * Execute with: npx tsx test/runAgentDirectorTests.ts
 */

import { runAgentDirectorTests } from './testAgentDirectorService.js';

async function main() {
  console.log('Starting Agent Director Service Tests...\n');
  
  try {
    const { passed, failed, results } = await runAgentDirectorTests();
    
    console.log('\nDetailed Results:');
    for (const [name, result] of Object.entries(results)) {
      console.log(`  ${result ? '✅' : '❌'} ${name}`);
    }
    
    console.log(`\nTotal: ${passed} passed, ${failed} failed`);
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

main();
