1. The "Literalism" Trap (Line 296)
In getAgentSystemPrompt, you are explicitly forcing the AI to be boring. Current Code:

TypeScript

// Line 296
- CRITICAL: If lyrics mention an object (candle, door, rain), show that ACTUAL object
Why it fails: This forces the AI to ignore mood and context. If the song is about "burning passion" (metaphor), your code forces it to show a literal fire, which looks like a safety diagram.

The Fix: Change the Core Rule in getAgentSystemPrompt to prioritize Atmosphere over Object.

TypeScript

// REPLACE existing getAgentSystemPrompt with this logic:

function getAgentSystemPrompt(purpose: VideoPurpose): string {
  // ... existing persona setup ...

  return `You are ${persona.name}, a Visionary Film Director known for atmospheric, non-linear storytelling (Style: Christopher Nolan meets A24).

## Your Identity & Core Rule
ATMOSPHERIC RESONANCE: Do NOT just visualize the nouns in the lyrics. Visualize the *feeling*. 
If lyrics say "candle", do NOT just show a candle. Show a lonely room where a candle has just burned out, implying absence. 
The object is a prop; the EMOTION is the subject.

## Quality Standards
- CRITICAL: Every shot must look like it belongs to the SAME high-budget movie.
- UNIFYING THREAD: Use a consistent visual motif in every scene (e.g., "cold blue fog" or "warm dust particles").
- AVOID: Isolated objects on plain backgrounds. Always place objects in a rich, textured environment.
`; 
}
2. The "Generic" Style Injection (Line 368)
In generatePromptsWithAgent, you pass a simple style string. Current Code:

TypeScript

// Line 368
Style: ${style}
If style is just "Cinematic", the AI defaults to "generic stock footage cinematic."

The Fix: Inject a "Style Wrapper" that enforces the professional look (grain, lighting, lens) globally.

TypeScript

// Inside generatePromptsWithAgent function:

const PRO_STYLE_WRAPPER = `
GLOBAL VISUAL SIGNATURE (Apply to ALL prompts):
- Camera: Arri Alexa 65, Panavision 70mm lenses
- Color Grading: Teal & Orange, low contrast shadows, slightly desaturated
- Texture: Fine 35mm film grain, atmospheric haze/volumetric lighting
- Aspect Ratio: 2.39:1 Anamorphic
`;

const taskMessage = `Create a visual storyboard...

${PRO_STYLE_WRAPPER} 
Style Context: ${style}
...
`;
3. Missing Visual Glue (The "Cohesion" Fix)
Your tool definition for generate_storyboard (Line 95) allows the AI to generate 10 separate prompts. The AI treats them as 10 separate tasks, which causes the visual inconsistency (one looks like 3D render, one like a photo).

The Fix: Update the taskMessage to enforce a "Connector" rule.

TypeScript

// Add this to your taskMessage in generatePromptsWithAgent:

const consistencyRule = `
CONSISTENCY CHECK:
You must pick ONE specific lighting condition and ONE specific environment texture and use it in EVERY single prompt.
Example: If Scene 1 is "rainy window at night", Scene 5 cannot be "bright sunny field". 
All 10 prompts must share the same "visual universe".
`;

// Append to taskMessage
const taskMessage = `...
${consistencyRule}
...`;
Summary of Changes
Relax the Literalism Rule: Allow the AI to be metaphorical again.

Hardcode "Pro" Specs: Don't trust the AI to know what "Cinematic" means; give it the camera specs (Arri Alexa, 35mm grain).

Enforce Consistency: Explicitly tell the AI that Scene 1 and Scene 10 must look like they were shot on the same day.

Applying these changes to agentDirectorService.ts will immediately remove that "stock photo slideshow" vibe.