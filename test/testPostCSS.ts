import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test PostCSS configuration loading
export const testPostCSSConfig = async () => {
  console.log('🎨 Testing PostCSS configuration...');
  
  try {
    // Test that PostCSS config file exists and is readable
    const configPath = path.join(__dirname, '../postcss.config.js');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ PostCSS config file not found');
      return false;
    }
    
    // Import the PostCSS config using file:// URL for Windows compatibility
    const configUrl = new URL(`file://${configPath.replace(/\\/g, '/')}`);
    const configModule = await import(configUrl.href);
    const config = configModule.default;
    
    // Verify config structure
    if (!config || typeof config !== 'object') {
      console.error('❌ PostCSS config is not a valid object');
      return false;
    }
    
    if (!config.plugins || typeof config.plugins !== 'object') {
      console.error('❌ PostCSS config missing plugins object');
      return false;
    }
    
    // Verify @tailwindcss/postcss plugin is configured
    if (!('@tailwindcss/postcss' in config.plugins)) {
      console.error('❌ @tailwindcss/postcss plugin not found in config');
      return false;
    }
    
    // Verify autoprefixer is still configured
    if (!('autoprefixer' in config.plugins)) {
      console.error('❌ autoprefixer plugin not found in config');
      return false;
    }
    
    console.log('✅ PostCSS config loaded successfully');
    console.log('   - @tailwindcss/postcss: configured');
    console.log('   - autoprefixer: configured');
    
    // Test plugin initialization by attempting to load the plugins
    try {
      // Try to require the @tailwindcss/postcss plugin
      await import('@tailwindcss/postcss');
      console.log('✅ @tailwindcss/postcss plugin can be loaded');
    } catch (error) {
      console.error('❌ Failed to load @tailwindcss/postcss plugin:', error);
      return false;
    }
    
    try {
      // Try to require autoprefixer
      await import('autoprefixer');
      console.log('✅ autoprefixer plugin can be loaded');
    } catch (error) {
      console.error('❌ Failed to load autoprefixer plugin:', error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ PostCSS config test failed:', error);
    return false;
  }
};