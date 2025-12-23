/**
 * Unit tests for apiClient exports
 * Validates: Requirements 2.6
 */

import { GoogleGenAI } from "@google/genai";

// Test that all expected exports are available from apiClient
export const testApiClientExports = async (): Promise<boolean> => {
  console.log('🔌 Testing apiClient exports...');
  
  try {
    // Dynamic import to test the module exports
    const apiClient = await import('../services/shared/apiClient.js');
    
    const results: Record<string, boolean> = {};
    
    // Test 1: withRetry is exported and is a function
    results.withRetry = typeof apiClient.withRetry === 'function';
    console.log(`   ${results.withRetry ? '✅' : '❌'} withRetry: ${results.withRetry ? 'exported as function' : 'MISSING or not a function'}`);
    
    // Test 2: API_KEY is exported and is a string
    results.API_KEY = typeof apiClient.API_KEY === 'string';
    console.log(`   ${results.API_KEY ? '✅' : '❌'} API_KEY: ${results.API_KEY ? 'exported as string' : 'MISSING or not a string'}`);
    
    // Test 3: MODELS is exported and is an object with expected keys
    const modelsIsObject = typeof apiClient.MODELS === 'object' && apiClient.MODELS !== null;
    const hasExpectedModelKeys = modelsIsObject && 
      'TEXT' in apiClient.MODELS &&
      'IMAGE' in apiClient.MODELS &&
      'VIDEO' in apiClient.MODELS &&
      'TRANSCRIPTION' in apiClient.MODELS &&
      'TRANSLATION' in apiClient.MODELS;
    results.MODELS = hasExpectedModelKeys;
    console.log(`   ${results.MODELS ? '✅' : '❌'} MODELS: ${results.MODELS ? 'exported with all expected keys (TEXT, IMAGE, VIDEO, TRANSCRIPTION, TRANSLATION)' : 'MISSING or missing keys'}`);
    
    // Test 4: ai is exported and is a GoogleGenAI instance
    results.ai = apiClient.ai instanceof GoogleGenAI;
    console.log(`   ${results.ai ? '✅' : '❌'} ai: ${results.ai ? 'exported as GoogleGenAI instance' : 'MISSING or not a GoogleGenAI instance'}`);
    
    // Test 5: RetryConfig interface is usable (type check via usage)
    // We can't directly test TypeScript interfaces at runtime, but we can verify
    // that withRetry accepts the expected parameters
    results.withRetrySignature = apiClient.withRetry.length >= 1; // At least 1 parameter (fn)
    console.log(`   ${results.withRetrySignature ? '✅' : '❌'} withRetry signature: ${results.withRetrySignature ? 'accepts expected parameters' : 'unexpected signature'}`);
    
    const allPassed = Object.values(results).every(Boolean);
    console.log(`\n   ${allPassed ? '✅' : '❌'} apiClient exports: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('❌ Failed to import apiClient:', error);
    return false;
  }
};

// Test withRetry functionality with a simple mock
export const testWithRetryFunctionality = async (): Promise<boolean> => {
  console.log('🔄 Testing withRetry functionality...');
  
  try {
    const { withRetry } = await import('../services/shared/apiClient.js');
    
    const results: Record<string, boolean> = {};
    
    // Test 1: withRetry returns the result of a successful function
    let callCount = 0;
    const successFn = async () => {
      callCount++;
      return 'success';
    };
    const result = await withRetry(successFn);
    results.successfulCall = result === 'success' && callCount === 1;
    console.log(`   ${results.successfulCall ? '✅' : '❌'} Successful call: ${results.successfulCall ? 'returns result correctly' : 'FAILED'}`);
    
    // Test 2: withRetry throws non-retryable errors immediately
    let errorCallCount = 0;
    const errorFn = async () => {
      errorCallCount++;
      throw new Error('Non-retryable error');
    };
    try {
      await withRetry(errorFn, 3, 10); // Short delay for testing
      results.nonRetryableError = false;
    } catch (e: any) {
      // Should throw immediately without retrying (error doesn't have status 503 or 429)
      results.nonRetryableError = errorCallCount === 1 && e.message === 'Non-retryable error';
    }
    console.log(`   ${results.nonRetryableError ? '✅' : '❌'} Non-retryable error: ${results.nonRetryableError ? 'throws immediately' : 'FAILED'}`);
    
    // Test 3: withRetry retries on 503 errors
    let retryCallCount = 0;
    const retryFn = async () => {
      retryCallCount++;
      if (retryCallCount < 3) {
        const error: any = new Error('Service unavailable');
        error.status = 503;
        throw error;
      }
      return 'recovered';
    };
    const retryResult = await withRetry(retryFn, 3, 10); // Short delay for testing
    results.retryOn503 = retryResult === 'recovered' && retryCallCount === 3;
    console.log(`   ${results.retryOn503 ? '✅' : '❌'} Retry on 503: ${results.retryOn503 ? 'retries and recovers' : 'FAILED'}`);
    
    const allPassed = Object.values(results).every(Boolean);
    console.log(`\n   ${allPassed ? '✅' : '❌'} withRetry functionality: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('❌ Failed to test withRetry:', error);
    return false;
  }
};

// Run all apiClient tests
export const runApiClientTests = async (): Promise<Record<string, boolean>> => {
  console.log('🧪 Running apiClient test suite...\n');
  
  const results = {
    apiClientExports: await testApiClientExports(),
    withRetryFunctionality: await testWithRetryFunctionality()
  };
  
  console.log('\n📊 apiClient Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All apiClient tests passed!' : '⚠️  Some apiClient tests failed'}`);
  
  return results;
};
