#!/usr/bin/env node

// Simple test runner for Node.js environment
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Running LyricLens Tests...\n');

// Check if test data exists
import fs from 'fs';
const testDataDir = path.join(__dirname, 'test_data');

if (!fs.existsSync(testDataDir)) {
  console.error('❌ test_data directory not found!');
  console.log('Please ensure the following files exist:');
  console.log('  - test_data/the true Saba.mp3');
  console.log('  - test_data/the true Saba.srt');
  console.log('  - test_data/lyric-art-*.png (artwork files)');
  process.exit(1);
}

const requiredFiles = [
  'the true Saba.mp3',
  'the true Saba.srt'
];

const missingFiles = requiredFiles.filter(file => 
  !fs.existsSync(path.join(testDataDir, file))
);

if (missingFiles.length > 0) {
  console.error('❌ Missing required test files:');
  missingFiles.forEach(file => console.log(`  - test_data/${file}`));
  process.exit(1);
}

const imageFiles = fs.readdirSync(testDataDir)
  .filter(file => file.startsWith('lyric-art-') && file.endsWith('.png'));

console.log('✅ Test data validation passed');
console.log(`📁 Found ${imageFiles.length} artwork files`);
console.log('🎵 Audio and SRT files present\n');

// Run the TypeScript test
const testProcess = spawn('npx', ['tsx', 'test/runTest.ts'], {
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Start the servers: npm run dev:all');
    console.log('  2. Open http://localhost:3000');
    console.log('  3. Click "Load Test Data" to test the UI');
  } else {
    console.log('\n❌ Tests failed');
  }
  process.exit(code);
});

testProcess.on('error', (err) => {
  console.error('Failed to run tests:', err);
  process.exit(1);
});