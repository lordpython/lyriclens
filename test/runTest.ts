#!/usr/bin/env tsx

import { runAllTests } from './testLyricLens.js';

console.log('🚀 Starting LyricLens test suite...\n');

runAllTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });