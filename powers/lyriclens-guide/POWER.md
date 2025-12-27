---
name: "lyriclens-guide"
displayName: "LyricLens Project Guide"
description: "Architecture rules, coding conventions, and development guidelines for the LyricLens AI-powered lyric video generator project."
keywords: ["lyriclens", "lyric-video", "ffmpeg", "langchain", "gemini"]
author: "LyricLens Team"
---

# LyricLens Project Guide

## Overview

LyricLens is an AI-powered lyric video generator that uses a **Direct-to-Motif** pipeline. This power provides architecture rules, coding conventions, and development guidelines for working on the project.

Key technologies: React, TypeScript, LangChain, Google Gemini AI, FFmpeg, Capacitor (Android).

## Directory Structure

```
lyriclens/
├── .agent/              # AI assistant configuration & rules
├── android/             # Capacitor Android project
├── components/          # React components (Frontend)
│   ├── ui/              # Shadcn primitive components
│   └── layout/          # Page structure & navigation
├── constants/           # Enums, constants, and static data
├── hooks/               # Custom React hooks (useLyricLens is CORE)
├── lib/                 # Utility library wrappers (e.g., tailwind-merge)
├── public/              # Static assets (fonts, icons)
├── server/              # Node.js/Express backend (FFmpeg & rendering)
├── services/            # Business & AI Logic
│   ├── agent/           # LangChain tool definitions & agent logic
│   ├── ffmpeg/          # Resolution, FPS, and Export configs
│   ├── prompt/          # Persona data & style enhancements
│   └── shared/          # API clients & common error handling
├── test/                # Test suites (unit & integration)
├── utils/               # Helpers (SRT parsing, platform detection)
├── types.ts             # Global TypeScript interfaces
└── App.tsx              # Main application entry point
```

## Naming Conventions

| Entity | Pattern | Example |
|:-------|:--------|:--------|
| **Components** | `PascalCase` | `TimelinePlayer.tsx` |
| **Services** | `camelCase + Service` | `transcriptionService.ts` |
| **Hooks** | `camelCase + use prefix` | `useLyricLens.ts` |
| **Types** | `PascalCase` | `SubtitleItem`, `ImagePrompt` |
| **Constants** | `SCREAMING_SNAKE` | `CAMERA_ANGLES`, `MODELS` |
| **CSS** | `Vanilla CSS` | `IntroAnimation.css` |

## Core Architecture: Director Pipeline

LyricLens uses a **Direct-to-Motif** pipeline with **Concrete Motif Literalism** (no traditional song segmentation like Verse/Chorus).

### Pipeline Flow

1. **Transcription** → `transcriptionService.ts` generates word-accurate SRT
2. **Analysis** → `directorService.ts` extracts physical objects (themes, motifs, concrete objects)
3. **Asset Logic** → `assetCalculatorService.ts` determines asset count based on motif density and duration
4. **Generation** → `agentDirectorService.ts` uses tools to create cinematic prompts centered on extracted motifs

## Service Responsibilities

| Service | Purpose |
|:--------|:--------|
| `directorService.ts` | LangChain LCEL pipeline for content interpretation |
| `agentDirectorService.ts` | Tool-calling agent for smarter storyboard generation |
| `ffmpegService.ts` | Handles 720p @ 24FPS optimized rendering loop |
| `assetCalculatorService.ts` | Calculates optimal asset distribution across audio duration |
| `geminiService.ts` | Core API bridge to Google Generative AI |

## React Guidelines

### State Management
- Centralized in the `useLyricLens.ts` hook
- Components should remain mostly presentational

### Styling Stack
- **Vanilla CSS** → Animations
- **Tailwind** → Layout
- **Shadcn** → UI components

### Interactions
- Use `framer-motion` for all visual transitions and intro animations

## Backend & Export

- Server (`server/index.ts`) → Fast FFmpeg stitching
- Browser fallback (`ffmpeg-wasm`) → Client-side processing
- All exports optimized to **720p (1280x720 / 720x1280)** at **24 FPS**

## AI Interaction Rules

### Required Patterns

```typescript
// Always wrap AI calls in retry logic
const result = await withRetry(() => geminiService.generate(prompt));

// Use jsonExtractor for malformed LLM outputs
const parsed = jsonExtractor.extract(rawResponse);

// Refine prompts for visual consistency
const refined = await refineImagePrompt(basePrompt, context);

// Validate AI responses with Zod before consumption
const validated = MySchema.parse(aiResponse);
```

### Key Rules

1. **Retry Logic** → Always wrap AI calls in `withRetry()` utility
2. **JSON Extraction** → Use `jsonExtractor.ts` to handle malformed LLM outputs
3. **Prompt Refinement** → Use `refineImagePrompt` for cross-scene visual consistency
4. **Output Locking** → Always use Zod schemas to validate AI responses

## Common Workflows

### Adding a New Service

1. Create file in `services/` with `camelCaseService.ts` naming
2. Export functions (not classes) for tree-shaking
3. Add types to `types.ts` if needed
4. Wrap AI calls with `withRetry()` and Zod validation

### Adding a New Component

1. Create in `components/` with `PascalCase.tsx` naming
2. Keep presentational - state lives in `useLyricLens` hook
3. Use Tailwind for layout, Vanilla CSS for animations
4. Add Framer Motion for transitions

### Modifying the Director Pipeline

1. Changes to content interpretation → `directorService.ts`
2. Changes to storyboard generation → `agentDirectorService.ts`
3. Changes to asset distribution → `assetCalculatorService.ts`
4. Always maintain Concrete Motif Literalism approach

## Best Practices

- Keep components presentational, logic in hooks/services
- Use Zod schemas for all AI response validation
- Maintain 720p @ 24FPS export standard
- Follow the Direct-to-Motif pipeline (no Verse/Chorus segmentation)
- Wrap all AI calls with `withRetry()` for resilience
