#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables before importing app code
// 1. Load .env.local first (if it exists)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('📝 Loading environment from .env.local');
  dotenv.config({ path: envLocalPath });
}

// 2. Load .env (defaults, won't overwrite existing)
dotenv.config();

console.log('🚀 Starting LyricLens test suite...\n');

// Dynamic import to ensure env vars are loaded first
const { runAllTests } = await import('./testLyricLens.js');

runAllTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });