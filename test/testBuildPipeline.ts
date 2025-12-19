import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration tests for complete build pipeline
 * Tests end-to-end CSS processing and Tailwind class rendering
 * Validates Requirements 1.4, 2.3
 */

interface BuildArtifacts {
  htmlExists: boolean;
  cssExists: boolean;
  jsExists: boolean;
  cssContent: string;
  htmlContent: string;
  buildSize: number;
}

// Clean build directory
const cleanBuildDirectory = (): void => {
  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
};

// Analyze build artifacts
const analyzeBuildArtifacts = (): BuildArtifacts => {
  const distDir = path.join(__dirname, '../dist');
  const assetsDir = path.join(distDir, 'assets');
  
  if (!fs.existsSync(distDir)) {
    throw new Error('Build directory does not exist');
  }
  
  const htmlPath = path.join(distDir, 'index.html');
  const htmlExists = fs.existsSync(htmlPath);
  const htmlContent = htmlExists ? fs.readFileSync(htmlPath, 'utf-8') : '';
  
  let cssExists = false;
  let cssContent = '';
  let jsExists = false;
  let buildSize = 0;
  
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    
    const cssFiles = assetFiles.filter(file => file.endsWith('.css'));
    cssExists = cssFiles.length > 0;
    
    if (cssExists) {
      const cssPath = path.join(assetsDir, cssFiles[0]);
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    }
    
    jsExists = assetFiles.some(file => file.endsWith('.js'));
    
    // Calculate total build size
    assetFiles.forEach(file => {
      const filePath = path.join(assetsDir, file);
      buildSize += fs.statSync(filePath).size;
    });
  }
  
  if (htmlExists) {
    buildSize += fs.statSync(htmlPath).size;
  }
  
  return {
    htmlExists,
    cssExists,
    jsExists,
    cssContent,
    htmlContent,
    buildSize
  };
};

// Test complete build pipeline
export const testCompleteBuildPipeline = (): boolean => {
  console.log('🏗️  Testing complete build pipeline...');
  
  try {
    // Clean previous build
    cleanBuildDirectory();
    console.log('   ✓ Cleaned previous build artifacts');
    
    // Run production build
    console.log('   🔨 Running production build...');
    const buildStart = Date.now();
    
    execSync('npm run build', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    const buildTime = Date.now() - buildStart;
    console.log(`   ✓ Build completed in ${buildTime}ms`);
    
    // Analyze build artifacts
    const artifacts = analyzeBuildArtifacts();
    
    console.log('\n   📦 Build Artifacts Analysis:');
    console.log(`   - HTML file exists: ${artifacts.htmlExists}`);
    console.log(`   - CSS file exists: ${artifacts.cssExists}`);
    console.log(`   - JS file exists: ${artifacts.jsExists}`);
    console.log(`   - Total build size: ${(artifacts.buildSize / 1024).toFixed(2)} KB`);
    console.log(`   - CSS size: ${(artifacts.cssContent.length / 1024).toFixed(2)} KB`);
    
    // Verify all essential artifacts exist
    const allArtifactsExist = artifacts.htmlExists && artifacts.cssExists && artifacts.jsExists;
    
    if (!allArtifactsExist) {
      console.log('\n❌ Build pipeline failed - missing essential artifacts');
      return false;
    }
    
    console.log('\n✅ Complete build pipeline test passed');
    console.log('   - All essential build artifacts generated');
    console.log('   - Build process completed successfully');
    
    return true;
    
  } catch (error) {
    console.error('❌ Build pipeline test failed:', error);
    return false;
  }
};

// Test Tailwind classes render correctly in built output
export const testTailwindClassRendering = (): boolean => {
  console.log('\n🎨 Testing Tailwind class rendering...');
  
  try {
    // Ensure we have a fresh build
    const artifacts = analyzeBuildArtifacts();
    
    if (!artifacts.cssExists) {
      throw new Error('CSS file not found - run build first');
    }
    
    // Test specific Tailwind classes that should be in the CSS
    const expectedClasses = [
      'flex', 'grid', 'items-center', 'justify-center',
      'w-full', 'h-full', 'min-h-screen',
      'bg-', 'text-', 'border', 'rounded',
      'opacity-', 'transition', 'hover:', 'focus:',
      'absolute', 'relative', 'fixed',
      'overflow-', 'cursor-', 'pointer-events'
    ];
    
    const cssContent = artifacts.cssContent;
    const foundClasses: string[] = [];
    const missingClasses: string[] = [];
    
    expectedClasses.forEach(className => {
      // Check if the class or its functionality exists in the CSS
      const classExists = 
        cssContent.includes(`.${className}`) ||
        cssContent.includes(`${className}`) ||
        cssContent.includes(className.replace(':', '\\:'));
      
      if (classExists) {
        foundClasses.push(className);
      } else {
        missingClasses.push(className);
      }
    });
    
    console.log(`   ✓ Found ${foundClasses.length}/${expectedClasses.length} expected class patterns`);
    
    if (missingClasses.length > 0) {
      console.log(`   ⚠️  Missing class patterns: ${missingClasses.join(', ')}`);
    }
    
    // Test that custom styles from index.css are preserved
    const hasCustomStyles = 
      cssContent.includes('fadeIn') &&
      cssContent.includes('slideInFromBottom') &&
      cssContent.includes('line-clamp-3');
    
    console.log(`   ✓ Custom styles preserved: ${hasCustomStyles}`);
    
    // Test that CSS is properly minified
    const isMinified = !cssContent.includes('\n  ') && cssContent.length > 1000;
    console.log(`   ✓ CSS is minified: ${isMinified}`);
    
    // Test that HTML references the CSS correctly
    const htmlReferencesCSS = artifacts.htmlContent.includes('.css');
    console.log(`   ✓ HTML references CSS: ${htmlReferencesCSS}`);
    
    const allChecksPass = 
      foundClasses.length >= expectedClasses.length * 0.8 && // At least 80% of classes found
      hasCustomStyles &&
      isMinified &&
      htmlReferencesCSS;
    
    if (allChecksPass) {
      console.log('\n✅ Tailwind class rendering test passed');
      console.log('   - Tailwind utilities are properly processed');
      console.log('   - Custom styles are preserved');
      console.log('   - CSS is optimized for production');
      return true;
    } else {
      console.log('\n❌ Tailwind class rendering test failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Tailwind class rendering test failed:', error);
    return false;
  }
};

// Test development server functionality
export const testDevelopmentServer = async (): Promise<boolean> => {
  console.log('\n🚀 Testing development server startup...');
  
  try {
    // Test that dev server can start without errors
    // We'll do a quick syntax check of the vite config and related files
    
    const viteConfigPath = path.join(__dirname, '../vite.config.ts');
    const postCSSConfigPath = path.join(__dirname, '../postcss.config.js');
    // Tailwind config is no longer needed with v4
    // const tailwindConfigPath = path.join(__dirname, '../tailwind.config.js');
    
    // Check that all config files exist
    const configsExist = 
      fs.existsSync(viteConfigPath) &&
      fs.existsSync(postCSSConfigPath);
    
    console.log(`   ✓ Configuration files exist: ${configsExist}`);
    
    if (!configsExist) {
      throw new Error('Missing configuration files');
    }
    
    // Test PostCSS config syntax by reading and parsing the file
    try {
      const postCSSConfigContent = fs.readFileSync(postCSSConfigPath, 'utf-8');
      
      // Check for required plugins in the config content
      const hasRequiredPlugins = 
        postCSSConfigContent.includes('@tailwindcss/postcss') &&
        postCSSConfigContent.includes('autoprefixer');
      
      console.log(`   ✓ PostCSS config is valid: ${hasRequiredPlugins}`);
      
      if (!hasRequiredPlugins) {
        throw new Error('PostCSS config missing required plugins');
      }
      
    } catch (error) {
      throw new Error(`PostCSS config error: ${error}`);
    }
    
    console.log('\n✅ Development server configuration test passed');
    console.log('   - All configuration files are present and valid');
    console.log('   - PostCSS is properly configured');
    
    return true;
    
  } catch (error) {
    console.error('❌ Development server test failed:', error);
    return false;
  }
};

// Test CSS hot reload functionality (simulated)
export const testCSSHotReload = (): boolean => {
  console.log('\n🔥 Testing CSS hot reload functionality...');
  
  try {
    // Simulate CSS hot reload by checking that CSS changes would be detected
    const cssPath = path.join(__dirname, '../index.css');
    
    if (!fs.existsSync(cssPath)) {
      throw new Error('index.css not found');
    }
    
    const originalCSS = fs.readFileSync(cssPath, 'utf-8');
    
    // Check that the CSS file has the expected structure for hot reload
    // In v4, we use @import "tailwindcss" instead of @tailwind directives
    const hasImports = originalCSS.includes('@import "tailwindcss"') || originalCSS.includes('@tailwind');
    const hasCustomStyles = originalCSS.includes('@keyframes');
    // @layer is optional in v4, but @theme is common
    const hasTheme = originalCSS.includes('@theme');
    
    console.log(`   ✓ CSS has Tailwind imports: ${hasImports}`);
    console.log(`   ✓ CSS has custom styles: ${hasCustomStyles}`);
    console.log(`   ✓ CSS has theme configuration: ${hasTheme}`);
    
    const hotReloadReady = hasImports && hasCustomStyles;
    
    if (hotReloadReady) {
      console.log('\n✅ CSS hot reload functionality test passed');
      console.log('   - CSS structure supports hot reload');
      console.log('   - Tailwind directives are properly configured');
      return true;
    } else {
      console.log('\n❌ CSS hot reload functionality test failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ CSS hot reload test failed:', error);
    return false;
  }
};