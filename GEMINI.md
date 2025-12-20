# LyricLens - AI Audio Visualizer & Music Video Generator

LyricLens is an AI-powered application that turns audio tracks—including music, stories, ads, and documentaries—into synchronized, visually stylistic videos. It leverages Google's Gemini models for transcription, content analysis, and image generation, combined with a versatile rendering pipeline (Server-side or Client-side WASM) to produce high-quality MP4 exports.

## Project Overview

-   **Frontend:** React (Vite), TypeScript, Tailwind CSS, **Shadcn UI**, **Framer Motion**.
-   **Backend:** Node.js (Express), FFmpeg (Video Stitching), yt-dlp (YouTube Import).
-   **AI Engine:** Google Gemini (via `@google/genai` SDK).
-   **Core Features:**
    *   **Dual Modes:** Support for "Music Video" (Verse/Chorus analysis) and "Story / Speech" (Narrative/Segment analysis).
    *   **Intent-Based Prompts:** 13+ specialized visual styles including "Commercial/Ad", "Manga", "Tutorial", and "Cinematic".
    *   **Subject Consistency:** "Global Subject" input to maintain character/object consistency across generated scenes.
    *   **Aspect Ratio Support:** Generate 16:9 (Landscape) or 9:16 (Portrait) videos and images for diverse platforms.
    *   **Transcription:** Generates word-level synchronized transcripts.
    *   **Visual Storyboard:** Automatically generates thematic image prompts based on content structure.
    *   **Editable Prompts:** Users can manually tweak AI-generated prompts before generating artwork.
    *   **Imagen 3 Integration:** High-quality image generation via Gemini 2.5.
    *   **Multi-Engine Export:** Choice between "Cloud Render" (Server-side) and "Browser Render" (Client-side FFmpeg-WASM).

## Architecture

The project uses a **flexible rendering approach** to balance speed and privacy:

1.  **Client-Side Rendering (Canvas):** The browser renders each frame onto an HTML5 Canvas, including background images, audio visualizers, synchronized subtitles (word-level), and visual effects (Ken Burns zoom, gradients, glow).

2.  **Export Engines:**
    *   **Cloud Render (Server-Side):** Canvas frames are uploaded as JPEG chunks to the Express server, which stitches them using native FFmpeg. Best for large projects or low-power devices.
    *   **Browser Render (Client-Side):** Uses `ffmpeg-wasm` to encode the video directly in the user's browser. Best for privacy (no data leaves the device) and smaller exports.

## UI Framework & Design System

The application uses **Shadcn UI** combined with **Framer Motion** for a modern, "Pace UI" inspired aesthetic:

*   **Layout:** Responsive Sidebar layout with sticky navigation and split-view workspace.
*   **Animations:**
    *   **Page Transitions:** Smooth cross-fades between IDLE and READY states.
    *   **Micro-interactions:** Hover lifts on cards, spring animations for sidebars.
    *   **Shared Layout:** Smooth active state transitions in the transcript list using `layoutId`.
*   **Components:**
    *   **Input & Selection:** Clean, floating-label style inputs.
    *   **Feedback:** Animated loaders and status badges.
    *   **Modals:** Glassmorphism-styled dialogs for export configuration.

## Key Files & Services

### Frontend
*   **`hooks/useLyricLens.ts`**: The core business logic hook. Manages state for audio processing, AI orchestration, and transcription lifecycle.
*   **`App.tsx`**: Main layout orchestrator. Handles the Sidebar, Navigation, and high-level page transitions.
*   **`services/geminiService.ts`**: Bridge to Google's Gemini API. Features a unified `generatePrompts` strategy for both music and story modes.
*   **`services/ffmpegService.ts`**: Contains both `exportVideoWithFFmpeg` (Cloud) and `exportVideoClientSide` (WASM) implementations, utilizing shared polyfills.
*   **`lib/utils.ts`**: Shared utilities, including Canvas polyfills and Tailwind helpers.
*   **`components/ImageGenerator.tsx`**: Motion-enhanced card for viewing/editing artwork.
*   **`components/TranscriptList.tsx`**: Interactive list with optimized rendering and smooth active state animations.

### Backend (`server/`)
*   **`server/index.ts`**:
    *   **`/api/export/*`**: Manages temporary sessions for server-side stitching.
    *   **`/api/import/youtube`**: Spawns `yt-dlp` for audio downloads.

## Setup & Usage

### Prerequisites
*   Node.js (v18+)
*   FFmpeg installed in system PATH (required for Cloud Render).
*   Google Gemini API Key.

### Environment
Create a `.env.local` file in the root:
```env
GEMINI_API_KEY=your_api_key_here
```

### Commands
| Command | Description |
| :--- | :--- |
| `npm run dev:all` | **Recommended.** Runs both Vite frontend and Express server. |
| `npm run dev` | Runs only the frontend. |
| `npm test` | Runs the test suite (`test/runTest.ts`). |

## Development Conventions

*   **Logic Separation:** Business logic must reside in `hooks/` or `services/`, keeping components focused on presentation.
*   **AI Reliability:** Always use `responseSchema` for deterministic JSON outputs from Gemini.
*   **Code Reuse:** Shared utilities (like Canvas operations) should be in `lib/utils.ts`.
*   **Animation:** Use `framer-motion` for complex state transitions and `tailwindcss-animate` for simple entry effects.