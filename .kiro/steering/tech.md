# Tech Stack

## Core Framework
- React 19 with TypeScript
- Vite 6 for build tooling and dev server

## Key Dependencies
- `@google/genai` - Gemini AI SDK for transcription, prompt generation, image generation, and translation
- `lucide-react` - Icon library

## Styling
- Tailwind CSS (via CDN in index.html)
- Custom utility classes with slate/cyan/blue color palette

## AI Models Used
- `gemini-2.5-flash` - Audio transcription, prompt generation, translation
- `gemini-2.5-flash-image` - Image generation from prompts

## Environment Variables
- `GEMINI_API_KEY` - Required, set in `.env.local`

## Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Path Aliases
- `@/*` maps to project root (configured in tsconfig.json and vite.config.ts)
