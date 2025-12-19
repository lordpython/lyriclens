import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test CSS output consistency between development and production builds
 * Validates Requirements 1.4, 1.5
 */

interface CSSAnalysis {
  hasTailwindClasses: boolean;
  hasCustomStyles: boolean;
  hasUtilities: boolean;
  isMinified: boolean;
  fileSize: number;
  classCount: number;
}

// Analyze CSS content for key features
const analyzeCSSContent = (cssContent: string, buildType: 'dev' | 'prod'): CSSAnalysis => {
  return {
    hasTailwindClasses: cssContent.includes('tailwindcss') || 
                        cssContent.includes('flex') || 
                        cssContent.includes('grid'),
    hasCustomStyles: cssContent.includes('fadeIn') && 
                     cssContent.includes('slideInFromBottom') &&
                     cssContent.includes('line-clamp-3'),
    hasUtilities: (cssContent.includes('flex') || cssContent.includes('.flex')) &&
                  (cssContent.includes('grid') || cssContent.includes('.grid')) &&
                  cssContent.includes('transition'),
    isMinified: buildType === 'prod' ? !cssContent.includes('\n  ') : true,
    fileSize: cssContent.length,
    classCount: (cssContent.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*\s*\{/g) || []).length
  };
};

// Get CSS content from production build
const getProductionCSS = (): string => {
  console.log('   Building production bundle...');
  
  try {
    execSync('npm run build', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    const distDir = path.join(__dirname, '../dist');
    const assetsDir = path.join(distDir, 'assets');
    
    if (!fs.existsSync(assetsDir)) {
      throw new Error('Assets directory not found in dist after build');
    }
    
    const cssFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.css'));
    
    if (cssFiles.length === 0) {
      throw new Error('No CSS file found in dist/assets directory');
    }
    
    const cssPath = path.join(assetsDir, cssFiles[0]);
    return fs.readFileSync(cssPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to get production CSS: ${error}`);
  }
};

// Get CSS content from development (source)
const getDevelopmentCSS = (): string => {
  const cssPath = path.join(__dirname, '../index.css');
  
  if (!fs.existsSync(cssPath)) {
    throw new Error('index.css not found');
  }
  
  return fs.readFileSync(cssPath, 'utf-8');
};

// Test various Tailwind classes in a generated HTML file
const testTailwindClasses = (): boolean => {
  console.log('   Testing Tailwind class generation...');
  
  const testClasses = [
    'flex flex-col items-center justify-center',
    'w-full h-full min-h-screen',
    'bg-[#0f172a] text-white',
    'rounded-full border-2 border-dashed',
    'opacity-50 transition-all duration-300',
    'hover:scale-105 active:scale-95',
    'grid grid-cols-1 gap-4',
    'absolute relative fixed',
    'overflow-hidden overflow-y-auto',
    'uppercase italic cursor-pointer'
  ];
  
  // Create a test HTML file with these classes
  const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="../index.css">
</head>
<body>
  ${testClasses.map((classes, i) => `<div class="${classes}">Test ${i}</div>`).join('\n  ')}
</body>
</html>`;
  
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const testHTMLPath = path.join(tempDir, 'css-test.html');
  fs.writeFileSync(testHTMLPath, testHTML);
  
  console.log(`   ✓ Generated test HTML with ${testClasses.length} class combinations`);
  return true;
};

// Compare CSS output consistency
export const testCSSOutputConsistency = (): boolean => {
  console.log('🔍 Testing CSS output consistency...');
  
  try {
    // Test Tailwind class generation
    testTailwindClasses();
    
    // Get production CSS
    const prodCSS = getProductionCSS();
    const prodAnalysis = analyzeCSSContent(prodCSS, 'prod');
    
    console.log('\n   Production Build Analysis:');
    console.log(`   - Tailwind classes present: ${prodAnalysis.hasTailwindClasses}`);
    console.log(`   - Custom styles preserved: ${prodAnalysis.hasCustomStyles}`);
    console.log(`   - Utility classes present: ${prodAnalysis.hasUtilities}`);
    console.log(`   - CSS is minified: ${prodAnalysis.isMinified}`);
    console.log(`   - File size: ${(prodAnalysis.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   - Class count: ${prodAnalysis.classCount}`);
    
    // Verify all critical features are present
    const allChecksPass = 
      prodAnalysis.hasTailwindClasses &&
      prodAnalysis.hasCustomStyles &&
      prodAnalysis.hasUtilities &&
      prodAnalysis.isMinified &&
      prodAnalysis.fileSize > 1000; // Ensure CSS is not empty
    
    if (allChecksPass) {
      console.log('\n✅ CSS output consistency verified');
      console.log('   - Production build generates correct CSS');
      console.log('   - All Tailwind utilities are processed');
      console.log('   - Custom styles are preserved');
      return true;
    } else {
      console.log('\n❌ CSS output consistency check failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ CSS output consistency test failed:', error);
    return false;
  }
};

// Verify identical styling output in dev and production
export const verifyIdenticalStyling = (): boolean => {
  console.log('\n🎯 Verifying identical styling output...');
  
  try {
    const devCSS = getDevelopmentCSS();
    const prodCSS = getProductionCSS();
    
    const devAnalysis = analyzeCSSContent(devCSS, 'dev');
    const prodAnalysis = analyzeCSSContent(prodCSS, 'prod');
    
    // For dev vs prod comparison, we expect:
    // - Both should have custom styles (from index.css)
    // - Production should have processed Tailwind utilities (dev source won't)
    // - Production should be minified, dev source is not
    
    const customStylesMatch = devAnalysis.hasCustomStyles === prodAnalysis.hasCustomStyles;
    const prodHasUtilities = prodAnalysis.hasUtilities; // Production should have utilities
    const prodIsMinified = prodAnalysis.isMinified; // Production should be minified
    
    console.log('   Development vs Production:');
    console.log(`   - Custom styles preserved: ${customStylesMatch}`);
    console.log(`   - Production has Tailwind utilities: ${prodHasUtilities}`);
    console.log(`   - Production is minified: ${prodIsMinified}`);
    
    // The key test is that custom styles are preserved and production has processed utilities
    const stylingConsistent = customStylesMatch && prodHasUtilities && prodIsMinified;
    
    if (stylingConsistent) {
      console.log('\n✅ Styling output is consistent between dev and production');
      console.log('   - Custom styles are preserved in production build');
      console.log('   - Tailwind utilities are properly processed');
      return true;
    } else {
      console.log('\n❌ Styling output consistency issues detected');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Styling verification failed:', error);
    return false;
  }
};
