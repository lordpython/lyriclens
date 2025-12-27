/**
 * Test script to verify the transcription model specifically
 */

import { GoogleGenAI } from "@google/genai";

// Get the API key from environment
const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

console.log("Testing Gemini Transcription Model...");
console.log("API Key (first 10 chars):", API_KEY.substring(0, 10) + "...");

async function testTranscriptionModel() {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    console.log("🔄 Testing gemini-3-flash-preview model...");
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: "Test transcription functionality" }],
      },
    });

    const text = response.text;
    console.log("✅ gemini-3-flash-preview model is working!");
    console.log("Response:", text);
    
    // Test with a more complex request similar to transcription
    console.log("\n🔄 Testing with JSON response format...");
    
    const jsonResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: "Return a simple JSON object with a greeting" }],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    console.log("✅ JSON response format working!");
    console.log("JSON Response:", jsonResponse.text);
    
  } catch (error: any) {
    console.error("❌ Model test failed:");
    console.error("Error message:", error.message);
    console.error("Error status:", error.status);
    console.error("Error code:", error.code);
    
    // Check if it's a model availability issue
    if (error.message?.includes("model") || error.status === 404) {
      console.log("\n🔧 Model troubleshooting:");
      console.log("1. The gemini-3-flash-preview model might not be available");
      console.log("2. Try using gemini-1.5-flash instead");
      console.log("3. Check Google AI Studio for available models");
    }
    
    if (error.message?.includes("API key")) {
      console.log("\n🔧 API Key troubleshooting:");
      console.log("1. The API key might have restrictions");
      console.log("2. Check Google Cloud Console for API restrictions");
      console.log("3. Verify the key has access to Generative Language API");
    }
  }
}

testTranscriptionModel();