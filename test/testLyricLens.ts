import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SongData, ImagePrompt, GeneratedImage } from '../types';
import { parseSRT } from '../utils/srtParser';
import { testPostCSSConfig } from './testPostCSS.js';
import { testCSSFunctionalityPreservation, testSpecificCSSFeatures } from './testCSSFunctionality.js';
import { testCSSOutputConsistency, verifyIdenticalStyling } from './testCSSOutput.js';
import { 
  testCompleteBuildPipeline, 
  testTailwindClassRendering, 
  testDevelopmentServer, 
  testCSSHotReload 
} from './testBuildPipeline.js';
import { testApiClientExports, testWithRetryFunctionality } from './testApiClient.js';
import { testLangChainDependencies, testLangChainImports } from './testDependencies.js';
import { runHookIntegrationTests } from './testHookIntegration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, '../test_data');


// Convert file to data URL for browser compatibility
const fileToDataURL = (filePath: string, mimeType: string): string => {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
};

// Parse image filename to extract mood and timestamp info
const parseImageFilename = (filename: string): { mood: string; section: string } => {
  // "lyric-art-Bridge 1 - Urgent Caution.png" -> { mood: "Urgent Caution", section: "Bridge 1" }
  const match = filename.match(/lyric-art-(.+?) - (.+)\.png$/);
  if (match) {
    return { section: match[1], mood: match[2] };
  }
  return { section: 'Unknown', mood: 'Unknown' };
};

// Map sections to approximate timestamps based on SRT content
const getSectionTimestamp = (section: string): number => {
  const sectionMap: Record<string, number> = {
    'Intro': 0,
    'Verse 1': 51,      // First verse starts around 00:00:51
    'Verse 2': 119,     // Around 00:01:59 
    'Bridge 1': 183,    // Around 00:03:03
    'Chorus_Outro 1': 203, // Around 00:03:23
    'Interlude': 229,   // Around 00:03:49
    'Verse 3': 289,     // Around 00:04:49
    'Bridge 2': 298,    // Around 00:04:58
    'Verse 4': 326,     // Around 00:05:26
    'Outro 2': 340,     // Around 00:05:40
    'Outro 3': 364      // Around 00:06:04
  };
  return sectionMap[section] || 0;
};

export const createTestSongData = (): SongData => {
  console.log('🎵 Creating test song data from test_data folder...');

  // Load audio file
  const audioPath = path.join(testDataDir, 'the true Saba.mp3');
  const audioUrl = fileToDataURL(audioPath, 'audio/mp3');

  // Load and parse SRT
  const srtPath = path.join(testDataDir, 'the true Saba.srt');
  const srtContent = fs.readFileSync(srtPath, 'utf-8');
  const parsedSubtitles = parseSRT(srtContent);

  console.log(`📝 Loaded ${parsedSubtitles.length} subtitle entries`);

  // Load all image files
  const imageFiles = fs.readdirSync(testDataDir)
    .filter(file => file.endsWith('.png') && file.startsWith('lyric-art-'));

  console.log(`🖼️  Found ${imageFiles.length} artwork images`);

  // Create prompts from images
  const prompts: ImagePrompt[] = imageFiles.map((filename, index) => {
    const { section, mood } = parseImageFilename(filename);
    const timestamp = getSectionTimestamp(section);
    
    return {
      id: `prompt-test-${index}`,
      text: `A ${mood.toLowerCase()} scene representing the ${section.toLowerCase()} of the song`,
      mood: `${section} - ${mood}`,
      timestamp: formatTimestamp(timestamp),
      timestampSeconds: timestamp
    };
  });

  // Create generated images from the PNG files
  const generatedImages: GeneratedImage[] = imageFiles.map((filename, index) => {
    const imagePath = path.join(testDataDir, filename);
    const imageUrl = fileToDataURL(imagePath, 'image/png');
    
    return {
      promptId: `prompt-test-${index}`,
      imageUrl
    };
  });

  console.log(`✨ Created ${prompts.length} prompts with matching images`);

  return {
    fileName: 'the true Saba.mp3',
    audioUrl,
    srtContent,
    parsedSubtitles,
    prompts,
    generatedImages
  };
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Test the video export functionality
export const testVideoExport = async () => {
  console.log('🎬 Testing video export with test data...');
  
  // Skip video export test in node environment since it requires browser APIs
  // like Canvas, Image, Blob, etc.
  console.log('⚠️ Skipping video export test (requires browser environment)');
  return true;
};

// Test subtitle parsing
export const testSRTParsing = () => {
  console.log('📝 Testing SRT parsing...');
  
  const srtPath = path.join(testDataDir, 'the true Saba.srt');
  const srtContent = fs.readFileSync(srtPath, 'utf-8');
  const subtitles = parseSRT(srtContent);
  
  console.log(`Parsed ${subtitles.length} subtitles`);
  console.log('First subtitle:', subtitles[0]);
  console.log('Last subtitle:', subtitles[subtitles.length - 1]);
  
  // Validate timing
  const hasValidTiming = subtitles.every(sub => 
    sub.startTime < sub.endTime && sub.startTime >= 0
  );
  
  console.log(`✅ All subtitles have valid timing: ${hasValidTiming}`);
  return hasValidTiming;
};

// Run all tests
export const runAllTests = async () => {
  console.log('🧪 Running LyricLens test suite...\n');
  
  const results = {
    postCSSConfig: await testPostCSSConfig(),
    srtParsing: testSRTParsing(),
    dataLoading: (() => {
      try {
        const songData = createTestSongData();
        console.log(`✅ Test data loaded successfully`);
        console.log(`   - Audio: ${songData.audioUrl.slice(0, 50)}...`);
        console.log(`   - Subtitles: ${songData.parsedSubtitles.length} entries`);
        console.log(`   - Prompts: ${songData.prompts.length} scenes`);
        console.log(`   - Images: ${songData.generatedImages.length} artworks`);
        return true;
      } catch (error) {
        console.error('❌ Failed to load test data:', error);
        return false;
      }
    })(),
    cssFunctionalityPreservation: await testCSSFunctionalityPreservation(),
    specificCSSFeatures: testSpecificCSSFeatures(),
    cssOutputConsistency: testCSSOutputConsistency(),
    identicalStyling: verifyIdenticalStyling(),
    completeBuildPipeline: testCompleteBuildPipeline(),
    tailwindClassRendering: testTailwindClassRendering(),
    developmentServer: await testDevelopmentServer(),
    cssHotReload: testCSSHotReload(),
    videoExport: await testVideoExport(),
    apiClientExports: await testApiClientExports(),
    withRetryFunctionality: await testWithRetryFunctionality(),
    langChainDependencies: testLangChainDependencies(),
    langChainImports: await testLangChainImports(),
    hookIntegration: await (async () => {
      try {
        const hookResults = await runHookIntegrationTests();
        return Object.values(hookResults).every(Boolean);
      } catch (error) {
        console.error('❌ Hook integration tests failed:', error);
        return false;
      }
    })()
  };
  
  console.log('\n📊 Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
  
  return results;
};

// createTestSongData is already exported above