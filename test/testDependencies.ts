import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test that verifies LangChain dependencies are properly installed in package.json
 * Requirements: 1.1, 1.2, 1.3
 */
export const testLangChainDependencies = (): boolean => {
  console.log('📦 Testing LangChain dependencies installation...');
  
  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    
    const requiredDeps = [
      '@langchain/google-genai',
      '@langchain/core',
      'langchain',
      'zod'
    ];
    
    const results: Record<string, boolean> = {};
    
    for (const dep of requiredDeps) {
      const hasDepency = dep in dependencies;
      results[dep] = hasDepency;
      console.log(`   ${hasDepency ? '✅' : '❌'} ${dep}: ${hasDepency ? dependencies[dep] : 'NOT FOUND'}`);
    }
    
    const allPresent = Object.values(results).every(Boolean);
    console.log(`${allPresent ? '✅' : '❌'} All LangChain dependencies present: ${allPresent}`);
    
    return allPresent;
  } catch (error) {
    console.error('❌ Failed to verify dependencies:', error);
    return false;
  }
};

/**
 * Test that verifies LangChain packages can be imported
 * This validates that npm install completed successfully
 */
export const testLangChainImports = async (): Promise<boolean> => {
  console.log('📥 Testing LangChain package imports...');
  
  try {
    // Test @langchain/google-genai import
    const googleGenai = await import('@langchain/google-genai');
    const hasGoogleGenai = 'ChatGoogleGenerativeAI' in googleGenai;
    console.log(`   ${hasGoogleGenai ? '✅' : '❌'} @langchain/google-genai: ChatGoogleGenerativeAI ${hasGoogleGenai ? 'available' : 'NOT FOUND'}`);
    
    // Test @langchain/core imports
    const corePrompts = await import('@langchain/core/prompts');
    const hasChatPromptTemplate = 'ChatPromptTemplate' in corePrompts;
    console.log(`   ${hasChatPromptTemplate ? '✅' : '❌'} @langchain/core/prompts: ChatPromptTemplate ${hasChatPromptTemplate ? 'available' : 'NOT FOUND'}`);
    
    const coreOutputParsers = await import('@langchain/core/output_parsers');
    const hasJsonOutputParser = 'JsonOutputParser' in coreOutputParsers;
    console.log(`   ${hasJsonOutputParser ? '✅' : '❌'} @langchain/core/output_parsers: JsonOutputParser ${hasJsonOutputParser ? 'available' : 'NOT FOUND'}`);
    
    // Test zod import
    const zod = await import('zod');
    const hasZod = 'z' in zod;
    console.log(`   ${hasZod ? '✅' : '❌'} zod: z ${hasZod ? 'available' : 'NOT FOUND'}`);
    
    const allImportsWork = hasGoogleGenai && hasChatPromptTemplate && hasJsonOutputParser && hasZod;
    console.log(`${allImportsWork ? '✅' : '❌'} All LangChain imports successful: ${allImportsWork}`);
    
    return allImportsWork;
  } catch (error) {
    console.error('❌ Failed to import LangChain packages:', error);
    return false;
  }
};
