#!/usr/bin/env tsx

/**
 * Runner for Director Service Property Tests
 * 
 * Executes property-based tests for the LangChain Director Agent workflow.
 */

import { runDirectorServiceTests } from './testDirectorService.js';

console.log('🚀 Starting Director Service Property Tests...\n');

runDirectorServiceTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    console.log(`\n${allPassed ? '🎉 All property tests passed!' : '⚠️  Some property tests failed'}`);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Property test suite crashed:', error);
    process.exit(1);
  });
