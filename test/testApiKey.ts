/**
 * Test script to verify the Gemini API key is working
 */

import { GoogleGenAI } from "@google/genai";

// Get the API key from environment
const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

console.log("Testing Gemini API Key...");
console.log("API Key (first 10 chars):", API_KEY.substring(0, 10) + "...");

if (!API_KEY) {
  console.error("❌ No API key found in environment variables");
  process.exit(1);
}

async function testApiKey() {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    console.log("🔄 Testing API key with simple request...");
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: "Say hello" }],
      },
    });

    const text = response.text;
    console.log("✅ API key is working!");
    console.log("Response:", text);
    
  } catch (error: any) {
    console.error("❌ API key test failed:");
    console.error("Error message:", error.message);
    console.error("Error status:", error.status);
    console.error("Full error:", error);
    
    if (error.message?.includes("API key expired")) {
      console.log("\n🔧 Troubleshooting steps:");
      console.log("1. Go to https://aistudio.google.com/apikey");
      console.log("2. Create a new API key or regenerate existing one");
      console.log("3. Update your .env.local file");
      console.log("4. Restart your development server");
    }
    
    if (error.status === 400) {
      console.log("\n🔧 Additional checks:");
      console.log("1. Verify the API key format (should start with 'AIza')");
      console.log("2. Check if Generative Language API is enabled in Google Cloud Console");
      console.log("3. Verify billing is set up if using paid features");
    }
  }
}

testApiKey();