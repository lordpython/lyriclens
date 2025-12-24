/**
 * Test script for DeAPI video generation service
 * This script performs a real video generation using the DeAPI service
 */

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Debug: Print environment variables
console.log('Environment variables loaded:');
console.log('DEAPI_API_KEY:', process.env.DEAPI_API_KEY ? 'SET' : 'NOT SET');
console.log('VITE_DEAPI_API_KEY:', process.env.VITE_DEAPI_API_KEY ? 'SET' : 'NOT SET');

// Set the environment variable that deapiService expects
if (process.env.VITE_DEAPI_API_KEY) {
  process.env.DEAPI_API_KEY = process.env.VITE_DEAPI_API_KEY;
  console.log('Set DEAPI_API_KEY from VITE_DEAPI_API_KEY');
}

/**
 * A simple 512x512 PNG image as base64 (a blue gradient)
 * This is a minimal valid PNG file
 */
const TEST_IMAGE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/**
 * Main test function
 */
async function runDeApiTest() {
  console.log('\n' + '='.repeat(60));
  console.log('DeAPI Video Generation Test');
  console.log('='.repeat(60));
  
  // Use dynamic import to load the service AFTER setting environment variables
  const deapiService = await import('../services/deapiService');
  const animateImageWithDeApi = deapiService.animateImageWithDeApi;
  const isDeApiConfigured = deapiService.isDeApiConfigured;
  const getDeApiConfigMessage = deapiService.getDeApiConfigMessage;
  
  // Check configuration
  console.log('\n1. Checking DeAPI configuration...');
  if (!isDeApiConfigured()) {
    console.error('❌ DeAPI is not configured!');
    console.error(getDeApiConfigMessage());
    process.exit(1);
  }
  console.log('✅ DeAPI is configured and ready');
  
  // Test parameters
  const testPrompt = 'A serene ocean scene with gentle waves, cinematic lighting, smooth camera movement';
  const testAspectRatio: '16:9' | '9:16' | '1:1' = '16:9';
  
  console.log('\n2. Test Parameters:');
  console.log(`   Prompt: "${testPrompt}"`);
  console.log(`   Aspect Ratio: ${testAspectRatio}`);
  console.log(`   Model: Ltxv_13B_0_9_8_Distilled_FP8`);
  console.log(`   Frames: 120`);
  console.log(`   FPS: 30`);
  
  // Run video generation
  console.log('\n3. Starting video generation...');
  console.log('   This may take 2-4 minutes depending on queue...');
  console.log('   Polling for progress...\n');
  
  const startTime = Date.now();
  
  try {
    const videoBase64 = await animateImageWithDeApi(
      TEST_IMAGE_BASE64,
      testPrompt,
      testAspectRatio
    );
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Video Generation Successful!');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration} seconds`);
    console.log(`Video size: ${(videoBase64.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Video type: ${videoBase64.substring(0, 50)}...`);
    
    // Save the result to a file for inspection
    const outputPath = path.join(__dirname, 'deapi-test-output.txt');
    
    fs.writeFileSync(outputPath, videoBase64);
    console.log(`\n📁 Video saved to: ${outputPath}`);
    console.log('   (Base64 encoded - you can decode it to view the video)');
    
    // Also save as a .mp4 file for easy viewing
    const videoPath = path.join(__dirname, 'deapi-test-output.mp4');
    const base64Data = videoBase64.replace(/^data:video\/mp4;base64,/, '');
    fs.writeFileSync(videoPath, Buffer.from(base64Data, 'base64'));
    console.log(`📁 Video also saved as: ${videoPath}`);
    console.log('   (You can open this file directly in a video player)');
    
    console.log('\n' + '='.repeat(60));
    console.log('Test completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('❌ Video Generation Failed!');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration} seconds`);
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
runDeApiTest().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
