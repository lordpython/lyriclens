#!/usr/bin/env tsx

import { runApiClientTests } from './testApiClient.js';

console.log('🚀 Starting apiClient test suite...\n');

runApiClientTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
